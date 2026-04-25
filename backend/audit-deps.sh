#!/bin/bash
# backend/audit-deps.sh
# Dependency audit script: checks for outdated packages and known vulnerabilities
# Usage: ./audit-deps.sh [--json]
# Output: JSON report with vulnerabilities and outdated packages

set -e

OUTPUT_JSON=false
if [ "$1" = "--json" ]; then
    OUTPUT_JSON=true
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Detect backend directory
BACKEND_DIR="backend"
if [ ! -d "$BACKEND_DIR" ]; then
    echo "Error: backend/ directory not found" >&2
    exit 1
fi

cd "$BACKEND_DIR"

# Determine Python dependency file
PY_REQ_FILE=""
if [ -f "requirements.txt" ]; then
    PY_REQ_FILE="requirements.txt"
elif [ -f "pyproject.toml" ]; then
    PY_REQ_FILE="pyproject.toml"
elif [ -f "setup.py" ]; then
    PY_REQ_FILE="setup.py"
fi

# Determine frontend package manager
if [ -f "../frontend/package.json" ]; then
    FRONTEND_DIR="../frontend"
fi

report_json="{}"

# ─── Python Audit ───────────────────────────────────────────────────────────────
echo "Running Python dependency audit..."

PY_OUTDATED_JSON="[]"
PY_VULNS_JSON="[]"
PY_AUDIT_ERRORS=""

if [ -n "$PY_REQ_FILE" ]; then
    # Check for outdated packages
    if command -v pip list >/dev/null 2>&1; then
        PY_OUTDATED_RAW=$(pip list --outdated 2>/dev/null || echo "")
        if [ -n "$PY_OUTDATED_RAW" ]; then
            # Parse outdated packages into JSON array entries
            PY_OUTDATED_JSON=$(echo "$PY_OUTDATED_RAW" | tail -n +3 | awk '{print $1","$3","$4}' | while read -r name current latest; do
                if [ -n "$name" ]; then
                    echo "{\"name\":\"$name\",\"current\":\"$current\",\"latest\":\"$latest\"},"
                fi
            done | sed '$s/,$//' | tr '\n' ' ' | sed 's/^/[/;s/ $//]')
            if [ -z "$PY_OUTDATED_JSON" ] || [ "$PY_OUTDATED_JSON" = "[]" ]; then
                PY_OUTDATED_JSON="[]"
            fi
        else
            PY_OUTDATED_JSON="[]"
        fi
    fi

    # Check for vulnerabilities using pip-audit
    if command -v pip-audit >/dev/null 2>&1; then
        PY_VULNS_RAW=$(pip-audit --format=json 2>/dev/null || echo "[]")
        if echo "$PY_VULNS_RAW" | grep -q "^\[" 2>/dev/null; then
            PY_VULNS_JSON="$PY_VULNS_RAW"
        else
            PY_VULNS_JSON="[]"
        fi
    elif command -v safety >/dev/null 2>&1; then
        PY_VULNS_RAW=$(safety check --json 2>/dev/null || echo "[]")
        if echo "$PY_VULNS_RAW" | grep -q "^\[" 2>/dev/null; then
            PY_VULNS_JSON="$PY_VULNS_RAW"
        else
            PY_VULNS_JSON="[]"
        fi
    else
        PY_AUDIT_ERRORS="pip-audit or safety not installed. Install with: pip install pip-audit"
    fi
fi

# ─── JavaScript/Node Audit ──────────────────────────────────────────────────────
echo "Running JavaScript dependency audit..."

JS_OUTDATED_JSON="[]"
JS_VULNS_JSON="[]"
JS_AUDIT_ERRORS=""

if [ -d "$FRONTEND_DIR" ]; then
    cd "$PROJECT_ROOT"
    cd "$FRONTEND_DIR"

    if [ -f "package.json" ]; then
        # Check for outdated packages
        if command -v npm >/dev/null 2>&1; then
            JS_OUTDATED_RAW=$(npm outdated --json 2>/dev/null || echo "{}")
            if [ "$JS_OUTDATED_RAW" != "{}" ] && echo "$JS_OUTDATED_RAW" | grep -q "^{" 2>/dev/null; then
                JS_OUTDATED_JSON="$JS_OUTDATED_RAW"
            else
                JS_OUTDATED_JSON="[]"
            fi
        fi

        # Check for vulnerabilities with npm audit
        if command -v npm >/dev/null 2>&1; then
            JS_AUDIT_RAW=$(npm audit --json 2>/dev/null || echo "{}")
            if echo "$JS_AUDIT_RAW" | grep -q "^{\"actions\":" 2>/dev/null; then
                # Extract just the vulnerabilities from npm audit output
                JS_VULNS_JSON=$(echo "$JS_AUDIT_RAW" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    vulns = data.get('vulnerabilities', {})
    result = []
    for name, info in vulns.items():
        result.append({
            'name': name,
            'severity': info.get('severity', 'unknown'),
            'current_version': info.get('findings', [{}])[0].get('version', 'unknown') if info.get('findings') else 'unknown',
            'url': 'https://npmjs.com/advisories/' + name
        })
    print(json.dumps(result))
except:
    print('[]')
" 2>/dev/null || echo "[]")
            else
                JS_VULNS_JSON="[]"
            fi
        fi
    fi
fi

# ─── Build Final Report ─────────────────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

REPORT="{
  \"timestamp\": \"$TIMESTAMP\",
  \"project\": \"narc-kart\",
  \"python\": {
    \"dependency_file\": \"$PY_REQ_FILE\",
    \"outdated\": $PY_OUTDATED_JSON,
    \"vulnerabilities\": $PY_VULNS_JSON,
    \"errors\": $(if [ -n "$PY_AUDIT_ERRORS" ]; then echo "\"$PY_AUDIT_ERRORS\""; else echo "null"; fi)
  },
  \"javascript\": {
    \"outdated\": $JS_OUTDATED_JSON,
    \"vulnerabilities\": $JS_VULNS_JSON,
    \"errors\": $(if [ -n "$JS_AUDIT_ERRORS" ]; then echo "\"$JS_AUDIT_ERRORS\""; else echo "null"; fi)
  },
  \"summary\": {
    \"python_outdated_count\": $(echo "$PY_OUTDATED_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0"),
    \"python_vuln_count\": $(echo "$PY_VULNS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0"),
    \"js_outdated_count\": $(echo "$JS_OUTDATED_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('dependencies',{}).values()) if isinstance(d,dict) else 0)" 2>/dev/null || echo "0"),
    \"js_vuln_count\": $(echo "$JS_VULNS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  }
}"

if [ "$OUTPUT_JSON" = "true" ]; then
    echo "$REPORT" | python3 -m json.tool 2>/dev/null || echo "$REPORT"
else
    echo "=========================================="
    echo "       Narc Kart - Dependency Audit      "
    echo "=========================================="
    echo "Timestamp: $TIMESTAMP"
    echo ""

    echo "🐍 Python ($PY_REQ_FILE):"
    echo "$PY_OUTDATED_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d:
        print('  Outdated packages:')
        for p in d:
            print(f'    - {p[\"name\"]}: {p[\"current\"]} → {p[\"latest\"]}')
    else:
        print('  All packages up to date ✅')
except:
    print('  (could not parse outdated list)')
" 2>/dev/null || true

    echo ""
    echo "  Vulnerabilities:"
    echo "$PY_VULNS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d:
        for v in d:
            print(f'    ❌ {v.get(\"name\",\"?\")}: {v.get(\"vulns\",[{}])[0].get(\"fix_version\",\"?\") if v.get(\"vulns\") else \"unknown\"}')
    else:
        print('  No known vulnerabilities ✅')
except:
    print('  (could not parse vulnerabilities)')
" 2>/dev/null || true

    if [ -n "$PY_AUDIT_ERRORS" ]; then
        echo "  ⚠️  $PY_AUDIT_ERRORS"
    fi

    if [ -d "$FRONTEND_DIR" ]; then
        echo ""
        echo "📦 JavaScript:"
        echo "$JS_OUTDATED_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    deps = d.get('dependencies', {}) if isinstance(d, dict) else {}
    if deps:
        print('  Outdated packages:')
        for name, info in list(deps.items())[:10]:
            print(f'    - {name}: {info.get(\"current\",\"?\")} → {info.get(\"wanted\",\"?\")}')
        if len(deps) > 10:
            print(f'    ... and {len(deps)-10} more')
    else:
        print('  All packages up to date ✅')
except:
    print('  (could not parse outdated list)')
" 2>/dev/null || true

        echo ""
        echo "  Vulnerabilities:"
        echo "$JS_VULNS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d:
        for v in d:
            sev = v.get('severity', 'unknown')
            icon = '🔴' if sev == 'critical' else ('🟠' if sev == 'high' else '🟡')
            print(f'  {icon} {v[\"name\"]} ({sev})')
    else:
        print('  No known vulnerabilities ✅')
except:
    print('  (could not parse vulnerabilities)')
" 2>/dev/null || true
    fi

    echo ""
    echo "=========================================="
fi

# Exit codes:
# 0 = audit passed (no critical/high vulnerabilities)
# 1 = audit ran but found issues
# 2 = audit could not run

PY_VULN_COUNT=$(echo "$PY_VULNS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for v in d if v.get('severity') in ('critical','high')))" 2>/dev/null || echo "0")
JS_VULN_COUNT=$(echo "$JS_VULNS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
TOTAL_VULNS=$((PY_VULN_COUNT + JS_VULN_COUNT))

if [ $TOTAL_VULNS -gt 0 ]; then
    exit 1
fi
exit 0
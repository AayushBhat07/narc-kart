# Pull Request Template

> Fill out ALL sections. Incomplete PRs will not be reviewed.

---

## 📋 Description

<!-- What does this PR do? Be specific. -->
<!-- Example: Adds interactive seizure marker popups on the India map with drug type, quantity, and date. -->

**Summary:**



**Related Issue / Ticket:** (if applicable)

---

## 🧪 Testing Done

<!-- Describe tests you ran to verify your changes work. -->

- [ ] Unit tests added/updated
- [ ] Tested locally in browser
- [ ] Tested on mobile (if UI changes)
- [ ] API endpoints tested (if backend changes)
- [ ] No console errors in browser
- [ ] No regression in existing features

**Test environment:**
- OS / Browser:
- Backend URL:
- Any special setup needed:

---

## 📸 Screenshots / Recordings

<!-- For UI changes, before and after screenshots are REQUIRED. -->

| Before | After |
|---|---|
| | |
| | |

**GIF / Video** (optional, for animations or complex interactions):

---

## 🔄 Breaking Changes

<!-- Will this break existing functionality? -->

- [ ] Yes — describe what breaks and how to migrate
- [ ] No

**Breaking changes:**

---

## 🔗 Related Issues

<!-- Link to any related issues with #issue-number -->

- Closes #
- Related to #
- Blocks #

---

## ✅ Checklist

- [ ] Code follows [Code Review Checklist](../qa/code-review-checklist.md)
- [ ] No security issues (see [Security Review Template](../qa/security-review.md))
- [ ] Dependencies updated if needed (run `pip list --outdated` / `npm outdated`)
- [ ] Documentation updated if needed
- [ ] No hardcoded secrets or API keys
- [ ] Conventional commit format used for branch name and commits

---

## 📦 Files Changed

<!-- List all files modified and why -->

```
backend/
  - file.py       | reason
  - another.py    | reason

frontend/
  - Component.tsx | reason
  - utils.ts      | reason
```

---

## 💬 Additional Notes

<!-- Anything else the reviewer should know? -->

---

*PR auto-close: Close the branch after merge?* [ ] Yes  [ ] No
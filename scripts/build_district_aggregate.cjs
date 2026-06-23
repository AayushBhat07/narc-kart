#!/usr/bin/env node
/**
 * Pre-compute seizure aggregation per India district.
 *
 * For every seizure in data.json, point-in-polygon test against the
 * simplified district GeoJSON. Output: data-by-district.json
 *
 *   {
 *     byDistrict: {
 *       "Mumbai|Maharashtra": { count, totalKg, drugs: {heroin: n, ...} },
 *       ...
 *     },
 *     byState: { "Maharashtra": { count, totalKg }, ... },
 *     unmatchedSeizures: [ { id, city, state, lat, lon } ]
 *   }
 *
 * Run from repo root:  node scripts/build_district_aggregate.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DISTRICTS = path.join(ROOT, 'frontend/public/india-districts.geojson');
const DATA = path.join(ROOT, 'frontend/public/data.json');
const OUT = path.join(ROOT, 'frontend/public/data-by-district.json');

// State name normalization (data.json → geojson)
const STATE_ALIASES = {
  'Jammu & Kashmir': 'Jammu and Kashmir',
  'Orissa': 'Odisha',
  'Odisha': 'Odisha',
  'Uttaranchal': 'Uttarakhand',
  'Uttarakhand': 'Uttarakhand',
  // Telangana is missing from the 2011 GeoJSON — fold into Andhra Pradesh
  'Telangana': 'Andhra Pradesh',
};

// City → district name aliases (common renames)
const CITY_ALIASES = {
  'bangalore': 'bengaluru',     // 2011 GeoJSON uses Bengaluru
  'bombay': 'mumbai',
  'calcutta': 'kolkata',
  'madras': 'chennai',
  'trivandrum': 'thiruvananthapuram',
  'cochin': 'kochi',
  'pondicherry': 'puducherry',
  'baroda': 'vadodara',
  'gauhati': 'guwahati',
  'cawnpore': 'kanpur',
  'benares': 'varanasi',
  'allahabad': 'prayagraj',
  'allahabad ': 'prayagraj',
  'visakhapatnam': 'visakhapatnam',
  'vishakha- patnam': 'visakhapatnam',  // data has typo
  'vizag': 'visakhapatnam',
  'jabalpur': 'jabalpur',
  'sambalpur': 'sambalpur',
  'cuttack': 'cuttack',
  'bhubaneshwar': 'bhubaneswar',
  'bhubaneswar': 'bhubaneswar',
  'trichy': 'tiruchirappalli',
  'tiruchi': 'tiruchirappalli',
  'coimbatore': 'coimbatore',
  'mangalore': 'mangaluru',
  'mangaluru': 'mangaluru',
  'mysore': 'mysuru',
  'hubli': 'hubli',
  'belgaum': 'belagavi',
  'gulbarga': 'kalaburagi',
  'nasik': 'nashik',
  'poona': 'pune',
  'nagpur': 'nagpur',
  'aurangabad': 'aurangabad',
  'sholapur': 'solapur',
  'amravati': 'amravati',
  'kolhapur': 'kolhapur',
  'sangli': 'sangli',
  'ratnagiri': 'ratnagiri',
  'sindhudurg': 'sindhudurg',
  'gwalior': 'gwalior',
  'jabalpur': 'jabalpur',
  'ujjain': 'ujjain',
  'indore': 'indore',
  'bhopal': 'bhopal',
  'raipur': 'raipur',
  'bilaspur': 'bilaspur',
  'durg': 'durg',
  'bhilai': 'durg',  // bhilai is in durg district
  'rourkela': 'sundargarh',
  'bokaro': 'bokaro',
  'jamshedpur': 'east singhbhum',
  'ranchi': 'ranchi',
  'hazaribagh': 'hazaribagh',
  'dehradun': 'dehradun',
  'haridwar': 'haridwar',
  'nainital': 'nainital',
  'mussoorie': 'dehradun',
  'shimla': 'shimla',
  'manali': 'kullu',
  'dharamshala': 'kangra',
  'leh': 'leh',
  'kargil': 'kargil',
  'srinagar': 'srinagar',
  'jammu': 'jammu',
  'amritsar': 'amritsar',
  'ludhiana': 'ludhiana',
  'jalandhar': 'jalandhar',
  'patiala': 'patiala',
  'chandigarh': 'chandigarh',
  'panipat': 'panipat',
  'karnal': 'karnal',
  'ambala': 'ambala',
  'gurugram': 'gurugram',
  'gurgaon': 'gurugram',
  'faridabad': 'faridabad',
  'noida': 'gautam buddha nagar',
  'ghaziabad': 'ghaziabad',
  'meerut': 'meerut',
  'agra': 'agra',
  'lucknow': 'lucknow',
  'kanpur': 'kanpur',
  'varanasi': 'varanasi',
  'allahabad': 'prayagraj',
  'prayagraj': 'prayagraj',
  'gorakhpur': 'gorakhpur',
  'bareilly': 'bareilly',
  'moradabad': 'moradabad',
  'aligarh': 'aligarh',
  'muzaffarnagar': 'muzaffarnagar',
  'saharanpur': 'saharanpur',
  'muzaffarpur': 'muzaffarpur',
  'patna': 'patna',
  'gaya': 'gaya',
  'bhagalpur': 'bhagalpur',
  'darbhanga': 'darbhanga',
  'kolkata': 'kolkata',
  'howrah': 'haora',
  'asansol': 'paschim bardhaman',
  'durgapur': 'paschim bardhaman',
  'siliguri': 'darjiling',
  'darjeeling': 'darjiling',
  'bhubaneswar': 'bhubaneswar',
  'cuttack': 'cuttack',
  'rourkela': 'sundargarh',
  'brahmapur': 'ganjam',
  'sambalpur': 'sambalpur',
  'puri': 'puri',
  'kakinada': 'east godavari',
  'vijayawada': 'krishna',
  'guntur': 'guntur',
  'nellore': 'sri potti sriramulu nellore',
  'kurnool': 'kurnool',
  'tirupati': 'chittoor',
  'rajahmundry': 'east godavari',
  'warangal': 'warangal',
  'karimnagar': 'karimnagar',
  'hyderabad': 'hyderabad',
  'secunderabad': 'hyderabad',
  'nizamabad': 'nizamabad',
  'chennai': 'chennai',
  'coimbatore': 'coimbatore',
  'madurai': 'madurai',
  'tiruchirappalli': 'tiruchirappalli',
  'salem': 'salem',
  'tirunelveli': 'tirunelveli',
  'erode': 'erode',
  'vellore': 'vellore',
  'thanjavur': 'thanjavur',
  'dindigul': 'dindigul',
  'kanchipuram': 'kanchipuram',
  'cuddalore': 'cuddalore',
  'nagapattinam': 'nagapattinam',
  'namakkal': 'namakkal',
  'krishnagiri': 'krishnagiri',
  'dharmapuri': 'dharmapuri',
  'villupuram': 'villupuram',
  'thiruvallur': 'thiruvallur',
  'thiruvarur': 'thiruvarur',
  'karur': 'karur',
  'perambalur': 'perambalur',
  'ariyalur': 'ariyalur',
  'pudukkottai': 'pudukkottai',
  'sivaganga': 'sivaganga',
  'virudhunagar': 'virudhunagar',
  'thoothukudi': 'thoothukudi',
  'tuticorin': 'thoothukudi',
  'kanniyakumari': 'kanniyakumari',
  'ramanathapuram': 'ramanathapuram',
  'theni': 'theni',
  'nilgiris': 'the nilgiris',
  'ooty': 'the nilgiris',
  'kochi': 'kochi',
  'thiruvananthapuram': 'thiruvananthapuram',
  'kozhikode': 'kozhikode',
  'calicut': 'kozhikode',
  'thrissur': 'thrissur',
  'trichur': 'thrissur',
  'alappuzha': 'alappuzha',
  'alleppey': 'alappuzha',
  'kollam': 'kollam',
  'quilon': 'kollam',
  'kannur': 'kannur',
  'cannanore': 'kannur',
  'palakkad': 'palakkad',
  'palghat': 'palakkad',
  'malappuram': 'malappuram',
  'kasaragod': 'kasaragod',
  'idukki': 'idukki',
  'pathanamthitta': 'pathanamthitta',
  'kottayam': 'kottayam',
  'ernakulam': 'ernakulam',
  'wayanad': 'wayanad',
  'mangaluru': 'mangaluru',
  'udupi': 'udupi',
  'bengaluru': 'bengaluru',
  'bengaluru urban': 'bengaluru',
  'mysuru': 'mysuru',
  'belagavi': 'belagavi',
  'hubballi': 'dharwad',
  'dharwad': 'dharwad',
  'tumakuru': 'tumakuru',
  'tumkur': 'tumakuru',
  'ballari': 'ballari',
  'bellary': 'ballari',
  'davangere': 'davangere',
  'shivamogga': 'shivamogga',
  'shimoga': 'shivamogga',
  'hassan': 'hassan',
  'chitradurga': 'chitradurga',
  'chikkamagaluru': 'chikkamagaluru',
  'chikmagalur': 'chikkamagaluru',
  'kodagu': 'kodagu',
  'coorg': 'kodagu',
  'raichur': 'raichur',
  'koppal': 'koppal',
  'gadag': 'gadag',
  'haveri': 'haveri',
  'bidar': 'bidar',
  'kalaburagi': 'kalaburagi',
  'gulbarga': 'kalaburagi',
  'yadgir': 'yadgir',
  'ramanagara': 'ramanagara',
  'chikkaballapur': 'chikkaballapur',
  'kolar': 'kolar',
};

// Strip "Greater X" / "X City" / "X Urban" prefixes for matching
function normalizeCity(s) {
  return (s || '')
    .toLowerCase()
    .replace(/^greater\s+/, '')
    .replace(/\s+city$/, '')
    .replace(/\s+urban$/, '')
    .replace(/\s+suburban$/, '')
    .replace(/\s+rural$/, '')
    .replace(/\s+municipal.*$/, '')
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Point-in-polygon (ray casting), with MultiPolygon support ---
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon, lat, poly) {
  // poly is [ring, ring, ...] — first is outer, rest are holes
  if (!pointInRing(lon, lat, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) {
    if (pointInRing(lon, lat, poly[i])) return false; // inside a hole
  }
  return true;
}

function pointInFeature(lon, lat, feature) {
  const g = feature.geometry;
  if (!g) return false;
  if (g.type === 'Polygon') return pointInPolygon(lon, lat, g.coordinates);
  if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates) {
      if (pointInPolygon(lon, lat, poly)) return true;
    }
  }
  return false;
}

console.log('Loading districts...');
const geo = JSON.parse(fs.readFileSync(DISTRICTS, 'utf8'));
console.log(`  ${geo.features.length} features`);

// Build a flat list of [feature, simplified bbox] for early reject
const districtIndex = geo.features.map(f => {
  const coords = [];
  const walk = (c) => {
    if (typeof c[0] === 'number') coords.push(c);
    else c.forEach(walk);
  };
  walk(f.geometry.coordinates);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { feature: f, bbox: [minX, minY, maxX, maxY] };
});

console.log('Loading seizures...');
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const seizures = data.seizures.filter(s =>
  typeof s.lat === 'number' && typeof s.lon === 'number' && s.lat !== 0 && s.lon !== 0
);
console.log(`  ${seizures.length} with coords`);

const byDistrict = {};
const byState = {};
const unmatchedSamples = [];

// Build state → districts lookup (normalized state name) for fast city matching
const districtsByState = {};
for (const d of districtIndex) {
  const stateName = d.feature.properties.NAME_1;
  if (!districtsByState[stateName]) districtsByState[stateName] = [];
  districtsByState[stateName].push(d);
}

let matchedByCoord = 0;
let matchedByName = 0;
let unmatched = 0;
const unmatchedReasons = { noStateMatch: 0, noCityMatch: 0, stateIndia: 0 };

const INDIA_CENTER = { lat: 20.5937, lon: 78.9629 };
const isBadCoord = (s) => Math.abs(s.lat - INDIA_CENTER.lat) < 0.001 && Math.abs(s.lon - INDIA_CENTER.lon) < 0.001;

for (const s of seizures) {
  const lon = s.lon, lat = s.lat;
  const stateAlias = STATE_ALIASES[s.state] || s.state;
  let hit = null;

  // 1) Try point-in-polygon if coords are real
  if (!isBadCoord(s)) {
    for (const d of districtIndex) {
      const [minX, minY, maxX, maxY] = d.bbox;
      if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue;
      if (pointInFeature(lon, lat, d.feature)) { hit = d; break; }
    }
    if (hit) matchedByCoord++;
  }

  // 2) Fall back to city-name → district within the (normalized) state
  if (!hit && stateAlias && stateAlias !== 'India') {
    const stateDistricts = districtsByState[stateAlias] || [];
    const normCity = normalizeCity(s.city);
    const aliasCity = CITY_ALIASES[normCity] || normCity;
    if (normCity && normCity !== 'unknown' && normCity !== 'india' && !normCity.startsWith('india ')) {
      // exact match
      hit = stateDistricts.find(d => normalizeCity(d.feature.properties.NAME_2) === aliasCity);
      // contains match
      if (!hit) {
        hit = stateDistricts.find(d => {
          const nd = normalizeCity(d.feature.properties.NAME_2);
          return nd.includes(aliasCity) || aliasCity.includes(nd);
        });
      }
      if (hit) matchedByName++;
    }
  }

  // 3) If still no hit, but state is real, roll up to state only
  if (!hit) {
    if (stateAlias === 'India' || !stateAlias) {
      unmatched++;
      unmatchedReasons.stateIndia++;
      continue;
    }
    unmatched++;
    if (!byState[stateAlias]) byState[stateAlias] = { count: 0, totalKg: 0, drugs: {} };
    byState[stateAlias].count += 1;
    byState[stateAlias].totalKg += s.quantityKg || 0;
    byState[stateAlias].drugs[s.drugType] = (byState[stateAlias].drugs[s.drugType] || 0) + 1;
    continue;
  }

  // Record district match
  const p = hit.feature.properties;
  const key = `${p.NAME_2}|${p.NAME_1}`;
  if (!byDistrict[key]) {
    byDistrict[key] = {
      district: p.NAME_2,
      state: p.NAME_1,
      stateKey: stateAlias,
      count: 0,
      totalKg: 0,
      drugs: {},
    };
  }
  byDistrict[key].count += 1;
  byDistrict[key].totalKg += s.quantityKg || 0;
  byDistrict[key].drugs[s.drugType] = (byDistrict[key].drugs[s.drugType] || 0) + 1;

  if (!byState[stateAlias]) byState[stateAlias] = { count: 0, totalKg: 0, drugs: {} };
  byState[stateAlias].count += 1;
  byState[stateAlias].totalKg += s.quantityKg || 0;
  byState[stateAlias].drugs[s.drugType] = (byState[stateAlias].drugs[s.drugType] || 0) + 1;
}

console.log(`Matched by coord: ${matchedByCoord}`);
console.log(`Matched by name:  ${matchedByName}`);
console.log(`Total district matches: ${matchedByCoord + matchedByName}/${seizures.length}`);
console.log(`State-only (no district): ${Object.values(byState).reduce((s, v) => s + (byDistrict[`${Object.keys(byDistrict).find(k => byDistrict[k].stateKey === v && 0)]?.count ?? 0), 0)}`);
console.log(`Truly unmatched: ${unmatched}`);

if (unmatchedSamples.length) {
  console.log('\nFirst 5 unmatched:');
  unmatchedSamples.slice(0, 5).forEach(u => console.log(`  ${u.id}  ${u.city}, ${u.state}  (${u.lat}, ${u.lon})`));
}

const out = {
  generatedAt: new Date().toISOString(),
  matchedByCoord,
  matchedByName,
  unmatched,
  unmatchedReasons,
  byDistrict,
  byState,
};
fs.writeFileSync(OUT, JSON.stringify(out));
const size = fs.statSync(OUT).size;
console.log(`\nWrote ${OUT}  (${(size/1024).toFixed(1)}KB)`);
console.log(`Districts with seizures: ${Object.keys(byDistrict).length}`);
console.log(`States with seizures:    ${Object.keys(byState).length}`);

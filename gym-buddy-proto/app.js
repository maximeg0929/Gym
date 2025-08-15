// Simple SPA router and state
const routes = ["home", "search", "chat", "profile", "onboarding", "auth"];
const viewRoot = () => document.getElementById("view-root");
const toastEl = () => document.getElementById("toast");

function showToast(message) {
  const el = toastEl();
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

// Persistent local state
const STORAGE_KEY = "gym-buddy-proto";
const defaultState = {
  me: null,
  users: [],
  gyms: [],
  gymChains: [],
  swipes: [],
  chats: [],
  matches: [],
  ui: { listMode: false, profileEdit: false },
  accounts: [],
  auth: { currentUserId: null },
};

// FR regions & departments (subset)
const FR_REGIONS = [
  { code: "IDF", name: "Île-de-France" },
  { code: "ARA", name: "Auvergne-Rhône-Alpes" },
  { code: "PAC", name: "Provence-Alpes-Côte d'Azur" },
  { code: "NAQ", name: "Nouvelle-Aquitaine" },
  { code: "OCC", name: "Occitanie" },
  { code: "HDF", name: "Hauts-de-France" },
  { code: "GE", name: "Grand Est" },
  { code: "PL", name: "Pays de la Loire" },
  { code: "BRE", name: "Bretagne" },
];
const FR_DEPARTMENTS = {
  IDF: [ { code: "75", name: "Paris" }, { code: "92", name: "Hauts-de-Seine" }, { code: "93", name: "Seine-Saint-Denis" }, { code: "94", name: "Val-de-Marne" }, { code: "91", name: "Essonne" }, { code: "78", name: "Yvelines" } ],
  ARA: [ { code: "69", name: "Rhône" }, { code: "38", name: "Isère" }, { code: "73", name: "Savoie" } ],
  PAC: [ { code: "13", name: "Bouches-du-Rhône" }, { code: "06", name: "Alpes-Maritimes" } ],
  NAQ: [ { code: "33", name: "Gironde" } ],
  OCC: [ { code: "31", name: "Haute-Garonne" } ],
  HDF: [ { code: "59", name: "Nord" } ],
  GE:  [ { code: "67", name: "Bas-Rhin" } ],
  PL:  [ { code: "44", name: "Loire-Atlantique" } ],
  BRE: [ { code: "35", name: "Ille-et-Vilaine" } ],
};

// Dynamic Geo API cache and loaders
const geoCache = { regions: null, departmentsByRegion: {}, citiesByDept: {} };
async function fetchRegions() {
  if (geoCache.regions) return geoCache.regions;
  try {
    const res = await fetch('https://geo.api.gouv.fr/regions?fields=code,nom');
    const list = await res.json();
    geoCache.regions = list.map(r => ({ code: r.code, name: r.nom }));
  } catch (e) {
    geoCache.regions = FR_REGIONS; // fallback subset
  }
  return geoCache.regions;
}
async function fetchDepartments(regionCode) {
  if (!regionCode) return [];
  if (geoCache.departmentsByRegion[regionCode]) return geoCache.departmentsByRegion[regionCode];
  try {
    const res = await fetch(`https://geo.api.gouv.fr/regions/${regionCode}/departements?fields=code,nom`);
    const list = await res.json();
    geoCache.departmentsByRegion[regionCode] = list.map(d => ({ code: d.code, name: d.nom }));
  } catch (e) {
    geoCache.departmentsByRegion[regionCode] = FR_DEPARTMENTS[regionCode] || [];
  }
  return geoCache.departmentsByRegion[regionCode];
}
async function fetchCities(departmentCode) {
  if (!departmentCode) return [];
  if (geoCache.citiesByDept[departmentCode]) return geoCache.citiesByDept[departmentCode];
  try {
    const res = await fetch(`https://geo.api.gouv.fr/departements/${departmentCode}/communes?fields=nom&format=json`);
    const list = await res.json();
    geoCache.citiesByDept[departmentCode] = list.map(c => c.nom).sort((a,b)=>a.localeCompare(b));
  } catch (e) {
    // fallback: infer from gyms
    const cities = Array.from(new Set(state.gyms.filter(g => g.departmentCode === departmentCode).map(g => g.city))).sort((a,b)=>a.localeCompare(b));
    geoCache.citiesByDept[departmentCode] = cities;
  }
  return geoCache.citiesByDept[departmentCode];
}
function setupGeoCascade(prefix, { initial = {}, onChange } = {}) {
  const regionSel = document.getElementById(`${prefix}-region`);
  const deptSel = document.getElementById(`${prefix}-dept`);
  const citySel = document.getElementById(`${prefix}-city`);
  const regionSearch = document.getElementById(`${prefix}-region-search`);
  const deptSearch = document.getElementById(`${prefix}-dept-search`);
  const citySearch = document.getElementById(`${prefix}-city-search`);
  if (!regionSel || !deptSel || !citySel) return;

  let regionsList = [];
  let depsList = [];
  let citiesList = [];

  const renderRegions = () => {
    const q = normalizeText(regionSearch?.value || '');
    const arr = q ? regionsList.filter(r => normalizeText(`${r.name} ${r.code}`).includes(q)) : regionsList;
    regionSel.innerHTML = `<option value="">Région</option>` + arr.map(r=>`<option value="${r.code}">${r.name}</option>`).join('');
    if (initial.regionCode && arr.some(r=>r.code===initial.regionCode)) regionSel.value = initial.regionCode;
  };
  const renderDepts = () => {
    const q = normalizeText(deptSearch?.value || '');
    const arr = q ? depsList.filter(d => normalizeText(`${d.name} ${d.code}`).includes(q)) : depsList;
    deptSel.innerHTML = `<option value="">Département</option>` + arr.map(d=>`<option value="${d.code}">${d.name}</option>`).join('');
    deptSel.disabled = !(regionSel.value);
    if (initial.departmentCode && arr.some(d=>d.code===initial.departmentCode)) deptSel.value = initial.departmentCode;
  };
  const renderCities = () => {
    const q = normalizeText(citySearch?.value || '');
    const arr = q ? citiesList.filter(c => normalizeText(c).includes(q)) : citiesList;
    citySel.innerHTML = `<option value="">Ville</option>` + arr.map(c=>`<option value="${c}">${c}</option>`).join('');
    citySel.disabled = !(deptSel.value) || arr.length===0;
    if (initial.city && arr.includes(initial.city)) citySel.value = initial.city;
    if (typeof onChange === 'function') onChange();
  };

  fetchRegions().then(regions => {
    regionsList = regions;
    renderRegions();
    const loadDepts = () => {
      const rc = regionSel.value;
      fetchDepartments(rc).then(deps => { depsList = deps; renderDepts(); loadCities(); });
    };
    const loadCities = () => {
      const dc = deptSel.value;
      fetchCities(dc).then(cities => { citiesList = cities; renderCities(); });
    };
    regionSel.addEventListener('change', () => { initial.departmentCode = null; initial.city = null; loadDepts(); });
    deptSel.addEventListener('change', () => { initial.city = null; loadCities(); });
    regionSearch?.addEventListener('input', renderRegions);
    deptSearch?.addEventListener('input', renderDepts);
    citySearch?.addEventListener('input', renderCities);
    loadDepts();
  });
}

function setupRegionDept(regionSelectId, deptSelectId, initialRegion, initialDept) {
  const rSel = document.getElementById(regionSelectId);
  const dSel = document.getElementById(deptSelectId);
  if (!rSel || !dSel) return;
  rSel.innerHTML = `<option value="">Région</option>` + FR_REGIONS.map(r=>`<option value="${r.code}">${r.name}</option>`).join('');
  if (initialRegion) rSel.value = initialRegion;
  const refreshDepts = () => {
    const code = rSel.value;
    const list = FR_DEPARTMENTS[code] || [];
    dSel.innerHTML = `<option value="">Département</option>` + list.map(d=>`<option value="${d.code}">${d.name}</option>`).join('');
    dSel.disabled = !code;
    if (initialDept && code && list.some(d=>d.code===initialDept)) dSel.value = initialDept;
  };
  rSel.addEventListener('change', () => { initialDept = null; refreshDepts(); });
  refreshDepts();
}

// Gym cascade helpers
function getFilteredGyms({ chainId, regionCode, departmentCode, city }) {
  return state.gyms.filter(g =>
    (!chainId || g.chainId === chainId) &&
    (!regionCode || g.regionCode === regionCode) &&
    (!departmentCode || g.departmentCode === departmentCode) &&
    (!city || g.city === city)
  );
}
function getCitiesFor(regionCode, departmentCode, chainId) {
  const gyms = getFilteredGyms({ chainId, regionCode, departmentCode });
  return Array.from(new Set(gyms.map(g => g.city))).sort((a,b)=>a.localeCompare(b));
}
function setupGymCascade(prefix, { multipleGyms = false, initial = {} } = {}) {
  const chainSel = document.getElementById(`${prefix}-chain`);
  const regionSel = document.getElementById(`${prefix}-region`);
  const deptSel = document.getElementById(`${prefix}-dept`);
  const citySel = document.getElementById(`${prefix}-city`);
  const gymSel = document.getElementById(`${prefix}-gym`);
  if (!chainSel || !regionSel || !deptSel || !citySel || !gymSel) return;

  chainSel.innerHTML = `<option value="">Toutes marques</option>` + state.gymChains.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if (initial.chainId) chainSel.value = initial.chainId;

  const refreshGyms = () => {
    const gyms = getFilteredGyms({ chainId: chainSel.value || '', regionCode: regionSel.value || '', departmentCode: deptSel.value || '', city: citySel.value || '' });
    gymSel.innerHTML = (multipleGyms ? '' : `<option value="">${gyms.length? 'Toutes salles' : 'Aucune salle'}</option>`) + gyms.map(g=>`<option value="${g.id}">${g.name} — ${g.city}</option>`).join('');
    gymSel.disabled = gyms.length === 0;
    if (multipleGyms && Array.isArray(initial.gymIds)) {
      Array.from(gymSel.options).forEach(o => { o.selected = initial.gymIds.includes(o.value); });
    } else if (!multipleGyms && initial.gymId) {
      gymSel.value = initial.gymId;
    }
  };

  setupGeoCascade(prefix, { initial: { regionCode: initial.regionCode || '', departmentCode: initial.departmentCode || '', city: initial.city || '' }, onChange: refreshGyms });
  chainSel.addEventListener('change', refreshGyms);
  // initial fill
  refreshGyms();
}

let state = loadState();
if (!state || !state.gyms?.length) {
  state = seed();
  saveState();
}
// Migrate older state to support accounts/auth
if (!state.accounts || !Array.isArray(state.accounts)) {
  state.accounts = [];
  if (state.me) {
    const existing = { ...state.me };
    if (!existing.email) existing.email = `user${Date.now()}@example.com`;
    state.accounts.push(existing);
    state.auth = { currentUserId: existing.id };
  } else {
    state.auth = { currentUserId: null };
  }
  saveState();
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) { return null; }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setLoggedInUserById(userId) {
  const acct = state.accounts.find(a => a.id === userId);
  state.me = acct ? { ...acct } : null;
  state.auth = { currentUserId: acct ? acct.id : null };
  saveState();
}

function syncAccountWithMe() {
  if (!state.me) return;
  const idx = state.accounts.findIndex(a => a.id === state.me.id);
  if (idx >= 0) {
    state.accounts[idx] = { ...state.accounts[idx], ...state.me };
    saveState();
  }
}

// Seed data: chains, gyms, users
function seed() {
  const gymChains = [
    { id: "chain_basicfit", name: "Basic-Fit" },
    { id: "chain_fitnesspark", name: "Fitness Park" },
    { id: "chain_neoness", name: "Neoness" },
    { id: "chain_keepcool", name: "Keepcool" },
    { id: "chain_orange_bleue", name: "L'Orange Bleue" },
    { id: "chain_lappart", name: "L'Appart Fitness" },
    { id: "chain_magic_form", name: "Magic Form" },
    { id: "chain_amazonia", name: "Amazonia" },
    { id: "chain_cercles_forme", name: "Cercles de la Forme" },
    { id: "chain_wellness", name: "Wellness Sport Club" },
    { id: "chain_vita_liberte", name: "Vita Liberté" },
  ];
  const gyms = [
    // IDF - Paris (75)
    { id: "gym_bf_bastille", chainId: "chain_basicfit", name: "Basic-Fit Bastille", regionCode: "IDF", departmentCode: "75", city: "Paris", lat: 48.853, lon: 2.369 },
    { id: "gym_bf_montparnasse", chainId: "chain_basicfit", name: "Basic-Fit Montparnasse", regionCode: "IDF", departmentCode: "75", city: "Paris", lat: 48.842, lon: 2.321 },
    { id: "gym_fp_republique", chainId: "chain_fitnesspark", name: "Fitness Park République", regionCode: "IDF", departmentCode: "75", city: "Paris", lat: 48.867, lon: 2.364 },
    { id: "gym_neoness_bourse", chainId: "chain_neoness", name: "Neoness Bourse", regionCode: "IDF", departmentCode: "75", city: "Paris", lat: 48.868, lon: 2.341 },
    { id: "gym_keepcool_lazare", chainId: "chain_keepcool", name: "Keepcool Saint-Lazare", regionCode: "IDF", departmentCode: "75", city: "Paris", lat: 48.876, lon: 2.325 },
    { id: "gym_cercles_diderot", chainId: "chain_cercles_forme", name: "Cercles de la Forme Diderot", regionCode: "IDF", departmentCode: "75", city: "Paris", lat: 48.842, lon: 2.386 },
    // ARA - Lyon (69)
    { id: "gym_fp_partdieu", chainId: "chain_fitnesspark", name: "Fitness Park Part-Dieu", regionCode: "ARA", departmentCode: "69", city: "Lyon", lat: 45.760, lon: 4.861 },
    { id: "gym_lappart_bellecour", chainId: "chain_lappart", name: "L'Appart Fitness Bellecour", regionCode: "ARA", departmentCode: "69", city: "Lyon", lat: 45.757, lon: 4.835 },
    { id: "gym_bf_vaise", chainId: "chain_basicfit", name: "Basic-Fit Vaise", regionCode: "ARA", departmentCode: "69", city: "Lyon", lat: 45.780, lon: 4.805 },
    { id: "gym_wellness_lyon", chainId: "chain_wellness", name: "Wellness Sport Club Lyon", regionCode: "ARA", departmentCode: "69", city: "Lyon", lat: 45.757, lon: 4.845 },
    { id: "gym_orange_villeurbanne", chainId: "chain_orange_bleue", name: "L'Orange Bleue Villeurbanne", regionCode: "ARA", departmentCode: "69", city: "Villeurbanne", lat: 45.770, lon: 4.880 },
    // PAC - Marseille (13)
    { id: "gym_keepcool_prado", chainId: "chain_keepcool", name: "Keepcool Prado", regionCode: "PAC", departmentCode: "13", city: "Marseille", lat: 43.273, lon: 5.394 },
    { id: "gym_bf_joliette", chainId: "chain_basicfit", name: "Basic-Fit La Joliette", regionCode: "PAC", departmentCode: "13", city: "Marseille", lat: 43.309, lon: 5.369 },
    { id: "gym_vita_marseille", chainId: "chain_vita_liberte", name: "Vita Liberté Marseille", regionCode: "PAC", departmentCode: "13", city: "Marseille", lat: 43.296, lon: 5.370 },
    // NAQ - Bordeaux (33)
    { id: "gym_magic_bordeaux", chainId: "chain_magic_form", name: "Magic Form Bordeaux", regionCode: "NAQ", departmentCode: "33", city: "Bordeaux", lat: 44.837, lon: -0.579 },
    { id: "gym_amazonia_bordeaux", chainId: "chain_amazonia", name: "Amazonia Bordeaux", regionCode: "NAQ", departmentCode: "33", city: "Bordeaux", lat: 44.840, lon: -0.580 },
    // OCC - Toulouse (31)
    { id: "gym_fp_blagnac", chainId: "chain_fitnesspark", name: "Fitness Park Blagnac", regionCode: "OCC", departmentCode: "31", city: "Toulouse", lat: 43.629, lon: 1.363 },
    { id: "gym_keepcool_capitole", chainId: "chain_keepcool", name: "Keepcool Capitole", regionCode: "OCC", departmentCode: "31", city: "Toulouse", lat: 43.604, lon: 1.444 },
    // HDF - Lille (59)
    { id: "gym_bf_lille", chainId: "chain_basicfit", name: "Basic-Fit Lille Centre", regionCode: "HDF", departmentCode: "59", city: "Lille", lat: 50.631, lon: 3.058 },
    // BRE - Rennes (35)
    { id: "gym_orange_rennes", chainId: "chain_orange_bleue", name: "L'Orange Bleue Rennes", regionCode: "BRE", departmentCode: "35", city: "Rennes", lat: 48.117, lon: -1.677 },
    // PL - Nantes (44)
    { id: "gym_bf_nantes", chainId: "chain_basicfit", name: "Basic-Fit Nantes Centre", regionCode: "PL", departmentCode: "44", city: "Nantes", lat: 47.218, lon: -1.553 },
    // GE - Strasbourg (67)
    { id: "gym_fp_strasbourg", chainId: "chain_fitnesspark", name: "Fitness Park Strasbourg", regionCode: "GE", departmentCode: "67", city: "Strasbourg", lat: 48.583, lon: 7.745 },
  ];

  const demoUsers = generateDemoUsers(gyms);
  const me = {
    id: "me",
    name: "Alex",
    photoUrl: avatar("Alex"),
    level: 1,
    goal: "Hypertrophie",
    favorites: [gyms[0].id, gyms[2].id],
    availabilityMask: generateRandomWeekMask(0.35),
    bio: "Motivé pour progresser en force et hypertrophie. Bench day addict.",
    email: "alex@example.com",
    regionCode: "IDF",
    departmentCode: "75",
    city: "Paris",
    birthDate: "1995-01-01",
  };
  return {
    ...structuredClone(defaultState),
    me,
    users: demoUsers,
    gyms,
    gymChains,
    swipes: [],
    chats: [],
    matches: [],
    accounts: [ { ...me, password: "demo123" } ],
    auth: { currentUserId: me.id },
  };
}

function avatar(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
}

function randomRegionDeptCity(gyms) {
  const g = sample(gyms);
  return { regionCode: g.regionCode, departmentCode: g.departmentCode, city: g.city };
}

function generateDemoUsers(gyms) {
  const names = [
    "Léa", "Maxime", "Sofia", "Yann", "Camille", "Nina", "Rayan", "Eva", "Mehdi", "Zoé",
    "Thomas", "Sarah", "Antoine", "Noah", "Maya", "Hugo", "Lola", "Adam", "Chloé", "Lucas",
  ];
  const goals = ["Force", "Hypertrophie", "Perte de poids", "Endurance"];
  return names.map((n, idx) => {
    const level = Math.floor(Math.random() * 4);
    const favorites = [sample(gyms).id];
    if (Math.random() > 0.6) favorites.push(sample(gyms).id);
    const loc = randomRegionDeptCity(gyms);
    return {
      id: "u_" + idx,
      name: n,
      photoUrl: avatar(n),
      level,
      goal: sample(goals),
      favorites: Array.from(new Set(favorites)),
      availabilityMask: generateRandomWeekMask(randomBetween(0.2, 0.6)),
      bio: genBio(level),
      regionCode: loc.regionCode,
      departmentCode: loc.departmentCode,
      city: loc.city,
      birthDate: randomBirthDateISO(),
    };
  });
}

function genBio(level) {
  const map = {
    0: "Je débute, motivé(e) pour apprendre les bases.",
    1: "Régulier(ère), objectif recomposition corporelle.",
    2: "Avancé(e), split push/pull/legs, focus progression.",
    3: "Prépa compétition, rigueur et intensité.",
  };
  return map[level] || map[1];
}

function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomBetween(min, max) { return Math.random() * (max - min) + min; }
function randomBirthDateISO(minAge = 18, maxAge = 55) {
  const now = new Date();
  const age = Math.floor(randomBetween(minAge, maxAge + 1));
  const year = now.getFullYear() - age;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  const d = new Date(year, month, day);
  return d.toISOString().slice(0, 10);
}
function calculateAge(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
function ageLabel(user) {
  const a = calculateAge(user?.birthDate);
  return a != null ? `${a} ans` : "Âge —";
}
function normalizeText(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Availability bitmask helpers (7 days x 48 half-hours = 336 bits)
function generateRandomWeekMask(fillRatio = 0.3) {
  const bits = Array.from({ length: 336 }, () => Math.random() < fillRatio ? 1 : 0);
  return bitsToBase64(bits);
}
function bitsToBase64(bits) {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => { if (b) bytes[Math.floor(i / 8)] |= (1 << (i % 8)); });
  return btoa(String.fromCharCode(...bytes));
}
function base64ToBits(b64, length = 336) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  const bits = [];
  for (let i = 0; i < length; i++) {
    const byte = bytes[Math.floor(i / 8)] || 0;
    bits.push((byte >> (i % 8)) & 1);
  }
  return bits;
}
function jaccardFromMasks(aB64, bB64) {
  const a = base64ToBits(aB64); const b = base64ToBits(bB64); let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { const ai = a[i], bi = b[i]; inter += (ai & bi); uni += (ai | bi); }
  return uni === 0 ? 0 : inter / uni;
}

// Distance helper (approx) in km
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number' || Number.isNaN(v))) return 10;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function gymScore(userA, userB) {
  const gyms = state.gyms;
  const favoritesA = userA.favorites.map(id => gyms.find(g => g.id === id)).filter(Boolean);
  const favoritesB = userB.favorites.map(id => gyms.find(g => g.id === id)).filter(Boolean);
  let best = 0;
  for (const ga of favoritesA) {
    for (const gb of favoritesB) {
      const sameGym = ga.id === gb.id;
      const sameCity = ga.city === gb.city;
      const sameDept = ga.departmentCode === gb.departmentCode;
      const sameChain = ga.chainId === gb.chainId;
      const dist = haversineKm(ga.lat, ga.lon, gb.lat, gb.lon);
      let s = 0;
      if (sameGym) s = 1.0;
      else if (sameCity && sameChain) s = 0.9;
      else if (sameCity) s = 0.75;
      else if (sameDept && sameChain) s = 0.7;
      else if (sameDept) s = 0.55;
      else if (sameChain) s = Math.min(0.8, Math.max(0, 1 - dist / 10));
      else s = Math.min(0.5, Math.max(0, 1 - dist / 10));
      best = Math.max(best, s);
    }
  }
  // If no favorites overlap info, fallback to city/department from profile
  if (best === 0 && userA.city && userB.city) {
    if (userA.city === userB.city) best = 0.6;
    else if (userA.departmentCode && userA.departmentCode === userB.departmentCode) best = 0.45;
  }
  return best;
}

function levelScore(a, b) {
  const diff = Math.abs((a?.level ?? 1) - (b?.level ?? 1));
  const table = [1.0, 0.66, 0.33, 0.0];
  return table[Math.min(diff, 3)];
}

function matchScore(a, b) {
  const schedule = jaccardFromMasks(a.availabilityMask, b.availabilityMask);
  const gym = gymScore(a, b); // incorporates city & department
  const level = levelScore(a, b);
  return 0.4 * schedule + 0.4 * gym + 0.2 * level;
}

function getRecommendations(limit = 20) {
  const me = state.me;
  const seen = new Set(state.swipes.filter(s => s.swiperId === me.id).map(s => s.targetId));
  return state.users
    .filter(u => u.id !== me.id && !seen.has(u.id))
    .map(u => ({ user: u, score: matchScore(me, u) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Router
function setRoute(route) {
  if (!state.me && route !== "auth" && route !== "onboarding") route = "auth";
  for (const btn of document.querySelectorAll('.tab-btn')) btn.classList.toggle('active', btn.dataset.route === route);
  if (route === "onboarding") renderOnboarding();
  else if (route === "home") renderHome();
  else if (route === "search") renderSearch();
  else if (route === "chat") renderChat();
  else if (route === "profile") renderProfile();
  else if (route === "auth") renderAuth();
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => setRoute(btn.dataset.route)));
}

// Views
function renderOnboarding() {
  const me = state.me;
  const levels = ["Débutant", "Intermédiaire", "Avancé", "Compétition"];
  const goals = ["Force", "Hypertrophie", "Perte de poids", "Endurance"];

  viewRoot().innerHTML = `
    <div class="section">
      <div class="h1">Onboarding</div>
      <div class="stepper">${[0,1,2,3,4].map(i => `<div class="dot ${i<5?'':'active'}"></div>`).join('')}</div>
    </div>

    <div class="card grid">
      <div>
        <label>Nom</label>
        <input id="name" class="input" placeholder="Votre prénom" value="${me?.name ?? ''}" />
      </div>
      <div>
        <label>Date de naissance</label>
        <input id="onb-birth" type="date" class="input" value="${me?.birthDate ? me.birthDate.slice(0,10) : ''}" />
        <div class="muted" id="onb-age" style="margin-top:6px">${ageLabel(me)}</div>
      </div>
      <div>
        <label>Niveau</label>
        <div class="choices" id="level-choices">
          ${levels.map((l,i)=>`<div data-val="${i}" class="choice ${me?.level===i?'active':''}">${l}</div>`).join('')}
        </div>
      </div>
      <div>
        <label>Objectif</label>
        <div class="choices" id="goal-choices">
          ${goals.map((g)=>`<div data-val="${g}" class="choice ${me?.goal===g?'active':''}">${g}</div>`).join('')}
        </div>
      </div>
      <div>
        <label>Sélection de salle</label>
        <div class="grid cols-2" style="align-items:end">
          <div>
            <label>Marque</label>
            <select id="onb-chain" class="input"></select>
          </div>
          <div>
            <label>Région</label>
            <input id="onb-region-search" class="input" placeholder="Rechercher une région" />
            <select id="onb-region" class="input"></select>
          </div>
          <div>
            <label>Département</label>
            <input id="onb-dept-search" class="input" placeholder="Rechercher un département" />
            <select id="onb-dept" class="input"></select>
          </div>
          <div>
            <label>Ville</label>
            <input id="onb-city-search" class="input" placeholder="Rechercher une ville" />
            <select id="onb-city" class="input"></select>
          </div>
          <div style="grid-column: 1 / -1">
            <label>Salles favorites</label>
            <select id="onb-gym" class="input" multiple size="6"></select>
          </div>
        </div>
      </div>
      <div>
        <label>Bio</label>
        <textarea id="bio" rows="3" class="input" placeholder="Parlez de vos objectifs, disponibilités..."></textarea>
      </div>
      <div>
        <button id="save-onboarding" class="btn primary full">Terminer</button>
      </div>
    </div>
  `;

  setupGymCascade('onb', { multipleGyms: true, initial: { chainId: '', regionCode: me?.regionCode, departmentCode: me?.departmentCode, city: me?.city, gymIds: me?.favorites || [] } });
  document.getElementById('onb-birth').addEventListener('change', (e)=>{
    const iso = e.target.value;
    const a = calculateAge(iso);
    document.getElementById('onb-age').textContent = a!=null? `${a} ans` : 'Âge —';
  });
  document.getElementById('level-choices').addEventListener('click', (e) => {
    const item = e.target.closest('.choice'); if (!item) return;
    document.querySelectorAll('#level-choices .choice').forEach(c=>c.classList.remove('active'));
    item.classList.add('active');
  });
  document.getElementById('goal-choices').addEventListener('click', (e) => {
    const item = e.target.closest('.choice'); if (!item) return;
    document.querySelectorAll('#goal-choices .choice').forEach(c=>c.classList.remove('active'));
    item.classList.add('active');
  });
  document.getElementById('save-onboarding').addEventListener('click', () => {
    const name = document.getElementById('name').value.trim() || 'Moi';
    const birthDate = document.getElementById('onb-birth').value || null;
    const level = parseInt(document.querySelector('#level-choices .choice.active')?.dataset.val ?? '1');
    const goal = document.querySelector('#goal-choices .choice.active')?.dataset.val ?? 'Hypertrophie';
    const favorites = Array.from(document.getElementById('onb-gym').selectedOptions).map(o=>o.value);
    const bio = document.getElementById('bio').value.trim();
    const regionCode = document.getElementById('onb-region').value || null;
    const departmentCode = document.getElementById('onb-dept').value || null;
    const city = document.getElementById('onb-city').value || null;
    state.me = { ...state.me, name, birthDate, level, goal, favorites, bio, regionCode, departmentCode, city };
    syncAccountWithMe();
    saveState();
    showToast('Profil enregistré');
    setRoute('home');
  });
}

function renderHome() {
  const recos = getRecommendations(20);
  const listMode = state.ui.listMode;
  viewRoot().innerHTML = `
    <div class="section row space-between">
      <div class="h1">Matching</div>
      <button id="toggle-mode" class="btn chip">${listMode ? 'Mode swipe' : 'Mode liste'}</button>
    </div>
    <div id="match-container"></div>
  `;
  document.getElementById('toggle-mode').addEventListener('click', () => { state.ui.listMode = !state.ui.listMode; saveState(); renderHome(); });
  const container = document.getElementById('match-container');
  if (listMode) {
    container.innerHTML = renderList(recos);
    // Bind list actions (home)
    container.querySelectorAll('[data-like]').forEach(btn => btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-like');
      state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: uid, decision: 'like', createdAt: Date.now() });
      if (Math.random() < 0.25) { state.matches.push({ id: `m_${Date.now()}`, userA: state.me.id, userB: uid, createdAt: Date.now(), active: true }); ensureChatForMatch(uid); showToast('Nouveau match !'); } else { showToast('Like envoyé'); }
      saveState();
      renderHome();
    }));
    container.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-detail');
      openProfileModal(state.users.find(u=>u.id===uid));
    }));
    container.querySelectorAll('[data-open-profile]').forEach(img => img.addEventListener('click', () => {
      const uid = img.getAttribute('data-open-profile');
      openProfileModal(state.users.find(u=>u.id===uid));
    }));
  } else {
    const deck = document.createElement('div'); deck.className = 'card swipe-deck'; container.appendChild(deck); renderSwipeDeckInto(deck, recos);
  }
}

function renderSwipeDeckInto(root, recos) {
  let index = 0;
  function draw() {
    root.innerHTML = '';
    if (index >= recos.length) { root.innerHTML = `<div class="muted" style="padding:20px">Plus de recommandations. Revenez plus tard.</div>`; return; }
    const r = recos[index];
    const el = document.createElement('div'); el.className = 'swipe-card'; el.innerHTML = matchCardHTML(r.user, r.score); root.appendChild(el);
    const like = el.querySelector('[data-like]'); const pass = el.querySelector('[data-pass]'); const detail = el.querySelector('[data-detail]');
    const photo = el.querySelector('.match-photo');
    like.addEventListener('click', () => onSwipe(r.user, 'like'));
    pass.addEventListener('click', () => onSwipe(r.user, 'pass'));
    detail.addEventListener('click', () => openProfileModal(r.user));
    photo?.addEventListener('click', () => openProfileModal(r.user));
    let startX = 0, startY = 0, dragging = false; let currentX = 0, currentY = 0;
    const onPointerDown = (e) => { dragging = true; el.classList.add('dragging'); startX = (e.touches ? e.touches[0].clientX : e.clientX); startY = (e.touches ? e.touches[0].clientY : e.clientY); };
    const onPointerMove = (e) => { if (!dragging) return; const x = (e.touches ? e.touches[0].clientX : e.clientX); const y = (e.touches ? e.touches[0].clientY : e.clientY); currentX = x - startX; currentY = y - startY; const rot = currentX / 20; const opacity = Math.max(0.6, 1 - Math.abs(currentX) / 600); el.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rot}deg)`; el.style.opacity = String(opacity); };
    const onPointerUp = () => { if (!dragging) return; dragging = false; el.classList.remove('dragging'); const threshold = 120; if (currentX > threshold) { el.style.transition = 'transform 0.25s ease, opacity 0.25s ease'; el.style.transform = `translate(500px, ${currentY}px) rotate(24deg)`; el.style.opacity = '0'; setTimeout(()=> onSwipe(r.user, 'like'), 200); } else if (currentX < -threshold) { el.style.transition = 'transform 0.25s ease, opacity 0.25s ease'; el.style.transform = `translate(-500px, ${currentY}px) rotate(-24deg)`; el.style.opacity = '0'; setTimeout(()=> onSwipe(r.user, 'pass'), 200); } else { el.style.transition = 'transform 0.2s ease, opacity 0.2s ease'; el.style.transform = 'translate(0px, 0px) rotate(0deg)'; el.style.opacity = '1'; } currentX = 0; currentY = 0; };
    el.addEventListener('mousedown', onPointerDown); window.addEventListener('mousemove', onPointerMove); window.addEventListener('mouseup', onPointerUp);
    el.addEventListener('touchstart', onPointerDown, { passive: true }); el.addEventListener('touchmove', onPointerMove, { passive: true }); el.addEventListener('touchend', onPointerUp);
  }
  function onSwipe(user, decision) {
    state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: user.id, decision, createdAt: Date.now() });
    if (decision === 'like' && Math.random() < 0.25) { state.matches.push({ id: `m_${Date.now()}`, userA: state.me.id, userB: user.id, createdAt: Date.now(), active: true }); ensureChatForMatch(user.id); showToast('Nouveau match !'); }
    saveState(); index += 1; draw();
  }
  draw();
}

function renderList(recos) {
  return `
    <div class="card list">
      ${recos.map(r => `
        <div class="item">
          <img class="avatar" src="${r.user.photoUrl}" alt="${r.user.name}" data-open-profile="${r.user.id}" />
          <div>
            <div class="row space-between">
              <div style="font-weight:700">${r.user.name}</div>
              <div class="badge">${(r.score*100).toFixed(0)}%</div>
            </div>
            <div class="muted" style="margin-top:4px">${levelLabel(r.user.level)} • ${r.user.goal} • ${r.user.city || ''} • ${ageLabel(r.user)}</div>
            <div class="pills" style="margin-top:6px">${r.user.favorites.map(fid => gymPill(fid)).join('')}</div>
          </div>
          <div class="grid">
            <button class="btn success" data-like="${r.user.id}">Like</button>
            <button class="btn" data-detail="${r.user.id}">Voir</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function levelLabel(level) { return ["Débutant","Intermédiaire","Avancé","Compétition"][level] ?? "Intermédiaire"; }
function gymPill(gymId) { const g = state.gyms.find(x => x.id === gymId); if (!g) return ''; return `<span class="badge">${g.name.split(' ')[0]} • ${g.city}</span>`; }

function matchCardHTML(user, score) {
  const pills = [`<span class=\"badge\">${levelLabel(user.level)}</span>`, `<span class=\"badge\">${user.goal}</span>`, `<span class=\"badge\">${ageLabel(user)}</span>`, ...user.favorites.map(fid => gymPill(fid))].join('');
  return `
    <div class="match-card">
      <img class="match-photo" src="${user.photoUrl}" alt="${user.name}" />
      <div class="row space-between" style="margin-top:8px">
        <div style="font-size:18px; font-weight:800">${user.name}</div>
        <div class="badge">${(score*100).toFixed(0)}%</div>
      </div>
      <div class="pills">${pills}</div>
      <div class="actions">
        <button class="btn danger" data-pass>Pass</button>
        <button class="btn" data-detail>Voir</button>
        <button class="btn success" data-like>Like</button>
      </div>
    </div>
  `;
}

function openProfileModal(user) {
  const html = `
    <div class="card" style="position:fixed; inset: 8% 8% auto 8%; z-index: 20; background: var(--bg-2)">
      <div class="row space-between">
        <div class="h1">${user.name}</div>
        <button class="btn" id="close-modal">Fermer</button>
      </div>
      <img class="match-photo" src="${user.photoUrl}" />
      <div class="pills" style="margin-top:8px">${[ `<span class='badge'>${levelLabel(user.level)}</span>`, `<span class='badge'>${user.goal}</span>`, `<span class='badge'>${ageLabel(user)}</span>`, ...user.favorites.map(gymPill) ].join('')}</div>
      <div class="section">
        <div class="h2">Bio</div>
        <div class="muted">${user.bio}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn success" id="like-from-modal">Like</button>
        <button class="btn" id="message-user">Message</button>
        <button class="btn" id="propose-session">Planifier</button>
      </div>
    </div>
  `;
  const container = document.createElement('div'); container.innerHTML = html; document.body.appendChild(container);
  document.getElementById('close-modal').onclick = () => container.remove();
  document.getElementById('like-from-modal').onclick = () => { state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: user.id, decision: 'like', createdAt: Date.now() }); saveState(); showToast('Like envoyé'); };
  document.getElementById('message-user').onclick = () => { startChatWith(user); container.remove(); };
  document.getElementById('propose-session').onclick = () => { ensureChatForMatch(user.id); openPlanner(user); };
}

function ensureChatForMatch(userId) {
  let match = state.matches.find(m => (m.userA===state.me.id && m.userB===userId) || (m.userB===state.me.id && m.userA===userId));
  if (!match) { match = { id: `m_${Date.now()}`, userA: state.me.id, userB: userId, createdAt: Date.now(), active: true }; state.matches.push(match); }
  let chat = state.chats.find(c => c.matchId === match.id);
  if (!chat) { chat = { id: `c_${Date.now()}`, matchId: match.id }; state.chats.push(chat); }
  saveState();
  return chat;
}

function renderSearch() {
  viewRoot().innerHTML = `
    <div class="section h1">Recherche / Filtres</div>
    <div class="card grid">
      <div class="grid cols-3">
        <div>
          <label>Niveau</label>
          <select id="f-level" class="input">
            <option value="">Tous</option>
            <option value="0">Débutant</option>
            <option value="1">Intermédiaire</option>
            <option value="2">Avancé</option>
            <option value="3">Compétition</option>
          </select>
        </div>
        <div>
          <label>Jour</label>
          <select id="f-day" class="input">
            ${["Tous","Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d,i)=>`<option value="${i-1}">${d}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Précision (quartier, rue...)</label>
          <input id="f-precision" class="input" placeholder="Ex: République, Bellecour, Joliette..." />
        </div>
      </div>
      <div>
        <label>Salle</label>
        <div class="grid cols-2" style="align-items:end">
          <div>
            <label>Marque</label>
            <select id="f-chain" class="input"></select>
          </div>
          <div>
            <label>Région</label>
            <input id="f-region-search" class="input" placeholder="Rechercher une région" />
            <select id="f-region" class="input"></select>
          </div>
          <div>
            <label>Département</label>
            <input id="f-dept-search" class="input" placeholder="Rechercher un département" />
            <select id="f-dept" class="input"></select>
          </div>
          <div>
            <label>Ville</label>
            <input id="f-city-search" class="input" placeholder="Rechercher une ville" />
            <select id="f-city" class="input"></select>
          </div>
        </div>
      </div>
      <div>
        <button id="apply-filters" class="btn primary">Appliquer</button>
      </div>
    </div>
    <div id="results"></div>
  `;

  // Fill chain and geo (without specific gym dropdown)
  const chainSel = document.getElementById('f-chain');
  chainSel.innerHTML = `<option value="">Toutes marques</option>` + state.gymChains.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  setupGeoCascade('f', { initial: {}, onChange: ()=>{} });

  document.getElementById('apply-filters').addEventListener('click', () => {
    const level = document.getElementById('f-level').value;
    const day = parseInt(document.getElementById('f-day').value);
    const chainId = document.getElementById('f-chain').value;
    const regionCode = document.getElementById('f-region').value;
    const departmentCode = document.getElementById('f-dept').value;
    const city = document.getElementById('f-city').value;
    const precision = normalizeText(document.getElementById('f-precision').value);
    const items = state.users.filter(u => {
      if (level !== '' && parseInt(level) !== u.level) return false;
      if (regionCode && u.regionCode !== regionCode) return false;
      if (departmentCode && u.departmentCode !== departmentCode) return false;
      if (city && u.city !== city) return false;
      if (chainId) {
        const hasChain = state.gyms.some(g => u.favorites.includes(g.id) && g.chainId === chainId);
        if (!hasChain) return false;
      }
      if (precision) {
        const ok = state.gyms.some(g => u.favorites.includes(g.id) && normalizeText(`${g.name} ${g.city}`).includes(precision));
        if (!ok) return false;
      }
      if (day >= 0) {
        const bits = base64ToBits(u.availabilityMask);
        const hasDay = bits.slice(day*48, (day+1)*48).some(b=>b===1);
        if (!hasDay) return false;
      }
      return true;
    }).map(u => ({ user: u, score: matchScore(state.me, u) }))
      .sort((a,b)=>b.score-a.score);
    document.getElementById('results').innerHTML = renderList(items);
    document.querySelectorAll('[data-like]').forEach(btn => btn.addEventListener('click', () => { const uid = btn.getAttribute('data-like'); state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: uid, decision: 'like', createdAt: Date.now() }); saveState(); showToast('Like envoyé'); }));
    document.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => { const uid = btn.getAttribute('data-detail'); openProfileModal(state.users.find(u=>u.id===uid)); }));
    document.querySelectorAll('[data-open-profile]').forEach(img => img.addEventListener('click', () => { const uid = img.getAttribute('data-open-profile'); openProfileModal(state.users.find(u=>u.id===uid)); }));
  });
}

function renderChat() {
  const myMatches = state.matches.filter(m => m.active && (m.userA===state.me.id || m.userB===state.me.id));
  const items = myMatches.map(m => { const partnerId = m.userA===state.me.id ? m.userB : m.userA; const partner = state.users.find(u => u.id === partnerId) || state.me; return { match: m, partner }; });
  viewRoot().innerHTML = `
    <div class="section h1">Chat</div>
    <div class="card chat-list">
      ${items.length===0 ? '<div class="muted" style="padding:16px">Aucun match pour le moment.</div>' : items.map(it => `
        <div class="convo">
          <img class="avatar" src="${it.partner.photoUrl}" />
          <div>
            <div style="font-weight:700">${it.partner.name}</div>
            <div class="muted" style="font-size:12px">${levelLabel(it.partner.level)} • ${it.partner.goal}</div>
          </div>
          <button class="btn" data-open-chat="${it.match.id}">Ouvrir</button>
        </div>
      `).join('')}
    </div>
    <div id="chat-room"></div>
  `;
  document.querySelectorAll('[data-open-chat]').forEach(btn => btn.addEventListener('click', () => openChatRoom(btn.getAttribute('data-open-chat'))));
}

function openChatRoom(matchId) {
  const match = state.matches.find(m => m.id === matchId);
  const partnerId = match.userA===state.me.id ? match.userB : match.userA;
  const partner = state.users.find(u => u.id === partnerId);
  if (!partner) return;
  if (!match.messages) match.messages = [];

  document.getElementById('chat-room').innerHTML = `
    <div class="card">
      <div class="row space-between">
        <div class="h2" style="text-transform:none">${partner.name}</div>
        <div class="row" style="gap:8px">
          <button class="btn" id="btn-close-chat" title="Fermer">✖️</button>
          <button class="btn" id="btn-plan">Planifier séance</button>
        </div>
      </div>
      <div class="messages" id="msgs">
        ${match.messages.map((m, idx) => `
          <div class="msg ${m.senderId===state.me.id?'self':'other'}">
            <div>${m.text}</div>
            <div class="meta">${new Date(m.createdAt).toLocaleString()} ${renderReactions(m)}</div>
            <div class="row" style="gap:6px; margin-top:4px">
              ${renderReactionButtons(idx)}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="row" style="margin-top:8px">
        <input id="msg-input" class="input" placeholder="Écrire un message" />
        <button class="btn primary" id="send-msg">Envoyer</button>
      </div>
    </div>
  `;
  const msgs = document.getElementById('msgs');
  document.getElementById('send-msg').onclick = () => {
    const text = document.getElementById('msg-input').value.trim(); if (!text) return;
    match.messages.push({ id: `msg_${Date.now()}`, chatId: match.id, senderId: state.me.id, text, type: 'text', createdAt: Date.now(), reactions: {} });
    saveState(); openChatRoom(matchId); setTimeout(()=> msgs.scrollTop = msgs.scrollHeight, 0);
  };
  document.getElementById('btn-plan').onclick = () => openPlanner(partner);
  document.getElementById('btn-close-chat').onclick = () => { document.getElementById('chat-room').innerHTML = ''; };
  // Bind reaction buttons
  msgs.querySelectorAll('[data-react]').forEach(btn => btn.addEventListener('click', () => {
    const reaction = btn.getAttribute('data-react');
    const idx = parseInt(btn.getAttribute('data-msg-idx'));
    const m = match.messages[idx];
    if (!m.reactions) m.reactions = {};
    const key = `${reaction}`;
    m.reactions[key] = (m.reactions[key] || 0) + 1;
    saveState(); openChatRoom(matchId);
  }));
}
function renderReactions(message) {
  const r = message.reactions || {};
  const entries = Object.entries(r);
  if (!entries.length) return '';
  return entries.map(([k,v]) => `${k} ${v}`).join(' ');
}
function renderReactionButtons(msgIdx) {
  const emojis = ['👍','💪','🔥','😊','👏'];
  return emojis.map((e) => `<button class="btn chip" data-react="${e}" data-msg-idx="${msgIdx}" style="padding:4px 8px">${e}</button>`).join('');
}

function openPlanner(partner) {
  const myGyms = state.me.favorites; const partnerGyms = partner.favorites; const commonGyms = myGyms.filter(g => partnerGyms.includes(g));
  const suggestions = suggestSessions(state.me, partner, commonGyms);
  const html = `
    <div class="card" style="position:fixed; inset: 6% 6% auto 6%; z-index: 30; background: var(--bg-2)">
      <div class="row space-between">
        <div class="h1">Proposer une séance</div>
        <button class="btn" id="close-planner">Fermer</button>
      </div>
      <div class="grid">
        ${suggestions.length===0 ? '<div class="muted">Aucun créneau commun trouvé. Essayez d\'élargir vos disponibilités.</div>' : suggestions.slice(0,3).map(s => `
          <div class="card row space-between">
            <div>
              <div style="font-weight:700">${formatSlot(s.start)} – ${formatSlot(new Date(s.start.getTime()+90*60000))}</div>
              <div class="muted" style="font-size:12px">${state.gyms.find(g=>g.id===s.gymId)?.name}</div>
            </div>
            <div class="row" style="gap:8px">
              <button class="btn" data-ics="${s.gymId}|${s.start.toISOString()}">.ics</button>
              <button class="btn success" data-propose="${s.gymId}|${s.start.toISOString()}">Proposer</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  const container = document.createElement('div'); container.innerHTML = html; document.body.appendChild(container);
  document.getElementById('close-planner').onclick = () => container.remove();
  container.querySelectorAll('[data-ics]').forEach(btn => btn.addEventListener('click', () => {
    const [gymId, startIso] = btn.getAttribute('data-ics').split('|'); const start = new Date(startIso); const end = new Date(start.getTime()+90*60000); const gym = state.gyms.find(g=>g.id===gymId);
    downloadICS({ title: `Séance à ${gym.name}`, description: `Séance proposée avec ${partner.name}`, location: `${gym.name}, ${gym.city}`, start, end });
  }));
  container.querySelectorAll('[data-propose]').forEach(btn => btn.addEventListener('click', () => { const [gymId, startIso] = btn.getAttribute('data-propose').split('|'); proposeSession(partner, gymId, new Date(startIso)); container.remove(); }));
}

function suggestSessions(a, b, gymIds) {
  const bitsA = base64ToBits(a.availabilityMask); const bitsB = base64ToBits(b.availabilityMask); const now = new Date(); const suggestions = [];
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate()+dayOffset);
    const weekday = (date.getDay() + 6) % 7;
    for (let slot = 16; slot < 40; slot+=2) {
      const idx = weekday*48 + slot;
      if (bitsA[idx] && bitsB[idx]) { const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(slot/2), (slot%2)*30); suggestions.push({ gymId: gymIds[0] ?? a.favorites[0], start }); }
    }
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

function formatSlot(dt) { const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]; return `${days[(dt.getDay()+6)%7]} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')} ${dt.toLocaleDateString()}`; }

function downloadICS({ title, description, location, start, end }) {
  function formatICSDate(d) { const pad = (n)=>String(n).padStart(2,'0'); return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }
  const uid = `sess-${Date.now()}@gogymtogether`;
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GoGymTogether Proto//FR','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${formatICSDate(new Date())}`,`DTSTART:${formatICSDate(start)}`,`DTEND:${formatICSDate(end)}`,`SUMMARY:${title}`,`DESCRIPTION:${description}`,`LOCATION:${location}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'seance.ics'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function renderProfile() {
  const me = state.me;
  const edit = state.ui?.profileEdit ?? false;
  const pills = [ `<span class="badge">${levelLabel(me.level)}</span>`, `<span class="badge">${me.goal}</span>`, `<span class="badge">${ageLabel(me)}</span>`, ...me.favorites.map(gymPill) ].join('');
  viewRoot().innerHTML = `
    <div class="section h1">Mon profil</div>
    <div class="card grid cols-2">
      <div class="grid">
        <img class="match-photo" src="${me.photoUrl}" alt="Moi" />
        <div class="row space-between" style="margin-top:6px">
          <div style="font-weight:800; font-size:18px">${me.name}</div>
          <div class="row" style="gap:8px">
            <div class="badge">${levelLabel(me.level)}</div>
            <div class="badge">${ageLabel(me)}</div>
          </div>
        </div>
        <div class="pills">${pills}</div>
      </div>
      <div class="grid">
        <div class="row" style="gap:8px; justify-content:flex-end">
          <button id="toggle-edit" class="btn chip">${edit ? 'Terminer' : 'Modifier'}</button>
        </div>
        <div>
          <label>Nom</label>
          <input id="me-name" class="input" value="${me.name}" />
        </div>
        <div>
          <label>Date de naissance</label>
          <input id="me-birth" type="date" class="input" value="${me.birthDate ? me.birthDate.slice(0,10) : ''}" />
        </div>
        <div>
          <label>Photo de profil</label>
          <div class="grid cols-2" style="display:${edit ? 'grid' : 'none'}">
            <input type="file" id="me-photo-file" accept="image/*" />
            <div class="row profile-inline-controls" style="gap:8px">
              <input id="me-photo-url" class="input" placeholder="URL de la photo" />
              <button id="apply-photo-url" class="btn">Appliquer</button>
            </div>
          </div>
        </div>
        <div>
          <label>Localisation</label>
          <div class="grid cols-2">
            <div>
              <input id="me-region-search" class="input" placeholder="Rechercher une région" style="display:${edit ? 'block' : 'none'}" />
              <select id="me-region" class="input"></select>
            </div>
            <div>
              <input id="me-dept-search" class="input" placeholder="Rechercher un département" style="display:${edit ? 'block' : 'none'}" />
              <select id="me-dept" class="input"></select>
            </div>
          </div>
          <div style="margin-top:8px">
            <input id="me-city-search" class="input" placeholder="Rechercher une ville" style="display:${edit ? 'block' : 'none'}" />
            <select id="me-city" class="input"></select>
          </div>
        </div>
        <div>
          <label>Salles favorites</label>
          <div class="grid cols-2" style="align-items:end">
            <select id="me-chain" class="input"></select>
            <select id="me-gym" class="input" multiple size="6"></select>
          </div>
        </div>
        <div>
          <label>Bio</label>
          <textarea id="me-bio" rows="4" class="input">${me.bio ?? ''}</textarea>
        </div>
        <div class="row profile-actions" style="gap:8px">
          <button id="save-me" class="btn primary" style="display:${edit ? 'inline-block':'none'}">Enregistrer</button>
          <button id="reset" class="btn">Réinitialiser</button>
          <button id="logout" class="btn">Déconnexion</button>
        </div>
      </div>
    </div>
  `;
  setupGymCascade('me', { multipleGyms: true, initial: { regionCode: me.regionCode, departmentCode: me.departmentCode, city: me.city, gymIds: me.favorites } });
  // Toggle edit mode
  document.getElementById('toggle-edit').onclick = () => { state.ui.profileEdit = !edit; saveState(); renderProfile(); };
  // Disable/enable fields based on edit mode
  const ids = ['me-name','me-birth','me-photo-file','me-photo-url','apply-photo-url','me-region','me-dept','me-city','me-chain','me-gym','me-bio','me-region-search','me-dept-search','me-city-search'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !edit; });
  document.getElementById('save-me').onclick = () => {
    state.me.name = document.getElementById('me-name').value.trim() || state.me.name;
    state.me.birthDate = document.getElementById('me-birth').value || null;
    state.me.bio = document.getElementById('me-bio').value.trim();
    state.me.regionCode = document.getElementById('me-region').value || null;
    state.me.departmentCode = document.getElementById('me-dept').value || null;
    state.me.city = document.getElementById('me-city').value || null;
    state.me.favorites = Array.from(document.getElementById('me-gym').selectedOptions).map(o=>o.value);
    syncAccountWithMe(); saveState(); showToast('Profil mis à jour'); state.ui.profileEdit = false; saveState(); renderProfile();
  };
  document.getElementById('reset').onclick = () => { localStorage.removeItem(STORAGE_KEY); state = seed(); saveState(); setRoute('home'); showToast('Réinitialisé'); };
  document.getElementById('logout').onclick = () => { state.me = null; state.auth = { currentUserId: null }; saveState(); setRoute('auth'); };
  const fileInput = document.getElementById('me-photo-file');
  fileInput?.addEventListener('change', (e) => { if (!edit) return; const file = e.target.files && e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { state.me.photoUrl = String(reader.result); syncAccountWithMe(); saveState(); renderProfile(); showToast('Photo mise à jour'); }; reader.readAsDataURL(file); });
  document.getElementById('apply-photo-url')?.addEventListener('click', () => { if (!edit) return; const url = document.getElementById('me-photo-url').value.trim(); if (!url) return; state.me.photoUrl = url; syncAccountWithMe(); saveState(); renderProfile(); showToast('Photo mise à jour'); });
}

function startChatWith(user) {
  ensureChatForMatch(user.id);
  setRoute('chat');
  const match = state.matches.find(m => (m.userA===state.me.id && m.userB===user.id) || (m.userB===state.me.id && m.userA===user.id));
  if (match) setTimeout(()=> { document.querySelector(`[data-open-chat="${match.id}"]`)?.click(); }, 0);
}

// Initial render and Auth view remain unchanged
function init() { bindTabs(); if (state.auth?.currentUserId && !state.me) setLoggedInUserById(state.auth.currentUserId); if (!state.me) setRoute('auth'); else setRoute('home'); }
window.addEventListener('DOMContentLoaded', init);

function renderAuth() {
  viewRoot().innerHTML = `
    <div class="section h1">Compte</div>
    <div class="card">
      <div class="row" style="gap:8px; margin-bottom:10px">
        <button class="btn chip" id="tab-login">Connexion</button>
        <button class="btn chip" id="tab-signup">Inscription</button>
      </div>
      <div id="auth-forms" class="grid">
        <div id="login-form" class="grid">
          <div><label>Email</label><input id="login-email" class="input" type="email" placeholder="vous@example.com" /></div>
          <div><label>Mot de passe</label><input id="login-pass" class="input" type="password" placeholder="Votre mot de passe" /></div>
          <button id="btn-login" class="btn primary">Se connecter</button>
        </div>
        <div id="signup-form" class="grid" style="display:none">
          <div><label>Prénom</label><input id="su-name" class="input" placeholder="Votre prénom" /></div>
          <div><label>Email</label><input id="su-email" class="input" type="email" placeholder="vous@example.com" /></div>
          <div><label>Mot de passe</label><input id="su-pass" class="input" type="password" placeholder="Mot de passe" /></div>
          <div><label>Date de naissance</label><input id="su-birth" type="date" class="input" /></div>
          <div>
            <label>Localisation</label>
            <div class="grid cols-2">
              <select id="su-region" class="input"></select>
              <select id="su-dept" class="input"></select>
            </div>
          </div>
          <button id="btn-signup" class="btn success">Créer un compte</button>
        </div>
      </div>
    </div>
  `;
  const loginTab = document.getElementById('tab-login'); const signupTab = document.getElementById('tab-signup'); const loginForm = document.getElementById('login-form'); const signupForm = document.getElementById('signup-form');
  const showLogin = () => { loginForm.style.display = 'grid'; signupForm.style.display = 'none'; };
  const showSignup = () => { loginForm.style.display = 'none'; signupForm.style.display = 'grid'; };
  loginTab.onclick = showLogin; signupTab.onclick = showSignup; showLogin();
  setupRegionDept('su-region', 'su-dept', '', '');
  document.getElementById('btn-login').onclick = () => { const email = document.getElementById('login-email').value.trim().toLowerCase(); const pass = document.getElementById('login-pass').value; const acct = state.accounts.find(a => (a.email||'').toLowerCase() === email && a.password === pass); if (!acct) { showToast('Identifiants invalides'); return; } setLoggedInUserById(acct.id); showToast('Connecté'); setRoute('home'); };
  document.getElementById('btn-signup').onclick = () => { const name = document.getElementById('su-name').value.trim(); const email = document.getElementById('su-email').value.trim().toLowerCase(); const pass = document.getElementById('su-pass').value; const birthDate = document.getElementById('su-birth').value || null; const regionCode = document.getElementById('su-region').value || null; const departmentCode = document.getElementById('su-dept').value || null; if (!name || !email || !pass) { showToast('Complétez tous les champs'); return; } if (state.accounts.some(a => (a.email||'').toLowerCase() === email)) { showToast('Email déjà utilisé'); return; } const id = `acc_${Date.now()}`; const account = { id, name, email, password: pass, photoUrl: avatar(name), level: 1, goal: 'Hypertrophie', favorites: [], availabilityMask: generateRandomWeekMask(0.3), bio: '', regionCode, departmentCode, city: null, birthDate }; state.accounts.push(account); state.me = { ...account }; state.auth = { currentUserId: id }; saveState(); showToast('Compte créé'); setRoute('onboarding'); };
}
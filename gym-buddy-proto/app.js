// Simple SPA router and state
const routes = ["home", "search", "chat", "profile", "onboarding"];
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
  ui: { listMode: false },
};

let state = loadState();
if (!state || !state.gyms?.length) {
  state = seed();
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

// Seed data: gyms, users
function seed() {
  const gymChains = [
    { id: "chain_basicfit", name: "Basic-Fit", logoUrl: "" },
    { id: "chain_fitnesspark", name: "Fitness Park", logoUrl: "" },
    { id: "chain_cm", name: "Club Med Gym", logoUrl: "" },
  ];
  const gyms = [
    { id: "gym_bf_1", chainId: "chain_basicfit", name: "Basic-Fit Bastille", city: "Paris", lat: 48.853, lon: 2.369 },
    { id: "gym_bf_2", chainId: "chain_basicfit", name: "Basic-Fit Montparnasse", city: "Paris", lat: 48.842, lon: 2.321 },
    { id: "gym_fp_1", chainId: "chain_fitnesspark", name: "Fitness Park République", city: "Paris", lat: 48.867, lon: 2.364 },
    { id: "gym_fp_2", chainId: "chain_fitnesspark", name: "Fitness Park Lyon Part-Dieu", city: "Lyon", lat: 45.760, lon: 4.861 },
  ];
  const demoUsers = generateDemoUsers(gyms);
  const me = {
    id: "me",
    name: "Alex",
    photoUrl: avatar("Alex"),
    level: 1, // 0: Débutant, 1: Intermédiaire, 2: Avancé, 3: Compétition
    goal: "Hypertrophie",
    favorites: [gyms[0].id, gyms[2].id],
    availabilityMask: generateRandomWeekMask(0.35),
    bio: "Motivé pour progresser en force et hypertrophie. Bench day addict.",
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
  };
}

function avatar(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
}

function generateDemoUsers(gyms) {
  const names = [
    "Léa", "Maxime", "Sofia", "Yann", "Camille", "Nina", "Rayan", "Eva", "Mehdi", "Zoé",
    "Thomas", "Sarah", "Antoine", "Noah", "Maya", "Hugo", "Lola", "Adam", "Chloé", "Lucas",
  ];
  const goals = ["Force", "Hypertrophie", "Perte de poids", "Endurance"];
  const users = names.map((n, idx) => {
    const level = Math.floor(Math.random() * 4);
    const favorites = [sample(gyms).id];
    if (Math.random() > 0.6) favorites.push(sample(gyms).id);
    return {
      id: "u_" + idx,
      name: n,
      photoUrl: avatar(n),
      level,
      goal: sample(goals),
      favorites: Array.from(new Set(favorites)),
      availabilityMask: generateRandomWeekMask(randomBetween(0.2, 0.6)),
      bio: genBio(level),
    };
  });
  return users;
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
  const a = base64ToBits(aB64);
  const b = base64ToBits(bB64);
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i];
    inter += (ai & bi);
    uni += (ai | bi);
  }
  return uni === 0 ? 0 : inter / uni;
}

// Distance helper (approx) in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function gymScore(userA, userB) {
  const gyms = state.gyms;
  const favoritesA = userA.favorites.map(id => gyms.find(g => g.id === id));
  const favoritesB = userB.favorites.map(id => gyms.find(g => g.id === id));
  const chainIdsA = new Set(favoritesA.filter(Boolean).map(g => g.chainId));
  const chainIdsB = new Set(favoritesB.filter(Boolean).map(g => g.chainId));
  let best = 0;
  for (const ga of favoritesA) {
    for (const gb of favoritesB) {
      if (!ga || !gb) continue;
      const sameGym = ga.id === gb.id;
      const sameChain = ga.chainId && ga.chainId === gb.chainId;
      const dist = haversineKm(ga.lat, ga.lon, gb.lat, gb.lon);
      if (sameGym) best = Math.max(best, 1.0);
      else if (sameChain) {
        const base = Math.max(0, 1 - dist / 10); // 0..1
        best = Math.max(best, Math.min(0.8, base));
      } else {
        const base = Math.max(0, 1 - dist / 10);
        best = Math.max(best, Math.min(0.5, base));
      }
    }
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
  const gym = gymScore(a, b);
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
  for (const btn of document.querySelectorAll('.tab-btn')) {
    btn.classList.toggle('active', btn.dataset.route === route);
  }
  if (route === "onboarding") renderOnboarding();
  else if (route === "home") renderHome();
  else if (route === "search") renderSearch();
  else if (route === "chat") renderChat();
  else if (route === "profile") renderProfile();
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setRoute(btn.dataset.route));
  });
}

// Views
function renderOnboarding() {
  const me = state.me;
  const levels = ["Débutant", "Intermédiaire", "Avancé", "Compétition"];
  const goals = ["Force", "Hypertrophie", "Perte de poids", "Endurance"];
  const gyms = state.gyms;

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
        <label>Salle(s) favorites</label>
        <select id="gym-select" class="input" multiple size="5">
          ${gyms.map(g=>`<option value="${g.id}" ${me?.favorites?.includes(g.id)?'selected':''}>${g.name} — ${g.city}</option>`).join('')}
        </select>
        <div class="row" style="margin-top:8px">
          <button id="geoloc" class="btn chip">Autour de moi</button>
          <button id="add-gym" class="btn chip">Ma salle n'est pas dans la liste</button>
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
    const level = parseInt(document.querySelector('#level-choices .choice.active')?.dataset.val ?? '1');
    const goal = document.querySelector('#goal-choices .choice.active')?.dataset.val ?? 'Hypertrophie';
    const favorites = Array.from(document.getElementById('gym-select').selectedOptions).map(o=>o.value);
    const bio = document.getElementById('bio').value.trim();
    state.me = { ...state.me, name, level, goal, favorites, bio };
    saveState();
    showToast('Profil enregistré');
    setRoute('home');
  });
}

function renderHome() {
  const recos = getRecommendations(20);
  const listMode = state.ui.listMode;
  // Build static header
  viewRoot().innerHTML = `
    <div class="section row space-between">
      <div class="h1">Matching</div>
      <button id="toggle-mode" class="btn chip">${listMode ? 'Mode swipe' : 'Mode liste'}</button>
    </div>
    <div id="match-container"></div>
  `;
  document.getElementById('toggle-mode').addEventListener('click', () => {
    state.ui.listMode = !state.ui.listMode; saveState(); renderHome();
  });

  const container = document.getElementById('match-container');
  if (listMode) {
    container.innerHTML = renderList(recos);
    // Bind list actions (home)
    container.querySelectorAll('[data-like]').forEach(btn => btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-like');
      state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: uid, decision: 'like', createdAt: Date.now() });
      // Create a chance for instant match for demo
      if (Math.random() < 0.25) {
        state.matches.push({ id: `m_${Date.now()}`, userA: state.me.id, userB: uid, createdAt: Date.now(), active: true });
        ensureChatForMatch(uid);
        showToast('Nouveau match !');
      } else {
        showToast('Like envoyé');
      }
      saveState();
      renderHome();
    }));
    container.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-detail');
      openProfileModal(state.users.find(u=>u.id===uid));
    }));
  } else {
    // Swipe deck mode
    const deck = document.createElement('div');
    deck.className = 'card swipe-deck';
    container.appendChild(deck);
    renderSwipeDeckInto(deck, recos);
  }
}

function renderSwipeDeckInto(root, recos) {
  let index = 0;
  function draw() {
    root.innerHTML = '';
    if (index >= recos.length) { root.innerHTML = `<div class="muted" style="padding:20px">Plus de recommandations. Revenez plus tard.</div>`; return; }
    const r = recos[index];
    const el = document.createElement('div');
    el.className = 'swipe-card';
    el.innerHTML = matchCardHTML(r.user, r.score);
    root.appendChild(el);

    const like = el.querySelector('[data-like]');
    const pass = el.querySelector('[data-pass]');
    const detail = el.querySelector('[data-detail]');

    like.addEventListener('click', () => onSwipe(r.user, 'like'));
    pass.addEventListener('click', () => onSwipe(r.user, 'pass'));
    detail.addEventListener('click', () => openProfileModal(r.user));
  }
  function onSwipe(user, decision) {
    state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: user.id, decision, createdAt: Date.now() });
    if (decision === 'like' && Math.random() < 0.25) {
      state.matches.push({ id: `m_${Date.now()}`, userA: state.me.id, userB: user.id, createdAt: Date.now(), active: true });
      ensureChatForMatch(user.id);
      showToast('Nouveau match !');
    }
    saveState();
    index += 1; draw();
  }
  draw();
}

function renderList(recos) {
  return `
    <div class="card list">
      ${recos.map(r => `
        <div class="item">
          <img class="avatar" src="${r.user.photoUrl}" alt="${r.user.name}" />
          <div>
            <div class="row space-between">
              <div style="font-weight:700">${r.user.name}</div>
              <div class="badge">${(r.score*100).toFixed(0)}%</div>
            </div>
            <div class="muted" style="margin-top:4px">${levelLabel(r.user.level)} • ${r.user.goal}</div>
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
function gymPill(gymId) {
  const g = state.gyms.find(x => x.id === gymId); if (!g) return '';
  return `<span class="badge">${g.name.split(' ')[0]} • ${g.city}</span>`;
}

function matchCardHTML(user, score) {
  const pills = [
    `<span class="badge">${levelLabel(user.level)}</span>`,
    `<span class="badge">${user.goal}</span>`,
    ...user.favorites.map(fid => gymPill(fid))
  ].join('');
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
      <div class="pills" style="margin-top:8px">${[ `<span class='badge'>${levelLabel(user.level)}</span>`, `<span class='badge'>${user.goal}</span>`, ...user.favorites.map(gymPill) ].join('')}</div>
      <div class="section">
        <div class="h2">Bio</div>
        <div class="muted">${user.bio}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn success" id="like-from-modal">Like</button>
        <button class="btn" id="propose-session">Proposer une séance</button>
      </div>
    </div>
  `;
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  document.getElementById('close-modal').onclick = () => container.remove();
  document.getElementById('like-from-modal').onclick = () => {
    state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: user.id, decision: 'like', createdAt: Date.now() });
    saveState(); showToast('Like envoyé');
  };
  document.getElementById('propose-session').onclick = () => {
    ensureChatForMatch(user.id);
    openPlanner(user);
  };
}

function ensureChatForMatch(userId) {
  // create or find match and chat
  let match = state.matches.find(m => (m.userA===state.me.id && m.userB===userId) || (m.userB===state.me.id && m.userA===userId));
  if (!match) {
    match = { id: `m_${Date.now()}`, userA: state.me.id, userB: userId, createdAt: Date.now(), active: true };
    state.matches.push(match);
  }
  let chat = state.chats.find(c => c.matchId === match.id);
  if (!chat) {
    chat = { id: `c_${Date.now()}`, matchId: match.id };
    state.chats.push(chat);
  }
  saveState();
  return chat;
}

function renderSearch() {
  const gyms = state.gyms;
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
          <label>Salle</label>
          <select id="f-gym" class="input">
            <option value="">Toutes</option>
            ${gyms.map(g=>`<option value="${g.id}">${g.name} — ${g.city}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Jour</label>
          <select id="f-day" class="input">
            ${["Tous","Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d,i)=>`<option value="${i-1}">${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <button id="apply-filters" class="btn primary">Appliquer</button>
      </div>
    </div>
    <div id="results"></div>
  `;
  document.getElementById('apply-filters').addEventListener('click', () => {
    const level = document.getElementById('f-level').value;
    const gym = document.getElementById('f-gym').value;
    const day = parseInt(document.getElementById('f-day').value);
    const items = state.users.filter(u => {
      if (level !== '' && parseInt(level) !== u.level) return false;
      if (gym && !u.favorites.includes(gym)) return false;
      if (day >= 0) {
        const bits = base64ToBits(u.availabilityMask);
        const hasDay = bits.slice(day*48, (day+1)*48).some(b=>b===1);
        if (!hasDay) return false;
      }
      return true;
    }).map(u => ({ user: u, score: matchScore(state.me, u) }))
      .sort((a,b)=>b.score-a.score);
    document.getElementById('results').innerHTML = renderList(items);
    // bind list actions
    document.querySelectorAll('[data-like]').forEach(btn => btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-like');
      state.swipes.push({ id: `s_${Date.now()}`, swiperId: state.me.id, targetId: uid, decision: 'like', createdAt: Date.now() });
      saveState(); showToast('Like envoyé');
    }));
    document.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-detail');
      openProfileModal(state.users.find(u=>u.id===uid));
    }));
  });
}

function renderChat() {
  const myMatches = state.matches.filter(m => m.active && (m.userA===state.me.id || m.userB===state.me.id));
  const items = myMatches.map(m => {
    const partnerId = m.userA===state.me.id ? m.userB : m.userA;
    const partner = state.users.find(u => u.id === partnerId) || state.me;
    return { match: m, partner };
  });
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
          <button class="btn" id="btn-plan">Planifier séance</button>
        </div>
      </div>
      <div class="messages" id="msgs">
        ${match.messages.map(m => `
          <div class="msg ${m.senderId===state.me.id?'self':'other'}">
            <div>${m.text}</div>
            <div class="meta">${new Date(m.createdAt).toLocaleString()}</div>
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
    const text = document.getElementById('msg-input').value.trim();
    if (!text) return;
    match.messages.push({ id: `msg_${Date.now()}`, chatId: match.id, senderId: state.me.id, text, type: 'text', createdAt: Date.now() });
    saveState();
    openChatRoom(matchId);
    setTimeout(()=> msgs.scrollTop = msgs.scrollHeight, 0);
  };
  document.getElementById('btn-plan').onclick = () => openPlanner(partner);
}

function openPlanner(partner) {
  // Find common gyms and time suggestions based on availability overlap
  const myGyms = state.me.favorites;
  const partnerGyms = partner.favorites;
  const commonGyms = myGyms.filter(g => partnerGyms.includes(g));
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
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  document.getElementById('close-planner').onclick = () => container.remove();
  container.querySelectorAll('[data-ics]').forEach(btn => btn.addEventListener('click', () => {
    const [gymId, startIso] = btn.getAttribute('data-ics').split('|');
    const start = new Date(startIso); const end = new Date(start.getTime()+90*60000);
    const gym = state.gyms.find(g=>g.id===gymId);
    downloadICS({
      title: `Séance à ${gym.name}`,
      description: `Séance proposée avec ${partner.name}`,
      location: `${gym.name}, ${gym.city}`,
      start,
      end,
    });
  }));
  container.querySelectorAll('[data-propose]').forEach(btn => btn.addEventListener('click', () => {
    const [gymId, startIso] = btn.getAttribute('data-propose').split('|');
    proposeSession(partner, gymId, new Date(startIso));
    container.remove();
  }));
}

function suggestSessions(a, b, gymIds) {
  // find the next 7 days half-hour slots where both have availability
  const bitsA = base64ToBits(a.availabilityMask);
  const bitsB = base64ToBits(b.availabilityMask);
  const now = new Date();
  const suggestions = [];
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate()+dayOffset);
    const weekday = (date.getDay() + 6) % 7; // 0=Mon
    for (let slot = 16; slot < 40; slot+=2) { // prefer 8:00 to 20:00, step 1h
      const idx = weekday*48 + slot;
      if (bitsA[idx] && bitsB[idx]) {
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(slot/2), (slot%2)*30);
        suggestions.push({ gymId: gymIds[0] ?? a.favorites[0], start });
      }
    }
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

function formatSlot(dt) {
  const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  return `${days[(dt.getDay()+6)%7]} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')} ${dt.toLocaleDateString()}`;
}

function downloadICS({ title, description, location, start, end }) {
  // Basic ICS
  function formatICSDate(d) {
    const pad = (n)=>String(n).padStart(2,'0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }
  const uid = `sess-${Date.now()}@gym-buddy`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gym Buddy Proto//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'seance.ics'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function renderProfile() {
  const me = state.me;
  const pills = [ `<span class="badge">${levelLabel(me.level)}</span>`, `<span class="badge">${me.goal}</span>`, ...me.favorites.map(gymPill) ].join('');
  viewRoot().innerHTML = `
    <div class="section h1">Mon profil</div>
    <div class="card grid cols-2">
      <div class="grid">
        <img class="match-photo" src="${me.photoUrl}" alt="Moi" />
        <div class="row space-between" style="margin-top:6px">
          <div style="font-weight:800; font-size:18px">${me.name}</div>
          <div class="badge">${levelLabel(me.level)}</div>
        </div>
        <div class="pills">${pills}</div>
      </div>
      <div class="grid">
        <div>
          <label>Nom</label>
          <input id="me-name" class="input" value="${me.name}" />
        </div>
        <div>
          <label>Bio</label>
          <textarea id="me-bio" rows="4" class="input">${me.bio ?? ''}</textarea>
        </div>
        <div class="row" style="gap:8px">
          <button id="save-me" class="btn primary">Enregistrer</button>
          <button id="reset" class="btn">Réinitialiser</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('save-me').onclick = () => {
    state.me.name = document.getElementById('me-name').value.trim() || state.me.name;
    state.me.bio = document.getElementById('me-bio').value.trim();
    saveState(); showToast('Profil mis à jour');
  };
  document.getElementById('reset').onclick = () => {
    localStorage.removeItem(STORAGE_KEY); state = seed(); saveState(); setRoute('home'); showToast('Réinitialisé');
  };
}

function proposeSession(partner, gymId, start) {
  const match = state.matches.find(m => (m.userA===state.me.id && m.userB===partner.id) || (m.userB===state.me.id && m.userA===partner.id));
  const gym = state.gyms.find(g=>g.id===gymId);
  const end = new Date(start.getTime()+90*60000);
  if (match) {
    if (!match.messages) match.messages = [];
    match.messages.push({ id: `msg_${Date.now()}`, chatId: match.id, senderId: state.me.id, type: 'session_proposal', text: `Proposition de séance: ${gym.name} le ${formatSlot(start)} (90 min)`, createdAt: Date.now() });
    saveState();
    setRoute('chat');
    showToast('Séance proposée');
  }
}

// Initial render and bindings
function init() {
  bindTabs();
  if (!state.me) renderOnboarding(); else setRoute('home');
}

window.addEventListener('DOMContentLoaded', init);
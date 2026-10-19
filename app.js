const STORAGE_KEY = 'frien_nita_users_v4';
const ADMIN_ID = 'Skywalker042';
const ADMIN_PASS = '$kywalk3r(anup)';

const LOUNGES = [
  { id: 'general-nita', name: 'general-nita', sub: 'Main NIT Agartala hangout' },
  { id: 'ece-hub', name: 'ece-hub', sub: 'ECE Labs, Laser Physics & Projects' },
  { id: 'badminton-club', name: 'badminton-club', sub: 'Morning court matches & footwork' },
  { id: 'gaming-squad', name: 'gaming-squad', sub: 'Valorant, Wuthering Waves & Chess' }
];

const INITIAL_SWIPE_POSTS = [
  {
    id: 1,
    author: 'khushi_nita',
    caption: 'Golden hour right outside the NIT Agartala Knowledge Center ✨ Who is up for evening badminton?',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80',
    likes: 42,
    likedByMe: false,
    tag: 'Campus Life',
    comments: [{ user: 'anup_ece', text: 'Count me in for 6 PM court!' }]
  },
  {
    id: 2,
    author: 'ayush_mech',
    caption: 'Late night Valorant & Chess grind in the hostel 🔥 Drop your tags in comments!',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80',
    likes: 29,
    likedByMe: false,
    tag: 'Hostel Gaming',
    comments: [{ user: 'rohan_cse', text: 'Joining your Chess lobby in 5 mins!' }]
  },
  {
    id: 3,
    author: 'rohan_cse',
    caption: 'Built a new Python project after finishing the CS50 problem sets 💻',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=80',
    likes: 64,
    likedByMe: false,
    tag: 'Tech & Code',
    comments: []
  }
];

const ENDLESS_POOL = [
  {
    author: 'sneha_ee',
    caption: 'Evening jam session at the amphitheater 🎸 What song should we queue next?',
    mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=900&q=80',
    tag: 'Music Club'
  },
  {
    author: 'anup_ece',
    caption: 'Early morning badminton session before 1st-year Engineering Mechanics lecture 🏸',
    mediaUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
    tag: 'Sports Complex'
  },
  {
    author: 'khushi_nita',
    caption: 'Exploring new UI prototypes in Figma for our college tech fest 🎨',
    mediaUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=900&q=80',
    tag: 'Design'
  }
];

let state = {
  currentUser: null,
  isAdmin: false,
  activeTab: 'swipe',
  activeChatId: 'general-nita',
  activeChatType: 'lounge',
  chatMedia: null,
  friends: ['khushi_nita'],
  incomingRequests: ['ayush_mech', 'sneha_ee'],
  swipePosts: [...INITIAL_SWIPE_POSTS],
  messages: {
    'general-nita': [
      { sender: 'khushi_nita', text: 'Love the new Ranked Arcade and Swipe feed!', time: '11:20 AM' },
      { sender: 'ayush_mech', text: 'Sent a 1v1 Chess invite! Check the right radar or Arcade tab.', time: '11:22 AM' }
    ]
  }
};

function getRankTier(elo = 1200) {
  if (elo >= 1450) return '👑 Grandmaster';
  if (elo >= 1350) return '💎 Diamond';
  if (elo >= 1250) return '🥇 Gold';
  if (elo >= 1150) return '🥈 Silver';
  return '🥉 Bronze';
}

function getUsers() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const defaultEloMap = {
    anup_ece: 1340,
    khushi_nita: 1280,
    ayush_mech: 1420,
    rohan_cse: 1365,
    sneha_ee: 1210
  };

  if (raw) {
    const parsed = JSON.parse(raw);
    return parsed.map(u => ({
      ...u,
      elo: typeof u.elo === 'number' ? u.elo : (defaultEloMap[u.username] || 1200)
    }));
  }

  const seed = [
    { username: 'anup_ece', password: 'nita123', fullName: 'Anup Kumar', branch: 'ECE', presentYear: '1st Year', hobby: '🏸 Badminton', privacy: 'private', statusState: 'online', activityText: '🔥 Swiping Feed', elo: 1340 },
    { username: 'khushi_nita', password: 'nita123', fullName: 'Khushi Sharma', branch: 'ECE', presentYear: '1st Year', hobby: '🎨 UI/UX Design', privacy: 'private', statusState: 'online', activityText: '🎧 Listening to Starboy', elo: 1280 },
    { username: 'ayush_mech', password: 'nita123', fullName: 'Ayush Verma', branch: 'Mechanical (ME)', presentYear: '2nd Year', hobby: '🎮 PC Gaming', privacy: 'private', statusState: 'online', activityText: '♟️ Waiting in Chess (1/2)', elo: 1420 },
    { username: 'rohan_cse', password: 'nita123', fullName: 'Rohan Das', branch: 'CSE', presentYear: '3rd Year', hobby: '💻 Coding', privacy: 'public', statusState: 'idle', activityText: '🌙 Idle / Away', elo: 1365 },
    { username: 'sneha_ee', password: 'nita123', fullName: 'Sneha Roy', branch: 'EE', presentYear: '1st Year', hobby: '🎧 Music', privacy: 'private', statusState: 'offline', activityText: '⚫ Offline', elo: 1210 }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  const el = document.getElementById('savedAccountsCount');
  if (el) el.textContent = users.length;
}

// ================= AUTHENTICATION =================
function switchAuthTab(tab) {
  const isReg = tab === 'register';
  document.getElementById('registerForm').classList.toggle('hidden', !isReg);
  document.getElementById('loginForm').classList.toggle('hidden', isReg);
  document.getElementById('tabRegister').className = isReg
    ? 'flex-1 py-2.5 rounded-xl font-display font-semibold text-sm bg-surface-800 text-white shadow'
    : 'flex-1 py-2.5 rounded-xl font-display font-semibold text-sm text-gray-400';
  document.getElementById('tabLogin').className = !isReg
    ? 'flex-1 py-2.5 rounded-xl font-display font-semibold text-sm bg-surface-800 text-white shadow'
    : 'flex-1 py-2.5 rounded-xl font-display font-semibold text-sm text-gray-400';
}

function quickFill(u, p) {
  document.getElementById('loginUsername').value = u;
  document.getElementById('loginPassword').value = p;
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const users = getUsers();
  if (users.some(u => u.username === username)) return showToast('Username already exists!', 'coral');

  const newUser = {
    username,
    password: document.getElementById('regPassword').value,
    fullName: document.getElementById('regName').value.trim(),
    branch: document.getElementById('regBranch').value,
    presentYear: document.getElementById('regYear').value,
    hobby: document.getElementById('regHobby').value,
    privacy: document.getElementById('regPrivacy').value,
    statusState: 'online',
    activityText: '🔥 Swiping Feed',
    elo: 1200
  };
  users.push(newUser);
  saveUsers(users);
  enterApp(newUser, false);
}

function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;

  if (u === ADMIN_ID && p === ADMIN_PASS) {
    enterApp({
      username: 'skywalker042',
      fullName: 'Anup Kumar (Root Admin)',
      branch: 'NITA Admin',
      presentYear: 'Root',
      hobby: '🛡️ Admin',
      privacy: 'private',
      statusState: 'online',
      activityText: '⚡ Root Command',
      elo: 1500
    }, true);
    return;
  }

  const users = getUsers();
  const found = users.find(x => x.username === u.toLowerCase() && x.password === p);
  if (!found) return showToast('Invalid credentials!', 'coral');

  found.statusState = 'online';
  found.activityText = '🔥 Swiping Feed';
  saveUsers(users);
  enterApp(found, false);
}

function enterApp(user, isAdmin) {
  state.currentUser = user;
  state.isAdmin = isAdmin;
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('navAdmin').classList.toggle('hidden', !isAdmin);
  renderAll();
  setupEndlessScrollSensor();
  showToast(`Welcome @${user.username} (${user.elo || 1200} ELO)!`, 'emerald');
}

function logout() {
  state.currentUser = null;
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('authView').classList.remove('hidden');
}

// ================= PRIVACY LOGIC =================
function canSeeIdentity(targetUser) {
  if (!state.currentUser) return false;
  if (state.isAdmin) return true;
  if (targetUser.username === state.currentUser.username) return true;
  if (targetUser.privacy === 'public') return true;
  if (state.friends.includes(targetUser.username)) return true;
  return false;
}

function toggleMyPrivacy() {
  state.currentUser.privacy = state.currentUser.privacy === 'private' ? 'public' : 'private';
  const users = getUsers();
  const idx = users.findIndex(u => u.username === state.currentUser.username);
  if (idx !== -1) {
    users[idx] = state.currentUser;
    saveUsers(users);
  }
  renderAll();
  showToast(`Account is now ${state.currentUser.privacy.toUpperCase()}`, 'emerald');
}

function setActivity(statusState, activityText) {
  if (!state.currentUser) return;
  state.currentUser.statusState = statusState;
  state.currentUser.activityText = activityText;
  const users = getUsers();
  const idx = users.findIndex(u => u.username === state.currentUser.username);
  if (idx !== -1) {
    users[idx] = state.currentUser;
    saveUsers(users);
  }
  renderHeaderAndRadar();
}

// ================= ENDLESS SWIPE FEED ENGINE =================
function renderSwipeFeed() {
  const container = document.getElementById('swipeFeedContainer');
  if (!container) return;
  const users = getUsers();

  container.innerHTML = state.swipePosts.map(post => {
    const authorObj = users.find(u => u.username === post.author) || { username: post.author, fullName: post.author, branch: 'NITA', presentYear: '', privacy: 'private', elo: 1200 };
    const unlocked = canSeeIdentity(authorObj);
    const identityBadge = unlocked
      ? `<span class="text-[11px] text-vibe-emerald">${authorObj.fullName} • ${authorObj.branch} (${authorObj.presentYear})</span>`
      : `<span class="text-[11px] text-amber-400 font-mono">🔒 Private Student • ${authorObj.elo || 1200} ELO</span>`;

    const mediaEl = post.mediaType === 'video'
      ? `<video src="${post.mediaUrl}" controls loop class="w-full h-full object-cover"></video>`
      : `<img src="${post.mediaUrl}" class="w-full h-full object-cover select-none" alt="Swipe Media">`;

    const commentsHTML = post.comments.map(c =>
      `<div class="text-xs"><span class="font-mono font-bold text-vibe-emerald">@${c.user}:</span> <span class="text-gray-200">${c.text}</span></div>`
    ).join('');

    return `
      <article ondblclick="doubleTapLike(${post.id})" class="snap-card relative h-[calc(100vh-130px)] w-full rounded-3xl overflow-hidden glass-card flex flex-col justify-between shrink-0 shadow-2xl">
        <div class="absolute inset-0 bg-surface-950">
          ${mediaEl}
          <div class="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/30 to-transparent"></div>
        </div>

        <div id="heartBurst-${post.id}" class="hidden absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <span class="text-7xl heart-burst">❤️</span>
        </div>

        <div class="relative z-10 p-4 flex items-center justify-between bg-gradient-to-b from-surface-950/80 to-transparent">
          <div onclick="openPeerModal('${post.author}')" class="flex items-center gap-2.5 cursor-pointer">
            <div class="w-10 h-10 rounded-2xl bg-vibe-emerald text-surface-950 font-display font-extrabold flex items-center justify-center">
              ${post.author[0].toUpperCase()}
            </div>
            <div>
              <div class="font-mono font-bold text-sm text-white hover:underline">@${post.author}</div>
              ${identityBadge}
            </div>
          </div>
          <span class="px-3 py-1 rounded-full bg-surface-900/80 border border-surface-700 text-[11px] font-mono text-gray-300">${post.tag}</span>
        </div>

        <div class="relative z-10 p-5 space-y-3">
          <div class="flex items-end justify-between gap-4">
            <p class="text-sm text-white leading-relaxed flex-1">${post.caption}</p>
            <div class="flex flex-col items-center gap-3 bg-surface-900/80 backdrop-blur-md p-2.5 rounded-2xl border border-surface-700">
              <button onclick="toggleLike(${post.id})" class="flex flex-col items-center">
                <span class="text-xl">${post.likedByMe ? '❤️' : '🤍'}</span>
                <span class="text-[11px] font-mono text-white mt-0.5">${post.likes}</span>
              </button>
              <button onclick="openPeerModal('${post.author}')" title="View Profile" class="text-xs text-vibe-emerald font-mono">👤</button>
            </div>
          </div>

          <div class="space-y-1 max-h-20 overflow-y-auto bg-surface-950/60 p-2.5 rounded-2xl border border-surface-800">
            ${commentsHTML || '<div class="text-[11px] text-gray-400 font-mono">Double-tap card to like • Add first comment below</div>'}
          </div>

          <form onsubmit="addSwipeComment(event, ${post.id})" class="flex gap-2">
            <input type="text" id="commentInput-${post.id}" placeholder="Drop a comment..." class="input-modern flex-1 px-3.5 py-2 rounded-xl text-xs text-white">
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">Post</button>
          </form>
        </div>
      </article>
    `;
  }).join('');
}

function scrollSwipeFeed(direction) {
  const container = document.getElementById('swipeFeedContainer');
  container.scrollBy({ top: direction * container.clientHeight, behavior: 'smooth' });
}

function setupEndlessScrollSensor() {
  const container = document.getElementById('swipeFeedContainer');
  if (!container) return;
  container.addEventListener('scroll', () => {
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
      appendMoreEndlessPosts();
    }
  });
}

function appendMoreEndlessPosts() {
  const pick = ENDLESS_POOL[Math.floor(Math.random() * ENDLESS_POOL.length)];
  state.swipePosts.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    author: pick.author,
    caption: pick.caption,
    mediaType: 'image',
    mediaUrl: pick.mediaUrl,
    likes: Math.floor(Math.random() * 80) + 10,
    likedByMe: false,
    tag: pick.tag,
    comments: []
  });
  renderSwipeFeed();
}

function toggleLike(postId) {
  const post = state.swipePosts.find(p => p.id === postId);
  if (!post) return;
  post.likedByMe = !post.likedByMe;
  post.likes += post.likedByMe ? 1 : -1;
  renderSwipeFeed();
}

function doubleTapLike(postId) {
  const post = state.swipePosts.find(p => p.id === postId);
  if (!post) return;
  if (!post.likedByMe) {
    post.likedByMe = true;
    post.likes += 1;
    renderSwipeFeed();
  }
  const burst = document.getElementById(`heartBurst-${postId}`);
  if (burst) {
    burst.classList.remove('hidden');
    setTimeout(() => burst.classList.add('hidden'), 800);
  }
}

function addSwipeComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`commentInput-${postId}`);
  const text = input.value.trim();
  if (!text) return;
  const post = state.swipePosts.find(p => p.id === postId);
  if (post) {
    post.comments.push({ user: state.currentUser.username, text });
    renderSwipeFeed();
  }
}

function openCreatePostModal() {
  document.getElementById('createPostModal').classList.remove('hidden');
}

function closeCreatePostModal() {
  document.getElementById('createPostModal').classList.add('hidden');
}

function submitNewSwipePost(e) {
  e.preventDefault();
  const fileInput = document.getElementById('postMediaInput');
  const caption = document.getElementById('postCaptionInput').value.trim();
  let mediaUrl = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80';
  let mediaType = 'image';

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    mediaUrl = URL.createObjectURL(file);
    mediaType = file.type.startsWith('video') ? 'video' : 'image';
  }

  state.swipePosts.unshift({
    id: Date.now(),
    author: state.currentUser.username,
    caption,
    mediaType,
    mediaUrl,
    likes: 1,
    likedByMe: true,
    tag: 'Fresh Campus Post',
    comments: []
  });

  document.getElementById('postCaptionInput').value = '';
  fileInput.value = '';
  closeCreatePostModal();
  renderSwipeFeed();
  document.getElementById('swipeFeedContainer').scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Published to Campus Swipe!', 'emerald');
}

// ================= LOUNGE & DMS =================
function renderChatSection() {
  const loungeList = document.getElementById('loungeList');
  if (!loungeList) return;

  loungeList.innerHTML = LOUNGES.map(l => `
    <button onclick="selectChat('lounge', '${l.id}')" class="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-mono transition ${state.activeChatType === 'lounge' && state.activeChatId === l.id ? 'bg-vibe-emerald/15 text-vibe-emerald font-bold' : 'text-gray-400 hover:bg-surface-850'}">
      <span># ${l.name}</span>
    </button>
  `).join('');

  const dmList = document.getElementById('dmList');
  const peers = getUsers().filter(u => u.username !== state.currentUser?.username);
  dmList.innerHTML = peers.map(u => `
    <button onclick="selectChat('dm', '${u.username}')" class="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-mono flex items-center justify-between transition ${state.activeChatType === 'dm' && state.activeChatId === u.username ? 'bg-vibe-emerald/15 text-vibe-emerald font-bold' : 'text-gray-400 hover:bg-surface-850'}">
      <span>@${u.username}</span>
      <span class="text-[10px] text-vibe-amber">${u.elo || 1200}</span>
    </button>
  `).join('');

  document.getElementById('chatHeaderTitle').textContent = state.activeChatType === 'lounge' ? `#${state.activeChatId}` : `@${state.activeChatId}`;
  const msgs = state.messages[state.activeChatId] || [];
  const users = getUsers();

  document.getElementById('messagesContainer').innerHTML = msgs.map(m => {
    const sender = users.find(u => u.username === m.sender) || { username: m.sender, privacy: 'private', elo: 1200 };
    const badge = canSeeIdentity(sender)
      ? `<span class="text-[10px] text-vibe-emerald">${sender.fullName} (${sender.branch}) • ${sender.elo || 1200} ELO</span>`
      : `<span class="text-[10px] text-amber-400">🔒 Hidden Identity • ${sender.elo || 1200} ELO</span>`;
    const mediaHTML = m.media
      ? (m.media.type === 'video'
        ? `<video src="${m.media.url}" controls class="mt-2 max-w-xs rounded-2xl"></video>`
        : `<img src="${m.media.url}" class="mt-2 max-w-xs rounded-2xl">`)
      : '';

    return `
      <div class="p-3 rounded-2xl bg-surface-900/70 border border-surface-800">
        <div class="flex items-center gap-2">
          <span onclick="openPeerModal('${m.sender}')" class="font-mono font-bold text-xs text-white cursor-pointer hover:underline">@${m.sender}</span>
          ${badge}
          <span class="text-[10px] text-gray-500 ml-auto">${m.time}</span>
        </div>
        <p class="text-xs text-gray-200 mt-1">${m.text}</p>
        ${mediaHTML}
      </div>
    `;
  }).join('');
}

function selectChat(type, id) {
  state.activeChatType = type;
  state.activeChatId = id;
  renderChatSection();
}

function handleChatMedia(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.chatMedia = { type: file.type.startsWith('video') ? 'video' : 'image', url: URL.createObjectURL(file), name: file.name };
  document.getElementById('chatMediaName').textContent = file.name;
  document.getElementById('chatMediaPreview').classList.remove('hidden');
}

function clearChatMedia() {
  state.chatMedia = null;
  document.getElementById('chatMediaPreview').classList.add('hidden');
}

function sendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text && !state.chatMedia) return;
  if (!state.messages[state.activeChatId]) state.messages[state.activeChatId] = [];
  state.messages[state.activeChatId].push({
    sender: state.currentUser.username,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    media: state.chatMedia
  });
  input.value = '';
  clearChatMedia();
  renderChatSection();
}

// ================= HEADER, RIGHT RADAR & ELO DISPLAY =================
function renderHeaderAndRadar() {
  const u = state.currentUser;
  if (!u) return;

  // Sync currentUser ELO from storage
  const latestMe = getUsers().find(x => x.username === u.username);
  if (latestMe) state.currentUser.elo = latestMe.elo;

  document.getElementById('myTopAvatar').textContent = u.username[0].toUpperCase();
  document.getElementById('myTopUsername').textContent = `@${u.username}`;
  document.getElementById('myTopActivity').textContent = u.activityText;
  document.getElementById('privacyToggleBtn').textContent = u.privacy === 'private' ? '🔒 Private' : '🌐 Public';
  document.getElementById('pendingReqBadge').textContent = state.incomingRequests.length;

  const eloBadge = document.getElementById('myTopEloBadge');
  if (eloBadge) eloBadge.textContent = `${state.currentUser.elo || 1200} ELO`;

  const all = getUsers().map(x => x.username === u.username ? state.currentUser : x);
  const online = all.filter(x => x.statusState === 'online');
  const idle = all.filter(x => x.statusState === 'idle');
  const offline = all.filter(x => x.statusState === 'offline');

  document.getElementById('onlineCount').textContent = online.length;
  document.getElementById('idleCount').textContent = idle.length;
  document.getElementById('offlineCount').textContent = offline.length;

  const renderCard = (peer, dot) => `
    <button onclick="openPeerModal('${peer.username}')" class="w-full p-2 rounded-2xl bg-surface-900/60 hover:bg-surface-850 border border-surface-800/80 flex items-center gap-2.5 text-left transition">
      <div class="relative shrink-0">
        <div class="w-8 h-8 rounded-xl bg-surface-800 flex items-center justify-center font-bold text-xs text-vibe-emerald">${peer.username[0].toUpperCase()}</div>
        <span class="w-2.5 h-2.5 rounded-full ${dot} absolute -bottom-0.5 -right-0.5 border border-surface-950"></span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-white truncate">@${peer.username}</span>
          <span class="text-[10px] font-mono text-vibe-amber font-bold">${peer.elo || 1200}</span>
        </div>
        <div class="text-[10px] text-vibe-emerald truncate">${peer.activityText}</div>
        <div class="text-[9px] text-gray-400 truncate">${canSeeIdentity(peer) ? `${peer.fullName} •${peer.branch}` : '🔒 Private Account'}</div>
      </div>
    </button>
  `;

  document.getElementById('radarOnlineList').innerHTML = online.map(p => renderCard(p, 'bg-vibe-emerald')).join('');
  document.getElementById('radarIdleList').innerHTML = idle.map(p => renderCard(p, 'bg-vibe-amber')).join('');
  document.getElementById('radarOfflineList').innerHTML = offline.map(p => renderCard(p, 'bg-gray-600')).join('');

  if (typeof renderArcadeInvitesUI === 'function') {
    renderArcadeInvitesUI();
  }
}

function renderFriendsTab() {
  const users = getUsers();
  document.getElementById('requestsGrid').innerHTML = state.incomingRequests.length === 0
    ? `<div class="text-xs text-gray-500 font-mono">No pending requests</div>`
    : state.incomingRequests.map(uname => `
      <div class="p-4 rounded-2xl bg-surface-900 border border-surface-800 flex items-center justify-between">
        <div>
          <div class="font-mono font-bold text-sm text-white">@${uname}</div>
          <div class="text-[11px] text-amber-400">🔒 Private Identity</div>
        </div>
        <button onclick="acceptFriend('${uname}')" class="px-3.5 py-2 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">Accept</button>
      </div>
    `).join('');

  document.getElementById('friendsGrid').innerHTML = state.friends.map(uname => {
    const u = users.find(x => x.username === uname) || { username: uname, fullName: uname, branch: 'NITA', presentYear: '', elo: 1200 };
    return `
      <div class="p-4 rounded-2xl bg-surface-900 border border-vibe-emerald/30 flex items-center justify-between">
        <div>
          <div class="font-mono font-bold text-sm text-vibe-emerald">@${u.username} <span class="text-vibe-amber text-xs">(${u.elo || 1200} ELO)</span></div>
          <div class="text-xs text-white font-semibold">${u.fullName}</div>
          <div class="text-[11px] text-gray-400">${u.branch} • ${u.presentYear}</div>
        </div>
        <button onclick="switchTab('chat'); selectChat('dm', '${u.username}')" class="px-3 py-1.5 rounded-xl bg-surface-800 text-xs text-white">Message</button>
      </div>
    `;
  }).join('');
}

function openPeerModal(username) {
  const target = getUsers().find(u => u.username === username) || state.currentUser;
  if (!target) return;

  document.getElementById('modalAvatar').textContent = target.username[0].toUpperCase();
  document.getElementById('modalHandle').textContent = `@${target.username}`;
  document.getElementById('modalHobby').textContent = `${target.hobby} • ${getRankTier(target.elo || 1200)}`;
  document.getElementById('modalActivity').textContent = target.activityText;

  const eloEl = document.getElementById('modalEloBadge');
  if (eloEl) eloEl.textContent = `🏆 ${target.elo || 1200} ELO`;

  const unlocked = canSeeIdentity(target);
  document.getElementById('modalUnlockedBox').classList.toggle('hidden', !unlocked);
  document.getElementById('modalLockedBox').classList.toggle('hidden', unlocked);

  if (unlocked) {
    document.getElementById('modalRealName').textContent = target.fullName;
    document.getElementById('modalBranch').textContent = target.branch;
    document.getElementById('modalYear').textContent = target.presentYear;
  }

  const isFriend = state.friends.includes(target.username);
  document.getElementById('modalActionBtns').innerHTML = target.username === state.currentUser.username ? '' : `
    <div class="grid grid-cols-2 gap-2">
      <button onclick="acceptFriend('${target.username}')" class="py-2.5 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">
        ${isFriend ? '✓ Friends' : '+ Add Friend'}
      </button>
      <button onclick="closePeerModal(); switchTab('arcade'); invitePeerToArcade('${target.username}', 'play')" class="py-2.5 rounded-xl bg-vibe-amber text-surface-950 font-bold text-xs">
        ⚔️ Invite 1v1
      </button>
    </div>
  `;

  document.getElementById('peerModal').classList.remove('hidden');
  lucide.createIcons();
}

function closePeerModal() {
  document.getElementById('peerModal').classList.add('hidden');
}

function acceptFriend(username) {
  if (!state.friends.includes(username)) state.friends.push(username);
  state.incomingRequests = state.incomingRequests.filter(x => x !== username);
  closePeerModal();
  renderAll();
  showToast(`Connected with @${username}! Identity unlocked.`, 'emerald');
}

// ================= ADMIN MODAL =================
function openAdminModal() {
  document.getElementById('adminTableBody').innerHTML = getUsers().map(u => `
    <tr>
      <td class="py-2.5 font-mono text-vibe-emerald font-bold">@${u.username}</td>
      <td class="py-2.5 text-white">${u.fullName}</td>
      <td class="py-2.5 text-gray-300">${u.branch} (${u.presentYear})</td>
      <td class="py-2.5 font-mono text-vibe-amber font-bold">${u.elo || 1200} (${getRankTier(u.elo || 1200)})</td>
      <td class="py-2.5 font-mono">${u.privacy}</td>
      <td class="py-2.5 text-gray-400">${u.activityText}</td>
    </tr>
  `).join('');
  document.getElementById('adminModal').classList.remove('hidden');
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.add('hidden');
}

function exportDatabaseJSON() {
  const a = document.createElement('a');
  a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getUsers(), null, 2));
  a.download = "frien_nita_users.json";
  a.click();
}

function renderAll() {
  renderHeaderAndRadar();
  renderSwipeFeed();
  renderChatSection();
  renderFriendsTab();
  if (typeof renderArcadeAll === 'function') renderArcadeAll();
  lucide.createIcons();
}

function showToast(msg, color = 'emerald') {
  const el = document.createElement('div');
  el.className = `px-4 py-2.5 rounded-2xl glass-card border ${color === 'coral' ? 'border-vibe-coral text-vibe-coral' : 'border-vibe-emerald text-vibe-emerald'} text-xs font-mono shadow-xl`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

window.addEventListener('DOMContentLoaded', () => {
  saveUsers(getUsers());
  lucide.createIcons();
});
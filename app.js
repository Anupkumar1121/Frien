// ============================================================================
// PRODUCTION APP.JS: SOCKET.IO SYNC, REAL DMs, 2-STEP FRIEND REQUESTS & SWIPE
// ============================================================================
const STORAGE_KEY = 'frien_nita_users_v5_prod';
const ADMIN_ID = 'Skywalker042';
const ADMIN_PASS = '$kywalk3r(anup)';

// Connect to the live Render Socket.io server
const socket = typeof io !== 'undefined' ? io() : null;

const LOUNGES = [
  { id: 'general-nita', name: 'general-nita', sub: 'Main NIT Agartala hangout' },
  { id: 'ece-hub', name: 'ece-hub', sub: 'ECE Labs, Laser Physics & Projects' },
  { id: 'badminton-club', name: 'badminton-club', sub: 'Morning court matches & footwork' },
  { id: 'gaming-squad', name: 'gaming-squad', sub: 'Valorant, Wuthering Waves & Chess' }
];

let state = {
  currentUser: null,
  isAdmin: false,
  activeTab: 'swipe',
  activeChatId: 'general-nita',
  activeChatType: 'lounge',
  chatMedia: null,
  users: [],
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  allFriendships: {},
  allIncomingRequests: {},
  allOutgoingRequests: {},
  swipePosts: [],
  messages: {
    'general-nita': []
  }
};

// Helper: Generate a shared conversation key so DMs between User A and User B go to the exact same room
function getConversationKey(type, targetId) {
  if (type === 'lounge') return targetId;
  if (!state.currentUser) return targetId;
  return 'dm_' + [state.currentUser.username, targetId].sort().join('__');
}

// Helper: Convert uploaded image/video files into Base64 so other devices can view them
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getRankTier(elo = 1200) {
  if (elo >= 1450) return '👑 Grandmaster';
  if (elo >= 1350) return '💎 Diamond';
  if (elo >= 1250) return '🥇 Gold';
  if (elo >= 1150) return '🥈 Silver';
  return '🥉 Bronze';
}

function getUsers() {
  return state.users || [];
}

function saveUsers(usersList) {
  state.users = usersList;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usersList));
  const el = document.getElementById('savedAccountsCount');
  if (el) el.textContent = usersList.length;
}

function syncMyFriendArrays() {
  if (!state.currentUser) return;
  const me = state.currentUser.username;
  state.friends = state.allFriendships[me] || [];
  state.incomingRequests = state.allIncomingRequests[me] || [];
  state.outgoingRequests = state.allOutgoingRequests[me] || [];
}

// ================= SOCKET.IO REAL-TIME LISTENERS =================
if (socket) {
  socket.on('sync_state', (serverDB) => {
    state.users = serverDB.users || [];
    state.swipePosts = serverDB.swipePosts || [];
    state.messages = serverDB.messages || { 'general-nita': [] };
    state.allFriendships = serverDB.friendships || {};
    state.allIncomingRequests = serverDB.incomingRequests || {};
    state.allOutgoingRequests = serverDB.outgoingRequests || {};

    if (typeof musicState !== 'undefined' && serverDB.roomMessages) {
      musicState.roomMessages = serverDB.roomMessages;
    }
    if (typeof arcadeState !== 'undefined' && serverDB.arcadeChat) {
      arcadeState.arcadeChat = serverDB.arcadeChat;
    }

    saveUsers(state.users);
    syncMyFriendArrays();
    if (state.currentUser) renderAll();
  });

  socket.on('sync_users', (data) => {
    state.users = data.users || [];
    state.allFriendships = data.friendships || {};
    state.allIncomingRequests = data.incomingRequests || {};
    state.allOutgoingRequests = data.outgoingRequests || {};
    saveUsers(state.users);
    syncMyFriendArrays();
    if (state.currentUser) {
      const updatedMe = state.users.find(u => u.username === state.currentUser.username);
      if (updatedMe) state.currentUser.elo = updatedMe.elo;
      renderAll();
    }
  });

  socket.on('sync_friends', (data) => {
    state.allFriendships = data.friendships || {};
    state.allIncomingRequests = data.incomingRequests || {};
    state.allOutgoingRequests = data.outgoingRequests || {};
    syncMyFriendArrays();

    if (state.currentUser) {
      if (data.type === 'request_sent' && data.notifyTarget === state.currentUser.username) {
        showToast(`👋 New friend request from @${data.notifyFrom}! Check the Friends tab.`, 'emerald');
      } else if (data.type === 'request_accepted' && data.notifyTarget === state.currentUser.username) {
        showToast(`🎉 @${data.notifyFrom} accepted your friend request! Identity unlocked.`, 'emerald');
      }
      renderAll();
    }
  });

  socket.on('new_chat_message', ({ chatId, message }) => {
    if (!state.messages[chatId]) state.messages[chatId] = [];
    state.messages[chatId].push(message);
    if (state.currentUser) {
      renderChatSection();
      const activeKey = getConversationKey(state.activeChatType, state.activeChatId);
      if (message.sender !== state.currentUser.username && chatId !== activeKey && chatId.includes(state.currentUser.username)) {
        showToast(`💬 New DM from @${message.sender}`, 'emerald');
      }
    }
  });

  socket.on('sync_swipe_posts', (posts) => {
    state.swipePosts = posts || [];
    if (state.currentUser) renderSwipeFeed();
  });

  socket.on('sync_music_chat', ({ roomId, roomMessages }) => {
    if (typeof musicState !== 'undefined') {
      musicState.roomMessages = roomMessages;
      if (typeof renderRoomChat === 'function') renderRoomChat();
    }
  });
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

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!username) return showToast('Enter a valid handle!', 'coral');
  if (state.users.some(u => u.username === username)) return showToast('Username already taken!', 'coral');

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

  state.users.push(newUser);
  if (socket) socket.emit('upsert_user', newUser);
  enterApp(newUser, false);
}

function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;

  if (u === ADMIN_ID && p === ADMIN_PASS) {
    const adminObj = {
      username: 'skywalker042',
      fullName: 'Anup Kumar (Root Admin)',
      branch: 'NITA Admin',
      presentYear: 'Root',
      hobby: '🛡️ Admin',
      privacy: 'private',
      statusState: 'online',
      activityText: '⚡ Root Command',
      elo: 1500
    };
    enterApp(adminObj, true);
    return;
  }

  const found = state.users.find(x => x.username === u.toLowerCase() && x.password === p);
  if (!found) return showToast('Invalid username or password!', 'coral');

  found.statusState = 'online';
  found.activityText = '🔥 Swiping Feed';
  if (socket) socket.emit('upsert_user', found);
  enterApp(found, false);
}

function enterApp(user, isAdmin) {
  state.currentUser = user;
  state.isAdmin = isAdmin;
  syncMyFriendArrays();
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('navAdmin').classList.toggle('hidden', !isAdmin);
  renderAll();
  showToast(`Welcome @${user.username}!`, 'emerald');
}

function logout() {
  if (state.currentUser && !state.isAdmin) {
    state.currentUser.statusState = 'offline';
    state.currentUser.activityText = '⚫ Offline';
    if (socket) socket.emit('upsert_user', state.currentUser);
  }
  state.currentUser = null;
  state.isAdmin = false;
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('authView').classList.remove('hidden');
}

// ================= PRIVACY & STATUS =================
function canSeeIdentity(targetUser) {
  if (!state.currentUser || !targetUser) return false;
  if (state.isAdmin) return true;
  if (targetUser.username === state.currentUser.username) return true;
  if (targetUser.privacy === 'public') return true;
  if (state.friends.includes(targetUser.username)) return true;
  return false;
}

function toggleMyPrivacy() {
  if (!state.currentUser) return;
  state.currentUser.privacy = state.currentUser.privacy === 'private' ? 'public' : 'private';
  if (socket) socket.emit('upsert_user', state.currentUser);
  renderAll();
  showToast(`Account switched to ${state.currentUser.privacy.toUpperCase()} mode`, 'emerald');
}

function setActivity(statusState, activityText) {
  if (!state.currentUser) return;
  state.currentUser.statusState = statusState;
  state.currentUser.activityText = activityText;
  if (socket) socket.emit('upsert_user', state.currentUser);
  renderHeaderAndRadar();
}

// ================= CAMPUS SWIPE FEED (PERSISTENT, NO TRIAL BOTS) =================
function renderSwipeFeed() {
  const container = document.getElementById('swipeFeedContainer');
  if (!container) return;

  if (state.swipePosts.length === 0) {
    container.innerHTML = `
      <div class="h-[calc(100vh-140px)] w-full rounded-3xl glass-card flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div class="text-4xl">📸</div>
        <h3 class="font-display font-bold text-lg text-white">No Campus Swipe Posts Yet</h3>
        <p class="text-xs text-gray-400 max-w-xs">Be the first NIT Agartala student to share a photo, video, or campus thought!</p>
        <button onclick="openCreatePostModal()" class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-vibe-coral to-pink-600 text-white font-display font-bold text-xs shadow-xl">
          + Share First Post
        </button>
      </div>
    `;
    return;
  }

  const users = getUsers();
  const myUsername = state.currentUser ? state.currentUser.username : '';

  container.innerHTML = state.swipePosts.map(post => {
    const authorObj = users.find(u => u.username === post.author) || {
      username: post.author,
      fullName: post.author,
      branch: 'NITA',
      presentYear: '',
      privacy: 'private',
      elo: 1200
    };
    const unlocked = canSeeIdentity(authorObj);
    const identityBadge = unlocked
      ? `<span class="text-[11px] text-vibe-emerald">${authorObj.fullName} • ${authorObj.branch} (${authorObj.presentYear})</span>`
      : `<span class="text-[11px] text-amber-400 font-mono">🔒 Private Student • ${authorObj.elo || 1200} ELO</span>`;

    const mediaEl = post.mediaType === 'video'
      ? `<video src="${post.mediaUrl}" controls loop class="w-full h-full object-cover"></video>`
      : `<img src="${post.mediaUrl}" class="w-full h-full object-cover select-none" alt="Swipe Media">`;

    const likedByMe = Array.isArray(post.likedByUsers) && post.likedByUsers.includes(myUsername);
    const likeCount = Array.isArray(post.likedByUsers) ? post.likedByUsers.length : (post.likes || 0);

    const commentsHTML = (post.comments || []).map(c =>
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
          <span class="px-3 py-1 rounded-full bg-surface-900/80 border border-surface-700 text-[11px] font-mono text-gray-300">${post.tag || 'Campus Post'}</span>
        </div>

        <div class="relative z-10 p-5 space-y-3">
          <div class="flex items-end justify-between gap-4">
            <p class="text-sm text-white leading-relaxed flex-1">${post.caption}</p>
            <div class="flex flex-col items-center gap-3 bg-surface-900/80 backdrop-blur-md p-2.5 rounded-2xl border border-surface-700">
              <button onclick="toggleLike(${post.id})" class="flex flex-col items-center">
                <span class="text-xl">${likedByMe ? '❤️' : '🤍'}</span>
                <span class="text-[11px] font-mono text-white mt-0.5">${likeCount}</span>
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
  if (container) container.scrollBy({ top: direction * container.clientHeight, behavior: 'smooth' });
}

function toggleLike(postId) {
  if (!state.currentUser || !socket) return;
  socket.emit('toggle_swipe_like', { postId, username: state.currentUser.username });
}

function doubleTapLike(postId) {
  toggleLike(postId);
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
  if (!text || !state.currentUser) return;
  if (socket) {
    socket.emit('add_swipe_comment', {
      postId,
      comment: { user: state.currentUser.username, text }
    });
  }
  input.value = '';
}

function openCreatePostModal() {
  document.getElementById('createPostModal').classList.remove('hidden');
}

function closeCreatePostModal() {
  document.getElementById('createPostModal').classList.add('hidden');
}

async function submitNewSwipePost(e) {
  e.preventDefault();
  const fileInput = document.getElementById('postMediaInput');
  const caption = document.getElementById('postCaptionInput').value.trim();
  let mediaUrl = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80';
  let mediaType = 'image';

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    mediaUrl = await fileToDataURL(file);
    mediaType = file.type.startsWith('video') ? 'video' : 'image';
  }

  const newPost = {
    id: Date.now(),
    author: state.currentUser.username,
    caption,
    mediaType,
    mediaUrl,
    likes: 1,
    likedByUsers: [state.currentUser.username],
    tag: 'Campus Post',
    comments: []
  };

  if (socket) {
    socket.emit('create_swipe_post', newPost);
  } else {
    state.swipePosts.unshift(newPost);
    renderSwipeFeed();
  }

  document.getElementById('postCaptionInput').value = '';
  fileInput.value = '';
  closeCreatePostModal();
  showToast('Published to Campus Swipe!', 'emerald');
}

// ================= LOUNGE & DIRECT MESSAGES (REAL-TIME CROSS-DEVICE) =================
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
  dmList.innerHTML = peers.length === 0
    ? `<div class="text-[11px] font-mono text-gray-500 px-2">No other students registered yet</div>`
    : peers.map(u => `
      <button onclick="selectChat('dm', '${u.username}')" class="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-mono flex items-center justify-between transition ${state.activeChatType === 'dm' && state.activeChatId === u.username ? 'bg-vibe-emerald/15 text-vibe-emerald font-bold' : 'text-gray-400 hover:bg-surface-850'}">
        <span>@${u.username}</span>
        <span class="text-[10px] text-vibe-amber">${u.elo || 1200}</span>
      </button>
    `).join('');

  document.getElementById('chatHeaderTitle').textContent = state.activeChatType === 'lounge' ? `#${state.activeChatId}` : `@${state.activeChatId}`;

  const convKey = getConversationKey(state.activeChatType, state.activeChatId);
  const msgs = state.messages[convKey] || [];
  const users = getUsers();
  const container = document.getElementById('messagesContainer');

  if (msgs.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-xs font-mono text-gray-500">No messages yet. Say hello!</div>`;
    return;
  }

  container.innerHTML = msgs.map(m => {
    const sender = users.find(u => u.username === m.sender) || { username: m.sender, privacy: 'private', elo: 1200 };
    const badge = canSeeIdentity(sender)
      ? `<span class="text-[10px] text-vibe-emerald">${sender.fullName} (${sender.branch}) • ${sender.elo || 1200} ELO</span>`
      : `<span class="text-[10px] text-amber-400">🔒 Private Identity • ${sender.elo || 1200} ELO</span>`;
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
        <p class="text-xs text-gray-200 mt-1 break-words">${m.text}</p>
        ${mediaHTML}
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function selectChat(type, id) {
  state.activeChatType = type;
  state.activeChatId = id;
  renderChatSection();
}

async function handleChatMedia(e) {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await fileToDataURL(file);
  state.chatMedia = {
    type: file.type.startsWith('video') ? 'video' : 'image',
    url: dataUrl,
    name: file.name
  };
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

  const convKey = getConversationKey(state.activeChatType, state.activeChatId);
  const msgObj = {
    sender: state.currentUser.username,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    media: state.chatMedia
  };

  if (socket) {
    socket.emit('send_chat_message', { chatId: convKey, message: msgObj });
  } else {
    if (!state.messages[convKey]) state.messages[convKey] = [];
    state.messages[convKey].push(msgObj);
    renderChatSection();
  }

  input.value = '';
  clearChatMedia();
}

// ================= HEADER, RIGHT RADAR & TWO-STEP FRIEND REQUESTS =================
function renderHeaderAndRadar() {
  const u = state.currentUser;
  if (!u) return;

  document.getElementById('myTopAvatar').textContent = u.username[0].toUpperCase();
  document.getElementById('myTopUsername').textContent = `@${u.username}`;
  document.getElementById('myTopActivity').textContent = u.activityText;
  document.getElementById('privacyToggleBtn').textContent = u.privacy === 'private' ? '🔒 Private' : '🌐 Public';
  document.getElementById('pendingReqBadge').textContent = state.incomingRequests.length;

  const eloBadge = document.getElementById('myTopEloBadge');
  if (eloBadge) eloBadge.textContent = `${state.currentUser.elo || 1200} ELO`;

  const all = getUsers();
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

  if (typeof renderArcadeInvitesUI === 'function') renderArcadeInvitesUI();
}

function renderFriendsTab() {
  const users = getUsers();
  document.getElementById('requestsGrid').innerHTML = state.incomingRequests.length === 0
    ? `<div class="text-xs text-gray-500 font-mono">No pending friend requests</div>`
    : state.incomingRequests.map(uname => `
      <div class="p-4 rounded-2xl bg-surface-900 border border-surface-800 flex items-center justify-between">
        <div>
          <div class="font-mono font-bold text-sm text-white">@${uname}</div>
          <div class="text-[11px] text-amber-400">🔒 Wants to connect & unlock identity</div>
        </div>
        <button onclick="acceptFriend('${uname}')" class="px-3.5 py-2 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">Accept Request</button>
      </div>
    `).join('');

  document.getElementById('friendsGrid').innerHTML = state.friends.length === 0
    ? `<div class="text-xs text-gray-500 font-mono">No connected friends yet. Click any user on the right radar to send a request!</div>`
    : state.friends.map(uname => {
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

function sendFriendRequest(targetUsername) {
  if (!state.currentUser || targetUsername === state.currentUser.username) return;
  if (socket) {
    socket.emit('send_friend_request', {
      from: state.currentUser.username,
      to: targetUsername
    });
  }
  closePeerModal();
  showToast(`📩 Friend request sent to @${targetUsername}! Waiting for them to accept.`, 'emerald');
}

function acceptFriend(requesterUsername) {
  if (!state.currentUser) return;
  if (socket) {
    socket.emit('accept_friend_request', {
      user: state.currentUser.username,
      requester: requesterUsername
    });
  }
  closePeerModal();
  showToast(`🎉 You and @${requesterUsername} are now friends! Identity unlocked.`, 'emerald');
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

  const isMe = state.currentUser && target.username === state.currentUser.username;
  const isFriend = state.friends.includes(target.username);
  const isIncoming = state.incomingRequests.includes(target.username);
  const isOutgoing = state.outgoingRequests.includes(target.username);

  let friendActionBtn = '';
  if (isFriend) {
    friendActionBtn = `<button disabled class="py-2.5 rounded-xl bg-surface-800 text-vibe-emerald font-mono font-bold text-xs">✓ Friends</button>`;
  } else if (isIncoming) {
    friendActionBtn = `<button onclick="acceptFriend('${target.username}')" class="py-2.5 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">✓ Accept Request</button>`;
  } else if (isOutgoing) {
    friendActionBtn = `<button disabled class="py-2.5 rounded-xl bg-surface-800 text-vibe-amber font-mono font-bold text-xs">⏳ Request Sent</button>`;
  } else {
    friendActionBtn = `<button onclick="sendFriendRequest('${target.username}')" class="py-2.5 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">+ Send Request</button>`;
  }

  document.getElementById('modalActionBtns').innerHTML = isMe ? '' : `
    <div class="grid grid-cols-2 gap-2">
      ${friendActionBtn}
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
  setTimeout(() => el.remove(), 3200);
}

window.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
});
// ============================================================================
// PRODUCTION BACKEND: EXPRESS REST API + SOCKET.IO + PERSISTENT DATABASE
// ============================================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e7 // Allow up to 10MB base64 photo/video uploads
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'database.json');

// Default clean production state (No bots, no fake trial posts)
let db = {
  users: [],
  swipePosts: [],
  messages: {
    'general-nita': [],
    'ece-hub': [],
    'badminton-club': [],
    'gaming-squad': []
  },
  roomMessages: {
    'lofi-nita': [],
    'bollywood-jam': [],
    'gaming-synth': []
  },
  arcadeChat: [],
  friendships: {},       // { username: ['friend1', 'friend2'] }
  incomingRequests: {},  // { username: ['sender1'] }
  outgoingRequests: {}   // { username: ['target1'] }
};

// Load saved database if it exists on disk
if (fs.existsSync(DB_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db = { ...db, ...loaded };
  } catch (e) {
    console.error('Error reading database.json, starting fresh.');
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Error saving database.json:', e);
  }
}

// REST endpoint so any browser can fetch the latest state on load
app.get('/api/state', (req, res) => {
  res.json(db);
});

io.on('connection', (socket) => {
  // Send current master state immediately when a student opens the site
  socket.emit('sync_state', db);

  // 1. User Registration / Login / Status / ELO Update
  socket.on('upsert_user', (userObj) => {
    if (!userObj || !userObj.username) return;
    const idx = db.users.findIndex(u => u.username === userObj.username);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...userObj };
    } else {
      db.users.push(userObj);
    }
    if (!db.friendships[userObj.username]) db.friendships[userObj.username] = [];
    if (!db.incomingRequests[userObj.username]) db.incomingRequests[userObj.username] = [];
    if (!db.outgoingRequests[userObj.username]) db.outgoingRequests[userObj.username] = [];
    saveDB();
    io.emit('sync_users', {
      users: db.users,
      friendships: db.friendships,
      incomingRequests: db.incomingRequests,
      outgoingRequests: db.outgoingRequests
    });
  });

  // 2. Real Two-Step Friend Request Flow
  socket.on('send_friend_request', ({ from, to }) => {
    if (!from || !to || from === to) return;
    if (!db.incomingRequests[to]) db.incomingRequests[to] = [];
    if (!db.outgoingRequests[from]) db.outgoingRequests[from] = [];
    if (!db.friendships[from]) db.friendships[from] = [];

    // Ignore if already friends or request already pending
    if (db.friendships[from].includes(to) || db.incomingRequests[to].includes(from)) return;

    db.incomingRequests[to].push(from);
    db.outgoingRequests[from].push(to);
    saveDB();

    io.emit('sync_friends', {
      friendships: db.friendships,
      incomingRequests: db.incomingRequests,
      outgoingRequests: db.outgoingRequests,
      notifyTarget: to,
      notifyFrom: from,
      type: 'request_sent'
    });
  });

  socket.on('accept_friend_request', ({ user, requester }) => {
    if (!user || !requester) return;
    if (!db.friendships[user]) db.friendships[user] = [];
    if (!db.friendships[requester]) db.friendships[requester] = [];

    if (!db.friendships[user].includes(requester)) db.friendships[user].push(requester);
    if (!db.friendships[requester].includes(user)) db.friendships[requester].push(user);

    db.incomingRequests[user] = (db.incomingRequests[user] || []).filter(u => u !== requester);
    db.outgoingRequests[requester] = (db.outgoingRequests[requester] || []).filter(u => u !== user);
    // Also clean reverse pending if any
    db.incomingRequests[requester] = (db.incomingRequests[requester] || []).filter(u => u !== user);
    db.outgoingRequests[user] = (db.outgoingRequests[user] || []).filter(u => u !== requester);

    saveDB();
    io.emit('sync_friends', {
      friendships: db.friendships,
      incomingRequests: db.incomingRequests,
      outgoingRequests: db.outgoingRequests,
      notifyTarget: requester,
      notifyFrom: user,
      type: 'request_accepted'
    });
  });

  // 3. Real-Time Lounge & Direct Messages (DMs)
  socket.on('send_chat_message', ({ chatId, message }) => {
    if (!chatId || !message) return;
    if (!db.messages[chatId]) db.messages[chatId] = [];
    db.messages[chatId].push(message);
    saveDB();
    io.emit('new_chat_message', { chatId, message });
  });

  // 4. Persistent Campus Swipe Posts & Likes/Comments
  socket.on('create_swipe_post', (newPost) => {
    if (!newPost) return;
    db.swipePosts.unshift(newPost);
    saveDB();
    io.emit('sync_swipe_posts', db.swipePosts);
  });

  socket.on('toggle_swipe_like', ({ postId, username }) => {
    const post = db.swipePosts.find(p => p.id === postId);
    if (!post) return;
    if (!post.likedByUsers) post.likedByUsers = [];
    if (post.likedByUsers.includes(username)) {
      post.likedByUsers = post.likedByUsers.filter(u => u !== username);
    } else {
      post.likedByUsers.push(username);
    }
    post.likes = post.likedByUsers.length;
    saveDB();
    io.emit('sync_swipe_posts', db.swipePosts);
  });

  socket.on('add_swipe_comment', ({ postId, comment }) => {
    const post = db.swipePosts.find(p => p.id === postId);
    if (!post) return;
    post.comments.push(comment);
    saveDB();
    io.emit('sync_swipe_posts', db.swipePosts);
  });

  // 5. Music Room Chat & Invites
  socket.on('send_music_chat', ({ roomId, message }) => {
    if (!db.roomMessages[roomId]) db.roomMessages[roomId] = [];
    db.roomMessages[roomId].push(message);
    saveDB();
    io.emit('sync_music_chat', { roomId, roomMessages: db.roomMessages });
  });

  // 6. Arcade Match Invites, Moves & Arena Chat
  socket.on('arcade_event', (payload) => {
    if (payload.type === 'ARCADE_CHAT') {
      db.arcadeChat.push(payload.msg);
      saveDB();
    }
    io.emit('arcade_event', payload);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`frien. Production Server running on port ${PORT}`);
});
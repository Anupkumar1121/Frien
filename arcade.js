// ============================================================================
// RANKED ARCADE: CHESS.JS + STOCKFISH API + SOCKET.IO MULTIPLAYER SYNC
// ============================================================================

let chessEngine = null;
(function ensureChessLibrary() {
  if (typeof Chess !== 'undefined') {
    chessEngine = new Chess();
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';
    script.onload = () => {
      chessEngine = new Chess();
      if (state.activeTab === 'arcade') renderActiveGameBoard();
    };
    document.head.appendChild(script);
  }
})();

// Cross-device Socket.io transport bridge for Arcade & Chess moves
const liveChannel = {
  postMessage: (payload) => {
    if (typeof socket !== 'undefined' && socket) socket.emit('arcade_event', payload);
  },
  onmessage: null
};

if (typeof socket !== 'undefined' && socket) {
  socket.on('arcade_event', (payload) => {
    if (typeof liveChannel.onmessage === 'function') {
      liveChannel.onmessage({ data: payload });
    }
  });
}

const ARCADE_GAMES = [
  { id: 'chess', name: 'Live Campus Chess', icon: '♟️', genre: 'Chess.js + Stockfish API', players: 4 },
  { id: 'tictactoe', name: 'Neon Tic-Tac-Toe', icon: '❌', genre: 'Classic Duel', players: 6 },
  { id: 'connect4', name: 'Connect 4 Drop', icon: '🔴', genre: 'Tactical Grid', players: 3 },
  { id: 'rps', name: 'Rock Paper Scissors', icon: '✂️', genre: 'First to 3', players: 5 },
  { id: 'memory', name: 'Campus Memory Flip', icon: '🧠', genre: '2P Pair Race', players: 2 },
  { id: 'minesweeper', name: 'Cyber Minesweeper', icon: '💣', genre: 'Survival Duel', players: 4 },
  { id: 'wordscramble', name: 'NITA Word Scramble', icon: '🔤', genre: 'First to 30 pts', players: 3 },
  { id: 'speedmath', name: 'Engineering Blitz Math', icon: '⚡', genre: 'First to 25 pts', players: 7 },
  { id: 'reflex', name: 'Valorant Reflex Duel', icon: '🎯', genre: 'Sub-320ms Challenge', players: 5 },
  { id: 'codebreaker', name: '3-Digit Code Breaker', icon: '🔐', genre: 'Vault Race', players: 2 }
];

const CHESS_UNICODE = {
  wp: '♙', wr: '♖', wn: '♘', wb: '♗', wq: '♕', wk: '♔',
  bp: '♟', br: '♜', bn: '♞', bb: '♝', bq: '♛', bk: '♚'
};

let arcadeState = {
  activeGame: 'chess',
  mode: 'play',
  opponentSeated: false,
  opponent: null,
  isLiveHumanOpponent: false,
  spectators: [],
  incomingMatchInvites: [],
  arcadeChat: [],
  chessSelectedSquare: null,
  chessLegalTargets: [],
  chessLastMove: null,
  chessBotThinking: false,
  tttBoard: Array(9).fill(''),
  tttTurn: 'X',
  tttWinner: null,
  c4Board: Array(6).fill(null).map(() => Array(7).fill('')),
  c4Turn: 'Emerald',
  c4Winner: null,
  rpsScore: { me: 0, peer: 0 },
  rpsLastResult: 'First to 3 wins the Ranked ELO match!',
  memoryCards: [],
  memoryFlipped: [],
  memoryMatched: [],
  mineGrid: [],
  mineSafeCount: 0,
  mineGameOver: false,
  scrambleWord: 'AGARTALA',
  scrambleScrambled: 'AALRGTAA',
  scrambleScore: 0,
  mathQ: '14 × 6',
  mathAns: 84,
  mathScore: 0,
  reflexState: 'idle',
  reflexStart: 0,
  reflexBest: null,
  secretCode: '742',
  codeHistory: []
};

liveChannel.onmessage = (event) => {
  const data = event.data;
  if (!data || !state.currentUser) return;

  if (data.type === 'CHESS_MOVE' && chessEngine) {
    chessEngine.load(data.fen);
    arcadeState.chessLastMove = data.lastMove;
    arcadeState.chessSelectedSquare = null;
    arcadeState.chessLegalTargets = [];
    renderActiveGameBoard();
  } else if (data.type === 'MATCH_INVITE' && data.to === state.currentUser.username) {
    arcadeState.incomingMatchInvites.unshift(data.invite);
    showToast(`⚔️ New 1v1 ${data.invite.gameName} invite from @${data.invite.from}!`, 'emerald');
    renderArcadeInvitesUI();
  } else if (data.type === 'INVITE_ACCEPTED' && data.host === state.currentUser.username) {
    arcadeState.opponent = data.joiner;
    arcadeState.opponentSeated = true;
    arcadeState.isLiveHumanOpponent = true;
    showToast(`@${data.joiner} joined your board live!`, 'emerald');
    renderArcadeAll();
  } else if (data.type === 'ARCADE_CHAT') {
    arcadeState.arcadeChat.push(data.msg);
    renderArcadeChat();
  }
};

function calculateAndApplyELO(winnerUsername, loserUsername) {
  const users = getUsers();
  const winIdx = users.findIndex(u => u.username === winnerUsername);
  const loseIdx = users.findIndex(u => u.username === loserUsername);

  const rA = winIdx !== -1 ? (users[winIdx].elo || 1200) : 1200;
  const rB = loseIdx !== -1 ? (users[loseIdx].elo || 1200) : 1200;

  const expectedWin = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const delta = Math.max(12, Math.round(32 * (1 - expectedWin)));

  if (winIdx !== -1) users[winIdx].elo = rA + delta;
  if (loseIdx !== -1) users[loseIdx].elo = Math.max(800, rB - delta);

  saveUsers(users);
  if (socket) socket.emit('upsert_user', users[winIdx] || users[loseIdx]);

  if (state.currentUser) {
    if (state.currentUser.username === winnerUsername) state.currentUser.elo = rA + delta;
    if (state.currentUser.username === loserUsername) state.currentUser.elo = Math.max(800, rB - delta);
  }

  const gameObj = ARCADE_GAMES.find(g => g.id === arcadeState.activeGame) || ARCADE_GAMES[0];
  const msgObj = {
    sender: 'arena_bot',
    text: `🏆 RANKED RESULT (${gameObj.name}): @${winnerUsername} (+${delta} ELO) defeated @${loserUsername} (-${delta} ELO)!`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  arcadeState.arcadeChat.push(msgObj);
  liveChannel.postMessage({ type: 'ARCADE_CHAT', msg: msgObj });

  showToast(`🏆 @${winnerUsername} won (+${delta} ELO)`, 'emerald');
  renderHeaderAndRadar();
  renderArcadeAll();
}

function renderArcadeAll() {
  renderArcadeGamesList();
  renderArcadeInvitesUI();
  renderArcadeLeaderboard();
  renderArcadeHeaderAndLobby();
  renderActiveGameBoard();
  renderArcadeChat();
  renderArcadeInviteList();
}

function selectArcadeGame(gameId) {
  if (arcadeState.activeGame !== gameId) {
    arcadeState.activeGame = gameId;
    arcadeState.opponentSeated = false;
    arcadeState.opponent = null;
  }
  const g = ARCADE_GAMES.find(x => x.id === gameId);
  if (g) setActivity('online', `🕹️ In ${g.name} Lobby (1/2)`);
  renderArcadeAll();
}

function acceptIncomingMatchInvite(inviteId) {
  const inv = arcadeState.incomingMatchInvites.find(i => i.id === inviteId);
  if (!inv) return;

  arcadeState.incomingMatchInvites = arcadeState.incomingMatchInvites.filter(i => i.id !== inviteId);
  arcadeState.activeGame = inv.gameId;
  arcadeState.mode = 'play';
  arcadeState.opponent = inv.from;
  arcadeState.opponentSeated = true;
  arcadeState.isLiveHumanOpponent = inv.isLiveTab || false;

  if (state.activeTab !== 'arcade') switchTab('arcade');

  resetBoardStateOnly(inv.gameId);
  setActivity('online', `🎮 Playing ${inv.gameName} vs @${inv.from}`);

  if (state.currentUser) {
    liveChannel.postMessage({
      type: 'INVITE_ACCEPTED',
      host: inv.from,
      joiner: state.currentUser.username
    });
  }

  arcadeState.arcadeChat.push({
    sender: inv.from,
    text: `Accepted your ${inv.gameName} challenge! Match started.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  showToast(`Joined @${inv.from}'s board! Match Started!`, 'emerald');
  renderArcadeAll();
  renderHeaderAndRadar();
}

function invitePeerToArcade(username, role = 'play') {
  const g = ARCADE_GAMES.find(x => x.id === arcadeState.activeGame) || ARCADE_GAMES[0];
  if (role === 'play') {
    arcadeState.opponent = username;
    arcadeState.opponentSeated = true;
    arcadeState.isLiveHumanOpponent = false;
    arcadeState.mode = 'play';
    resetBoardStateOnly(g.id);

    if (state.currentUser) {
      liveChannel.postMessage({
        type: 'MATCH_INVITE',
        to: username,
        invite: {
          id: 'inv-' + Date.now(),
          from: state.currentUser.username,
          gameId: g.id,
          gameName: g.name,
          icon: g.icon,
          isLiveTab: true
        }
      });
    }

    setActivity('online', `🎮 Playing ${g.name} vs @${username}`);
    showToast(`@${username} invited to ${g.name}!`, 'emerald');
  } else {
    if (!arcadeState.spectators.includes(username)) arcadeState.spectators.push(username);
    showToast(`@${username} is spectating!`, 'emerald');
  }
  renderHeaderAndRadar();
  renderArcadeAll();
}

function leaveOrResetBoard() {
  arcadeState.opponentSeated = false;
  arcadeState.opponent = null;
  showToast('Left active match board.', 'coral');
  renderArcadeAll();
}

function renderArcadeInvitesUI() {
  const count = arcadeState.incomingMatchInvites.length;
  const topBadge = document.getElementById('arcadeInviteBadge');
  const openCount = document.getElementById('openInvitesCount');
  if (topBadge) {
    topBadge.textContent = count;
    topBadge.classList.toggle('hidden', count === 0);
  }
  if (openCount) openCount.textContent = count;

  const html = count === 0
    ? `<div class="text-[10px] font-mono text-gray-500">No open match invites.</div>`
    : arcadeState.incomingMatchInvites.map(inv => `
      <div class="p-2 rounded-xl bg-surface-900/90 border border-vibe-amber/30 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-white truncate">${inv.icon} ${inv.gameName}</div>
          <div class="text-[10px] font-mono text-vibe-amber truncate">From @${inv.from}</div>
        </div>
        <button onclick="acceptIncomingMatchInvite('${inv.id}')" class="px-2.5 py-1 rounded-lg bg-vibe-emerald text-surface-950 font-mono font-bold text-[10px] shrink-0 hover:bg-emerald-400">
          Join
        </button>
      </div>
    `).join('');

  const arcadeList = document.getElementById('arcadeIncomingInvitesList');
  if (arcadeList) arcadeList.innerHTML = html;

  const radarList = document.getElementById('radarInvitesList');
  const radarBox = document.getElementById('radarInvitesBox');
  if (radarList) radarList.innerHTML = html;
  if (radarBox) radarBox.classList.toggle('hidden', count === 0);
}

function renderArcadeLeaderboard() {
  const box = document.getElementById('arcadeLeaderboardList');
  if (!box || typeof getUsers !== 'function') return;

  const sorted = [...getUsers()].sort((a, b) => (b.elo || 1200) - (a.elo || 1200));
  box.innerHTML = sorted.map((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const isMe = state.currentUser && u.username === state.currentUser.username;
    return `
      <div onclick="openPeerModal('${u.username}')" class="cursor-pointer flex items-center justify-between px-2 py-1 rounded-lg text-[11px] font-mono ${isMe ? 'bg-vibe-emerald/15 text-vibe-emerald font-bold' : 'text-gray-300 hover:bg-surface-900'}">
        <span class="truncate">${medal} @${u.username}</span>
        <span class="text-vibe-amber font-bold">${u.elo || 1200}</span>
      </div>
    `;
  }).join('');
}

function renderArcadeGamesList() {
  const list = document.getElementById('arcadeGamesList');
  if (!list) return;

  list.innerHTML = ARCADE_GAMES.map(g => {
    const active = arcadeState.activeGame === g.id;
    return `
      <button onclick="selectArcadeGame('${g.id}')" class="w-full p-2 rounded-2xl flex items-center justify-between text-left transition ${active ? 'bg-vibe-emerald/15 border border-vibe-emerald/40 text-white' : 'hover:bg-surface-850 text-gray-300'}">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-base">${g.icon}</span>
          <div class="min-w-0">
            <div class="text-xs font-bold truncate">${g.name}</div>
            <div class="text-[9px] font-mono text-gray-400">${g.genre}</div>
          </div>
        </div>
        <span class="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-surface-900 text-vibe-emerald">${g.players}p</span>
      </button>
    `;
  }).join('');
}

function renderArcadeHeaderAndLobby() {
  const g = ARCADE_GAMES.find(x => x.id === arcadeState.activeGame) || ARCADE_GAMES[0];
  const titleEl = document.getElementById('arcadeActiveTitle');
  const subEl = document.getElementById('arcadeActiveSub');
  const badgeEl = document.getElementById('arcadeRoomStateBadge');
  const lobbyOverlay = document.getElementById('arcadeLobbyOverlay');
  const boardContainer = document.getElementById('arcadeBoardContainer');

  if (titleEl) titleEl.textContent = `${g.icon} ${g.name}`;

  const canShowBoard = arcadeState.opponentSeated || arcadeState.mode === 'spectate';

  if (badgeEl) {
    if (arcadeState.mode === 'spectate') {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-vibe-amber/20 text-vibe-amber border border-vibe-amber/30';
      badgeEl.textContent = '👀 Spectating (2/2)';
    } else if (arcadeState.opponentSeated) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-vibe-emerald/20 text-vibe-emerald border border-vibe-emerald/30';
      badgeEl.textContent = `🟢 Match Live (2/2)`;
    } else {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-vibe-amber/20 text-vibe-amber border border-vibe-amber/30';
      badgeEl.textContent = '🔒 Waiting for Player 2 (1/2)';
    }
  }

  if (subEl) {
    subEl.textContent = arcadeState.opponentSeated
      ? `Ranked Board Active vs @${arcadeState.opponent}`
      : `Board locked until 2 players join`;
  }

  if (lobbyOverlay && boardContainer) {
    lobbyOverlay.classList.toggle('hidden', canShowBoard);
    boardContainer.classList.toggle('hidden', !canShowBoard);
  }

  const me = state.currentUser || { username: 'you', elo: 1200 };
  const s1Av = document.getElementById('seat1Avatar');
  const s1Nm = document.getElementById('seat1Name');
  const s1El = document.getElementById('seat1Elo');
  if (s1Av) s1Av.textContent = me.username[0].toUpperCase();
  if (s1Nm) s1Nm.textContent = `@${me.username}`;
  if (s1El) s1El.textContent = `${me.elo || 1200} ELO`;
}

function toggleArcadeMode(newMode) {
  arcadeState.mode = newMode;
  renderArcadeAll();
}

function resetBoardStateOnly(id) {
  if (id === 'chess') {
    if (typeof Chess !== 'undefined') chessEngine = new Chess();
    arcadeState.chessSelectedSquare = null;
    arcadeState.chessLegalTargets = [];
    arcadeState.chessLastMove = null;
    arcadeState.chessBotThinking = false;
  }
}

function renderActiveGameBoard() {
  const box = document.getElementById('arcadeBoardContainer');
  if (!box) return;
  if (!arcadeState.opponentSeated && arcadeState.mode !== 'spectate') return;

  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'opponent';

  const topMatchBar = `<div class="w-full max-w-md mb-3 px-4 py-2 rounded-2xl bg-surface-900 border border-vibe-emerald/30 text-xs font-mono flex items-center justify-between">
    <span class="text-vibe-emerald font-bold">⚪ White: @${myHandle}</span>
    <span class="text-gray-500">VS</span>
    <span class="text-vibe-coral font-bold">🔴 Black: @${oppHandle}</span>
  </div>`;

  box.innerHTML = topMatchBar + renderChessUI();
}

// ================= CHESS.JS + STOCKFISH API =================
function renderChessUI() {
  if (!chessEngine && typeof Chess !== 'undefined') chessEngine = new Chess();
  if (!chessEngine) return `<div class="text-xs font-mono text-vibe-emerald animate-pulse p-8">Loading Chess engine...</div>`;

  const board = chessEngine.board();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const turnColor = chessEngine.turn() === 'w' ? 'White (Your Turn)' : `Black (@${arcadeState.opponent || 'opponent'} Thinking...)`;
  const history = chessEngine.history();

  let html = `
    <div class="flex flex-col items-center space-y-2.5">
      <div class="text-xs font-mono text-gray-200">
        <span class="text-vibe-emerald font-bold">${turnColor}</span>
      </div>
      <div class="grid grid-cols-8 border-2 border-surface-700 rounded-2xl overflow-hidden shadow-2xl select-none">
  `;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = files[c] + (8 - r);
      const isDark = (r + c) % 2 === 1;
      const isSelected = arcadeState.chessSelectedSquare === sq;
      const isLegalTarget = arcadeState.chessLegalTargets.includes(sq);

      const cellObj = board[r][c];
      const symbol = cellObj ? CHESS_UNICODE[cellObj.color + cellObj.type] : '';
      const pieceStyle = cellObj
        ? (cellObj.color === 'w' ? 'text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] scale-105' : 'text-vibe-coral drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]')
        : '';

      let bgClass = isDark ? 'bg-surface-800 hover:bg-surface-700' : 'bg-surface-900 hover:bg-surface-850';
      if (isSelected) bgClass = 'bg-vibe-emerald/40 ring-2 ring-inset ring-vibe-emerald';

      html += `
        <button onclick="handleChessSquareClick('${sq}')" class="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-2xl sm:text-3xl transition ${bgClass}">
          <span class="${pieceStyle}">${symbol}</span>
          ${isLegalTarget ? `<span class="absolute w-3 h-3 rounded-full ${cellObj ? 'ring-4 ring-vibe-emerald bg-transparent w-9 h-9' : 'bg-vibe-emerald/80 shadow-lg'} pointer-events-none"></span>` : ''}
        </button>
      `;
    }
  }

  html += `
      </div>
    </div>
  `;
  return html;
}

function handleChessSquareClick(sq) {
  if (arcadeState.mode === 'spectate' || !chessEngine || arcadeState.chessBotThinking) return;
  if (chessEngine.game_over()) return;

  if (arcadeState.chessSelectedSquare && arcadeState.chessLegalTargets.includes(sq)) {
    const moveObj = chessEngine.move({ from: arcadeState.chessSelectedSquare, to: sq, promotion: 'q' });
    if (moveObj) {
      arcadeState.chessLastMove = { from: moveObj.from, to: moveObj.to };
      arcadeState.chessSelectedSquare = null;
      arcadeState.chessLegalTargets = [];

      liveChannel.postMessage({ type: 'CHESS_MOVE', fen: chessEngine.fen(), lastMove: arcadeState.chessLastMove });
      renderActiveGameBoard();
      checkChessEndgameOrTriggerOpponent();
      return;
    }
  }

  const pieceOnSq = chessEngine.get(sq);
  if (pieceOnSq && pieceOnSq.color === chessEngine.turn()) {
    arcadeState.chessSelectedSquare = sq;
    arcadeState.chessLegalTargets = chessEngine.moves({ square: sq, verbose: true }).map(m => m.to);
  } else {
    arcadeState.chessSelectedSquare = null;
    arcadeState.chessLegalTargets = [];
  }
  renderActiveGameBoard();
}

async function checkChessEndgameOrTriggerOpponent() {
  if (!chessEngine) return;
  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'opponent';

  if (chessEngine.in_checkmate()) {
    const winner = chessEngine.turn() === 'b' ? myHandle : oppHandle;
    const loser = winner === myHandle ? oppHandle : myHandle;
    calculateAndApplyELO(winner, loser);
    return;
  }

  if (chessEngine.turn() === 'b' && !arcadeState.isLiveHumanOpponent) {
    arcadeState.chessBotThinking = true;
    renderActiveGameBoard();
    setTimeout(async () => {
      await makeStockfishOrSmartMove();
      arcadeState.chessBotThinking = false;
      renderActiveGameBoard();
      if (chessEngine.in_checkmate()) calculateAndApplyELO(oppHandle, myHandle);
    }, 600);
  }
}

async function makeStockfishOrSmartMove() {
  if (!chessEngine || chessEngine.game_over()) return;
  try {
    const res = await fetch(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(chessEngine.fen())}&depth=5`);
    const data = await res.json();
    if (data && data.success && data.bestmove) {
      const uci = data.bestmove.split(' ')[1];
      if (uci && uci.length >= 4) {
        const mv = chessEngine.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: 'q' });
        if (mv) arcadeState.chessLastMove = { from: mv.from, to: mv.to };
        return;
      }
    }
  } catch (e) {}

  const legal = chessEngine.moves({ verbose: true });
  if (legal.length > 0) chessEngine.move(legal[0]);
}

function renderArcadeChat() {
  const box = document.getElementById('arcadeChatContainer');
  if (!box) return;
  box.innerHTML = arcadeState.arcadeChat.map(m => `
    <div class="text-xs bg-surface-900/70 p-2 rounded-xl border border-surface-800">
      <div class="flex justify-between font-mono">
        <span class="text-vibe-emerald font-bold">@${m.sender}</span>
        <span class="text-[9px] text-gray-500">${m.time}</span>
      </div>
      <p class="text-gray-200 mt-0.5">${m.text}</p>
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

function sendArcadeChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('arcadeChatInput');
  if (!input || !input.value.trim()) return;
  const msgObj = { sender: state.currentUser.username, text: input.value.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  arcadeState.arcadeChat.push(msgObj);
  liveChannel.postMessage({ type: 'ARCADE_CHAT', msg: msgObj });
  input.value = '';
  renderArcadeChat();
}

function sendQuickReaction(emote) {
  const msgObj = { sender: state.currentUser.username, text: `Reaction: ${emote}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  arcadeState.arcadeChat.push(msgObj);
  liveChannel.postMessage({ type: 'ARCADE_CHAT', msg: msgObj });
  renderArcadeChat();
}

function renderArcadeInviteList() {
  const box = document.getElementById('arcadeInvitePeersList');
  if (!box || typeof getUsers !== 'function') return;
  const peers = getUsers().filter(u => u.username !== state.currentUser?.username);
  box.innerHTML = peers.map(u => `
    <div class="flex items-center justify-between p-2 rounded-xl bg-surface-950 border border-surface-800">
      <div class="min-w-0">
        <span class="text-xs font-mono font-bold text-white truncate">@${u.username}</span>
      </div>
      <button onclick="invitePeerToArcade('${u.username}', 'play')" class="px-2.5 py-1 rounded-lg bg-vibe-emerald text-surface-950 font-mono font-bold text-[10px]">
        + Invite 1v1
      </button>
    </div>
  `).join('');
}
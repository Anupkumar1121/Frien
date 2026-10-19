// ============================================================================
// PHASE 4 & 5: EXTERNAL CHESS.JS + STOCKFISH API + LIVE MULTI-TAB SYNC ENGINE
// ============================================================================

// Dynamically ensure chess.js is loaded even if index.html wasn't updated yet
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

// Real-Time Multi-Tab Sync Channel (Play across 2 browser tabs on your laptop!)
const liveChannel = new BroadcastChannel('frien_nita_live_sync');

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
  mode: 'play', // 'play' or 'spectate'
  opponentSeated: false,
  opponent: null,
  isLiveHumanOpponent: false,
  spectators: ['khushi_nita'],
  incomingMatchInvites: [
    { id: 'inv-1', from: 'ayush_mech', gameId: 'chess', gameName: 'Live Campus Chess', icon: '♟️' },
    { id: 'inv-2', from: 'rohan_cse', gameId: 'connect4', gameName: 'Connect 4 Drop', icon: '🔴' }
  ],
  arcadeChat: [
    { sender: 'ayush_mech', text: 'Chess now runs on Chess.js + Stockfish API! Accept my invite on the left to play.', time: '10:30 PM' }
  ],
  // 1. Chess State (Powered by Chess.js)
  chessSelectedSquare: null,
  chessLegalTargets: [],
  chessLastMove: null,
  chessBotThinking: false,
  // 2. Tic Tac Toe State
  tttBoard: Array(9).fill(''),
  tttTurn: 'X',
  tttWinner: null,
  // 3. Connect 4 State
  c4Board: Array(6).fill(null).map(() => Array(7).fill('')),
  c4Turn: 'Emerald',
  c4Winner: null,
  // 4. RPS State
  rpsScore: { me: 0, peer: 0 },
  rpsLastResult: 'First to 3 wins the Ranked ELO match!',
  // 5. Memory State
  memoryCards: [],
  memoryFlipped: [],
  memoryMatched: [],
  // 6. Minesweeper State
  mineGrid: [],
  mineSafeCount: 0,
  mineGameOver: false,
  // 7. Word Scramble State
  scrambleWord: 'AGARTALA',
  scrambleScrambled: 'AALRGTAA',
  scrambleScore: 0,
  // 8. Speed Math State
  mathQ: '14 × 6',
  mathAns: 84,
  mathScore: 0,
  // 9. Reflex State
  reflexState: 'idle',
  reflexStart: 0,
  reflexBest: null,
  // 10. Code Breaker State
  secretCode: '742',
  codeHistory: []
};

// ================= MULTI-TAB REAL-TIME SYNC LISTENER =================
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
    showToast(`@${data.joiner} joined your board live from another tab!`, 'emerald');
    renderArcadeAll();
  } else if (data.type === 'ARCADE_CHAT') {
    arcadeState.arcadeChat.push(data.msg);
    renderArcadeChat();
  }
};

// ================= REAL ELO RATING CALCULATION (K = 32) =================
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

  showToast(`🏆 @${winnerUsername} won! Rating updated (+${delta} ELO)`, 'emerald');
  renderHeaderAndRadar();
  renderArcadeAll();
}

// ================= LOBBY, INVITES & LEADERBOARD RENDERING =================
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

  if (inv.isLiveTab && state.currentUser) {
    liveChannel.postMessage({
      type: 'INVITE_ACCEPTED',
      host: inv.from,
      joiner: state.currentUser.username
    });
  }

  arcadeState.arcadeChat.push({
    sender: inv.from,
    text: `Glad you accepted my ${inv.gameName} challenge! You are White (bottom)—make your first move!`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  showToast(`Joined @${inv.from}'s board! 2/2 Players Ready — Match Started!`, 'emerald');
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

    // Also broadcast invite to other open browser tabs in case that user is logged in there!
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

    const users = getUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx !== -1) {
      users[idx].statusState = 'online';
      users[idx].activityText = `🎮 In ${g.name} vs @${state.currentUser ? state.currentUser.username : 'you'}`;
      saveUsers(users);
    }

    setActivity('online', `🎮 Playing ${g.name} vs @${username}`);

    arcadeState.arcadeChat.push({
      sender: username,
      text: `Accepted your 1v1 invite for ${g.name}! Both of us are seated on the board—your move!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    showToast(`@${username} joined your board (2/2)! Game started!`, 'emerald');
  } else {
    if (!arcadeState.spectators.includes(username)) arcadeState.spectators.push(username);
    showToast(`@${username} is now spectating the board!`, 'emerald');
  }
  renderHeaderAndRadar();
  renderArcadeAll();
}

function leaveOrResetBoard() {
  if (arcadeState.opponentSeated) {
    arcadeState.opponentSeated = false;
    arcadeState.opponent = null;
    showToast('Left active match board. Returned to 1/2 Waiting Lobby.', 'coral');
  } else {
    resetBoardStateOnly(arcadeState.activeGame);
    showToast('Lobby reset!', 'emerald');
  }
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
    ? `<div class="text-[10px] font-mono text-gray-500">No open match invites right now.</div>`
    : arcadeState.incomingMatchInvites.map(inv => `
      <div class="p-2 rounded-xl bg-surface-900/90 border border-vibe-amber/30 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-white truncate">${inv.icon} ${inv.gameName}</div>
          <div class="text-[10px] font-mono text-vibe-amber truncate">From @${inv.from} (1/2 waiting)</div>
        </div>
        <button onclick="acceptIncomingMatchInvite('${inv.id}')" class="px-2.5 py-1 rounded-lg bg-vibe-emerald text-surface-950 font-mono font-bold text-[10px] shrink-0 hover:bg-emerald-400">
          Join (2/2)
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
      badgeEl.textContent = '👀 Spectating Live Match (2/2)';
    } else if (arcadeState.opponentSeated) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-vibe-emerald/20 text-vibe-emerald border border-vibe-emerald/30';
      badgeEl.textContent = `🟢 Match Live: You vs @${arcadeState.opponent} (2/2)`;
    } else {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-vibe-amber/20 text-vibe-amber border border-vibe-amber/30';
      badgeEl.textContent = '🔒 Waiting for Player 2 (1/2)';
    }
  }

  if (subEl) {
    const oppObj = getUsers().find(u => u.username === arcadeState.opponent);
    const oppElo = oppObj ? oppObj.elo : 1350;
    subEl.textContent = arcadeState.opponentSeated
      ? `Ranked Board Active • Opponent: @${arcadeState.opponent} (${oppElo} ELO) • ${arcadeState.spectators.length} Watching`
      : `Board locked until 2 players join • Invite a peer or accept an invite on the left`;
  }

  if (lobbyOverlay && boardContainer) {
    lobbyOverlay.classList.toggle('hidden', canShowBoard);
    boardContainer.classList.toggle('hidden', !canShowBoard);
  }

  const me = state.currentUser || { username: 'you', elo: 1200 };
  const s1Av = document.getElementById('seat1Avatar');
  const s1Nm = document.getElementById('seat1Name');
  const s1El = document.getElementById('seat1Elo');
  const lobbyTitle = document.getElementById('lobbyGameName');
  if (lobbyTitle) lobbyTitle.textContent = `${g.icon} ${g.name} — Matchmaking Lobby`;
  if (s1Av) s1Av.textContent = me.username[0].toUpperCase();
  if (s1Nm) s1Nm.textContent = `@${me.username}`;
  if (s1El) s1El.textContent = `${me.elo || 1200} ELO • Host Ready`;
}

function toggleArcadeMode(newMode) {
  arcadeState.mode = newMode;
  const g = ARCADE_GAMES.find(x => x.id === arcadeState.activeGame) || ARCADE_GAMES[0];
  if (newMode === 'spectate') {
    setActivity('online', `👀 Spectating ${g.name}`);
    showToast('Switched to Spectator Mode — watching live campus board 👀', 'emerald');
  } else {
    setActivity('online', arcadeState.opponentSeated ? `🎮 Playing ${g.name}` : `🕹️ In ${g.name} Lobby (1/2)`);
  }
  renderArcadeAll();
}

function resetBoardStateOnly(id) {
  if (id === 'chess') {
    if (typeof Chess !== 'undefined') chessEngine = new Chess();
    arcadeState.chessSelectedSquare = null;
    arcadeState.chessLegalTargets = [];
    arcadeState.chessLastMove = null;
    arcadeState.chessBotThinking = false;
  } else if (id === 'tictactoe') {
    arcadeState.tttBoard = Array(9).fill('');
    arcadeState.tttTurn = 'X';
    arcadeState.tttWinner = null;
  } else if (id === 'connect4') {
    arcadeState.c4Board = Array(6).fill(null).map(() => Array(7).fill(''));
    arcadeState.c4Turn = 'Emerald';
    arcadeState.c4Winner = null;
  } else if (id === 'rps') {
    arcadeState.rpsScore = { me: 0, peer: 0 };
    arcadeState.rpsLastResult = 'First to 3 wins the Ranked ELO match!';
  } else if (id === 'memory') {
    initMemoryGame();
  } else if (id === 'minesweeper') {
    initMinesweeper();
  } else if (id === 'wordscramble') {
    arcadeState.scrambleScore = 0;
    nextWordScramble();
  } else if (id === 'speedmath') {
    arcadeState.mathScore = 0;
    generateMathQuestion();
  } else if (id === 'reflex') {
    arcadeState.reflexState = 'idle';
  } else if (id === 'codebreaker') {
    initCodeBreaker();
  }
}

// ================= ACTIVE GAME BOARD RENDERER =================
function renderActiveGameBoard() {
  const box = document.getElementById('arcadeBoardContainer');
  if (!box) return;
  if (!arcadeState.opponentSeated && arcadeState.mode !== 'spectate') return;

  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'ayush_mech';
  const isSpec = arcadeState.mode === 'spectate';

  const topMatchBar = isSpec
    ? `<div class="w-full max-w-md mb-3 px-4 py-2 rounded-2xl bg-vibe-amber/15 border border-vibe-amber/40 text-xs font-mono text-vibe-amber flex items-center justify-between">
        <span>👀 Spectating @ayush_mech vs @rohan_cse</span>
        <button onclick="simulateSpectatorMove()" class="px-2.5 py-1 rounded-lg bg-vibe-amber text-surface-950 font-bold">Simulate Move</button>
      </div>`
    : `<div class="w-full max-w-md mb-3 px-4 py-2 rounded-2xl bg-surface-900 border border-vibe-emerald/30 text-xs font-mono flex items-center justify-between">
        <span class="text-vibe-emerald font-bold">⚪ White: @${myHandle}</span>
        <span class="text-gray-500">VS</span>
        <span class="text-vibe-coral font-bold">🔴 Black: @${oppHandle}</span>
      </div>`;

  const g = arcadeState.activeGame;
  let content = '';

  if (g === 'chess') content = renderChessUI();
  else if (g === 'tictactoe') content = renderTicTacToeUI();
  else if (g === 'connect4') content = renderConnect4UI();
  else if (g === 'rps') content = renderRPSUI();
  else if (g === 'memory') content = renderMemoryUI();
  else if (g === 'minesweeper') content = renderMinesweeperUI();
  else if (g === 'wordscramble') content = renderWordScrambleUI();
  else if (g === 'speedmath') content = renderSpeedMathUI();
  else if (g === 'reflex') content = renderReflexUI();
  else if (g === 'codebreaker') content = renderCodeBreakerUI();

  box.innerHTML = topMatchBar + content;
}

// ============================================================================
// GAME 1: OFFICIAL CHESS.JS + STOCKFISH API ENGINE
// ============================================================================
function renderChessUI() {
  if (!chessEngine && typeof Chess !== 'undefined') {
    chessEngine = new Chess();
  }
  if (!chessEngine) {
    return `<div class="text-xs font-mono text-vibe-emerald animate-pulse p-8">Loading external Chess.js engine...</div>`;
  }

  const board = chessEngine.board();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const turnColor = chessEngine.turn() === 'w' ? 'White (Your Turn)' : `Black (@${arcadeState.opponent || 'ayush_mech'} Thinking...)`;
  const inCheck = chessEngine.in_check();
  const history = chessEngine.history();

  let statusBanner = `<span class="text-vibe-emerald font-bold">${turnColor}</span>`;
  if (chessEngine.in_checkmate()) {
    statusBanner = `<span class="text-vibe-coral font-bold">🏆 CHECKMATE!</span>`;
  } else if (chessEngine.in_draw() || chessEngine.in_stalemate()) {
    statusBanner = `<span class="text-vibe-amber font-bold">🤝 DRAW / STALEMATE!</span>`;
  } else if (inCheck) {
    statusBanner += ` <span class="ml-2 px-2 py-0.5 rounded bg-vibe-coral text-white text-[10px]">⚠️ CHECK!</span>`;
  }

  let html = `
    <div class="flex flex-col items-center space-y-2.5">
      <div class="text-xs font-mono text-gray-200 flex items-center gap-2">
        ${statusBanner}
      </div>

      <div class="grid grid-cols-8 border-2 border-surface-700 rounded-2xl overflow-hidden shadow-2xl select-none">
  `;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = files[c] + (8 - r);
      const isDark = (r + c) % 2 === 1;
      const isSelected = arcadeState.chessSelectedSquare === sq;
      const isLegalTarget = arcadeState.chessLegalTargets.includes(sq);
      const isLastMove = arcadeState.chessLastMove && (arcadeState.chessLastMove.from === sq || arcadeState.chessLastMove.to === sq);

      const cellObj = board[r][c];
      const symbol = cellObj ? CHESS_UNICODE[cellObj.color + cellObj.type] : '';
      const pieceStyle = cellObj
        ? (cellObj.color === 'w'
            ? 'text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] scale-105'
            : 'text-vibe-coral drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]')
        : '';

      let bgClass = isDark ? 'bg-surface-800 hover:bg-surface-700' : 'bg-surface-900 hover:bg-surface-850';
      if (isSelected) bgClass = 'bg-vibe-emerald/40 ring-2 ring-inset ring-vibe-emerald';
      else if (isLastMove) bgClass = 'bg-vibe-amber/25';

      html += `
        <button onclick="handleChessSquareClick('${sq}')" class="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-2xl sm:text-3xl transition ${bgClass}">
          <span class="${pieceStyle}">${symbol}</span>
          ${isLegalTarget ? `<span class="absolute w-3 h-3 rounded-full ${cellObj ? 'ring-4 ring-vibe-emerald bg-transparent w-9 h-9' : 'bg-vibe-emerald/80 shadow-lg'} pointer-events-none"></span>` : ''}
          ${c === 0 ? `<span class="absolute top-0.5 left-1 text-[8px] font-mono text-gray-500">${8 - r}</span>` : ''}
          ${r === 7 ? `<span class="absolute bottom-0.5 right-1 text-[8px] font-mono text-gray-500">${files[c]}</span>` : ''}
        </button>
      `;
    }
  }

  html += `
      </div>

      <!-- Move History & Action Controls -->
      <div class="w-full max-w-sm flex items-center justify-between gap-2 text-[11px] font-mono text-gray-400 bg-surface-950 px-3 py-2 rounded-xl border border-surface-800">
        <div class="truncate">Moves: <span class="text-vibe-emerald">${history.slice(-6).join(' ') || 'Click any White piece to start'}</span></div>
        <div class="flex gap-1.5 shrink-0">
          <button onclick="undoChessMove()" class="px-2 py-0.5 rounded bg-surface-800 hover:bg-surface-700 text-gray-200">Undo</button>
          <button onclick="resetBoardStateOnly('chess'); renderActiveGameBoard();" class="px-2 py-0.5 rounded bg-surface-800 hover:bg-surface-700 text-vibe-amber">New Board</button>
        </div>
      </div>
    </div>
  `;
  return html;
}

function handleChessSquareClick(sq) {
  if (arcadeState.mode === 'spectate' || !chessEngine || arcadeState.chessBotThinking) return;
  if (chessEngine.game_over()) return;

  // 1. If clicking a highlighted legal target square, execute the move!
  if (arcadeState.chessSelectedSquare && arcadeState.chessLegalTargets.includes(sq)) {
    const moveObj = chessEngine.move({
      from: arcadeState.chessSelectedSquare,
      to: sq,
      promotion: 'q' // Auto-promote pawns to Queen
    });

    if (moveObj) {
      arcadeState.chessLastMove = { from: moveObj.from, to: moveObj.to };
      arcadeState.chessSelectedSquare = null;
      arcadeState.chessLegalTargets = [];

      // Broadcast move across tabs
      liveChannel.postMessage({
        type: 'CHESS_MOVE',
        fen: chessEngine.fen(),
        lastMove: arcadeState.chessLastMove
      });

      renderActiveGameBoard();
      checkChessEndgameOrTriggerOpponent();
      return;
    }
  }

  // 2. Otherwise, select a piece to show its legal moves
  const pieceOnSq = chessEngine.get(sq);
  if (pieceOnSq && pieceOnSq.color === chessEngine.turn()) {
    arcadeState.chessSelectedSquare = sq;
    const legalMoves = chessEngine.moves({ square: sq, verbose: true });
    arcadeState.chessLegalTargets = legalMoves.map(m => m.to);
  } else {
    arcadeState.chessSelectedSquare = null;
    arcadeState.chessLegalTargets = [];
  }
  renderActiveGameBoard();
}

function undoChessMove() {
  if (!chessEngine) return;
  chessEngine.undo(); // Undo opponent move
  chessEngine.undo(); // Undo player move
  arcadeState.chessSelectedSquare = null;
  arcadeState.chessLegalTargets = [];
  renderActiveGameBoard();
}

async function checkChessEndgameOrTriggerOpponent() {
  if (!chessEngine) return;
  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'ayush_mech';

  if (chessEngine.in_checkmate()) {
    // Whoever just moved won!
    const winner = chessEngine.turn() === 'b' ? myHandle : oppHandle;
    const loser = winner === myHandle ? oppHandle : myHandle;
    calculateAndApplyELO(winner, loser);
    return;
  }

  if (chessEngine.in_draw() || chessEngine.in_stalemate() || chessEngine.in_threefold_repetition()) {
    showToast('🤝 Chess match ended in a Draw!', 'emerald');
    return;
  }

  // If playing against an invited classmate in single-tab mode, trigger Stockfish API move for Black!
  if (chessEngine.turn() === 'b' && !arcadeState.isLiveHumanOpponent) {
    arcadeState.chessBotThinking = true;
    renderActiveGameBoard();

    setTimeout(async () => {
      await makeStockfishOrSmartMove();
      arcadeState.chessBotThinking = false;
      renderActiveGameBoard();

      if (chessEngine.in_checkmate()) {
        calculateAndApplyELO(oppHandle, myHandle);
      }
    }, 650);
  }
}

// Queries Stockfish Online API for a real chess move, with instant local AI fallback
async function makeStockfishOrSmartMove() {
  if (!chessEngine || chessEngine.game_over()) return;

  try {
    const fen = chessEngine.fen();
    const res = await fetch(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=5`);
    const data = await res.json();
    if (data && data.success && data.bestmove) {
      const uci = data.bestmove.split(' ')[1]; // e.g. "e7e5"
      if (uci && uci.length >= 4) {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const mv = chessEngine.move({ from, to, promotion: 'q' });
        if (mv) {
          arcadeState.chessLastMove = { from: mv.from, to: mv.to };
          return;
        }
      }
    }
  } catch (err) {
    // Fallback to local tactical move evaluator below if offline
  }

  // Local tactical fallback (prioritizes captures, checks, and center control)
  const legal = chessEngine.moves({ verbose: true });
  if (legal.length === 0) return;

  const pieceVal = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  legal.sort((a, b) => {
    const scoreA = (a.captured ? pieceVal[a.captured] * 10 : 0) + (['d4','d5','e4','e5'].includes(a.to) ? 2 : 0);
    const scoreB = (b.captured ? pieceVal[b.captured] * 10 : 0) + (['d4','d5','e4','e5'].includes(b.to) ? 2 : 0);
    return scoreB - scoreA;
  });

  const pick = legal[0];
  const mv = chessEngine.move(pick);
  if (mv) arcadeState.chessLastMove = { from: mv.from, to: mv.to };
}

// --- 2. NEON TIC-TAC-TOE (With Opponent Auto-Response) ---
function renderTicTacToeUI() {
  return `
    <div class="flex flex-col items-center space-y-3">
      <div class="text-xs font-mono text-vibe-emerald font-bold">
        ${arcadeState.tttWinner ? `🏆 Result: ${arcadeState.tttWinner}!` : `Turn: Player ${arcadeState.tttTurn}`}
      </div>
      <div class="grid grid-cols-3 gap-2.5 bg-surface-950 p-3 rounded-3xl border border-surface-800">
        ${arcadeState.tttBoard.map((cell, i) => `
          <button onclick="clickTTT(${i})" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface-900 hover:bg-surface-800 border border-surface-700 text-2xl sm:text-3xl font-display font-extrabold flex items-center justify-center ${cell === 'X' ? 'text-vibe-emerald' : 'text-vibe-coral'}">
            ${cell}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function clickTTT(idx) {
  if (arcadeState.mode === 'spectate' || arcadeState.tttBoard[idx] || arcadeState.tttWinner) return;
  arcadeState.tttBoard[idx] = arcadeState.tttTurn;
  if (evaluateTTTWin()) return;

  arcadeState.tttTurn = arcadeState.tttTurn === 'X' ? 'O' : 'X';
  renderActiveGameBoard();

  if (arcadeState.tttTurn === 'O' && !arcadeState.isLiveHumanOpponent && !arcadeState.tttWinner) {
    setTimeout(() => {
      const empty = arcadeState.tttBoard.map((v, i) => v === '' ? i : null).filter(v => v !== null);
      if (empty.length > 0) {
        const pick = empty[Math.floor(Math.random() * empty.length)];
        arcadeState.tttBoard[pick] = 'O';
        if (!evaluateTTTWin()) {
          arcadeState.tttTurn = 'X';
          renderActiveGameBoard();
        }
      }
    }, 450);
  }
}

function evaluateTTTWin() {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'ayush_mech';

  for (let [a,b,c] of wins) {
    if (arcadeState.tttBoard[a] && arcadeState.tttBoard[a] === arcadeState.tttBoard[b] && arcadeState.tttBoard[a] === arcadeState.tttBoard[c]) {
      arcadeState.tttWinner = arcadeState.tttBoard[a];
      renderActiveGameBoard();
      if (arcadeState.tttWinner === 'X') calculateAndApplyELO(myHandle, oppHandle);
      else calculateAndApplyELO(oppHandle, myHandle);
      return true;
    }
  }
  if (!arcadeState.tttBoard.includes('')) {
    arcadeState.tttWinner = 'Draw';
    renderActiveGameBoard();
    return true;
  }
  return false;
}

// --- 3. CONNECT 4 DROP ---
function renderConnect4UI() {
  let html = `
    <div class="flex flex-col items-center space-y-2.5">
      <div class="text-xs font-mono text-white">
        ${arcadeState.c4Winner ? `🏆 ${arcadeState.c4Winner} Wins!` : `Turn: <span class="text-vibe-emerald font-bold">${arcadeState.c4Turn}</span>`}
      </div>
      <div class="bg-surface-950 p-3 rounded-3xl border border-surface-800 grid grid-cols-7 gap-1.5">
  `;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const val = arcadeState.c4Board[r][c];
      const color = val === 'Emerald' ? 'bg-vibe-emerald' : val === 'Coral' ? 'bg-vibe-coral' : 'bg-surface-850';
      html += `<button onclick="dropConnect4(${c})" class="w-9 h-9 rounded-full ${color} border border-surface-700 transition hover:scale-105"></button>`;
    }
  }
  html += `</div></div>`;
  return html;
}

function dropConnect4(col) {
  if (arcadeState.mode === 'spectate' || arcadeState.c4Winner) return;
  for (let r = 5; r >= 0; r--) {
    if (!arcadeState.c4Board[r][col]) {
      arcadeState.c4Board[r][col] = arcadeState.c4Turn;
      if (checkC4Win(r, col, arcadeState.c4Turn)) {
        arcadeState.c4Winner = arcadeState.c4Turn;
        const myHandle = state.currentUser ? state.currentUser.username : 'you';
        const oppHandle = arcadeState.opponent || 'rohan_cse';
        if (arcadeState.c4Winner === 'Emerald') calculateAndApplyELO(myHandle, oppHandle);
        else calculateAndApplyELO(oppHandle, myHandle);
      }
      arcadeState.c4Turn = arcadeState.c4Turn === 'Emerald' ? 'Coral' : 'Emerald';
      renderActiveGameBoard();
      return;
    }
  }
}

function checkC4Win(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let [dr, dc] of dirs) {
    let count = 1;
    for (let s of [1, -1]) {
      let nr = r + dr * s, nc = c + dc * s;
      while (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && arcadeState.c4Board[nr][nc] === player) {
        count++; nr += dr * s; nc += dc * s;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

// --- 4. ROCK PAPER SCISSORS ---
function renderRPSUI() {
  return `
    <div class="flex flex-col items-center space-y-4 text-center">
      <div class="flex gap-6 text-xs font-mono">
        <div class="p-3 rounded-2xl bg-surface-900 border border-vibe-emerald/40">You: <span class="text-vibe-emerald font-bold text-base">${arcadeState.rpsScore.me}</span>/3</div>
        <div class="p-3 rounded-2xl bg-surface-900 border border-vibe-coral/40">@${arcadeState.opponent}: <span class="text-vibe-coral font-bold text-base">${arcadeState.rpsScore.peer}</span>/3</div>
      </div>
      <div class="text-xs font-display font-bold text-white">${arcadeState.rpsLastResult}</div>
      <div class="flex gap-3">
        <button onclick="playRPS('🪨 Rock')" class="px-4 py-3 rounded-2xl bg-surface-900 hover:bg-surface-800 border border-surface-700 text-sm">🪨 Rock</button>
        <button onclick="playRPS('📄 Paper')" class="px-4 py-3 rounded-2xl bg-surface-900 hover:bg-surface-800 border border-surface-700 text-sm">📄 Paper</button>
        <button onclick="playRPS('✂️ Scissors')" class="px-4 py-3 rounded-2xl bg-surface-900 hover:bg-surface-800 border border-surface-700 text-sm">✂️ Scissors</button>
      </div>
    </div>
  `;
}

function playRPS(myChoice) {
  if (arcadeState.mode === 'spectate') return;
  const opts = ['🪨 Rock', '📄 Paper', '✂️ Scissors'];
  const peerChoice = opts[Math.floor(Math.random() * 3)];
  if (myChoice === peerChoice) {
    arcadeState.rpsLastResult = `Tie! Both picked ${myChoice}`;
  } else if (
    (myChoice.includes('Rock') && peerChoice.includes('Scissors')) ||
    (myChoice.includes('Paper') && peerChoice.includes('Rock')) ||
    (myChoice.includes('Scissors') && peerChoice.includes('Paper'))
  ) {
    arcadeState.rpsScore.me++;
    arcadeState.rpsLastResult = `Round Win! ${myChoice} beats ${peerChoice}`;
  } else {
    arcadeState.rpsScore.peer++;
    arcadeState.rpsLastResult = `Round Loss! ${peerChoice} beats ${myChoice}`;
  }

  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'ayush_mech';
  if (arcadeState.rpsScore.me >= 3) {
    calculateAndApplyELO(myHandle, oppHandle);
    arcadeState.rpsScore = { me: 0, peer: 0 };
  } else if (arcadeState.rpsScore.peer >= 3) {
    calculateAndApplyELO(oppHandle, myHandle);
    arcadeState.rpsScore = { me: 0, peer: 0 };
  }
  renderActiveGameBoard();
}

// --- 5. CAMPUS MEMORY FLIP ---
function initMemoryGame() {
  const icons = ['🏸','💻','🎧','♟️','🚀','⚡','🎮','🔥'];
  arcadeState.memoryCards = [...icons, ...icons].sort(() => Math.random() - 0.5);
  arcadeState.memoryFlipped = [];
  arcadeState.memoryMatched = [];
}

function renderMemoryUI() {
  if (arcadeState.memoryCards.length === 0) initMemoryGame();
  return `
    <div class="flex flex-col items-center space-y-3">
      <div class="text-xs font-mono text-vibe-emerald">Matched Pairs: ${arcadeState.memoryMatched.length / 2} / 8</div>
      <div class="grid grid-cols-4 gap-2">
        ${arcadeState.memoryCards.map((icon, idx) => {
          const shown = arcadeState.memoryFlipped.includes(idx) || arcadeState.memoryMatched.includes(idx);
          return `
            <button onclick="flipMemoryCard(${idx})" class="w-14 h-14 rounded-2xl text-xl flex items-center justify-center border transition ${shown ? 'bg-vibe-emerald/20 border-vibe-emerald' : 'bg-surface-900 border-surface-700 hover:bg-surface-800'}">
              ${shown ? icon : '❓'}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function flipMemoryCard(idx) {
  if (arcadeState.mode === 'spectate') return;
  if (arcadeState.memoryFlipped.length >= 2 || arcadeState.memoryFlipped.includes(idx) || arcadeState.memoryMatched.includes(idx)) return;
  arcadeState.memoryFlipped.push(idx);
  renderActiveGameBoard();

  if (arcadeState.memoryFlipped.length === 2) {
    const [a, b] = arcadeState.memoryFlipped;
    if (arcadeState.memoryCards[a] === arcadeState.memoryCards[b]) {
      arcadeState.memoryMatched.push(a, b);
      arcadeState.memoryFlipped = [];
      if (arcadeState.memoryMatched.length === 16) {
        calculateAndApplyELO(state.currentUser ? state.currentUser.username : 'you', arcadeState.opponent || 'ayush_mech');
      }
      renderActiveGameBoard();
    } else {
      setTimeout(() => {
        arcadeState.memoryFlipped = [];
        renderActiveGameBoard();
      }, 600);
    }
  }
}

// --- 6. CYBER MINESWEEPER ---
function initMinesweeper() {
  arcadeState.mineGameOver = false;
  arcadeState.mineSafeCount = 0;
  arcadeState.mineGrid = Array(25).fill(null).map((_, i) => ({
    id: i,
    mine: Math.random() < 0.2,
    revealed: false
  }));
}

function renderMinesweeperUI() {
  if (arcadeState.mineGrid.length === 0) initMinesweeper();
  return `
    <div class="flex flex-col items-center space-y-3">
      <div class="text-xs font-mono ${arcadeState.mineGameOver ? 'text-vibe-coral font-bold' : 'text-gray-300'}">
        ${arcadeState.mineGameOver ? '💥 Mine Hit! Opponent claims ELO.' : `Clear 8 safe tiles to win Ranked ELO (${arcadeState.mineSafeCount}/8)`}
      </div>
      <div class="grid grid-cols-5 gap-2">
        ${arcadeState.mineGrid.map((cell, i) => `
          <button onclick="clickMineCell(${i})" class="w-11 h-11 rounded-xl font-mono text-xs flex items-center justify-center border ${
            cell.revealed
              ? (cell.mine ? 'bg-vibe-coral text-white border-vibe-coral' : 'bg-vibe-emerald/20 text-vibe-emerald border-vibe-emerald/40')
              : 'bg-surface-900 border-surface-700 hover:bg-surface-800'
          }">
            ${cell.revealed ? (cell.mine ? '💣' : '✓') : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function clickMineCell(i) {
  if (arcadeState.mode === 'spectate' || arcadeState.mineGameOver || arcadeState.mineGrid[i].revealed) return;
  arcadeState.mineGrid[i].revealed = true;
  const myHandle = state.currentUser ? state.currentUser.username : 'you';
  const oppHandle = arcadeState.opponent || 'ayush_mech';

  if (arcadeState.mineGrid[i].mine) {
    arcadeState.mineGameOver = true;
    arcadeState.mineGrid.forEach(c => c.revealed = true);
    calculateAndApplyELO(oppHandle, myHandle);
  } else {
    arcadeState.mineSafeCount++;
    if (arcadeState.mineSafeCount >= 8) {
      calculateAndApplyELO(myHandle, oppHandle);
      initMinesweeper();
    }
  }
  renderActiveGameBoard();
}

// --- 7. NITA WORD SCRAMBLE ---
function nextWordScramble() {
  const words = ['AGARTALA', 'BADMINTON', 'ELECTRONICS', 'VALORANT', 'ALGORITHMS', 'CAMPUS', 'HOSTEL'];
  const pick = words[Math.floor(Math.random() * words.length)];
  arcadeState.scrambleWord = pick;
  arcadeState.scrambleScrambled = pick.split('').sort(() => Math.random() - 0.5).join('');
}

function renderWordScrambleUI() {
  return `
    <div class="flex flex-col items-center space-y-3 text-center">
      <div class="text-xs font-mono text-vibe-emerald">Race to 30 pts for ELO Win: ${arcadeState.scrambleScore} / 30</div>
      <div class="px-6 py-3.5 rounded-2xl bg-surface-950 border border-surface-800 font-mono text-xl tracking-widest text-white font-bold">
        ${arcadeState.scrambleScrambled}
      </div>
      <form onsubmit="submitScrambleGuess(event)" class="flex gap-2">
        <input type="text" id="scrambleInput" placeholder="Unscramble..." class="input-modern px-3.5 py-2 rounded-xl text-xs text-white uppercase">
        <button type="submit" class="px-4 py-2 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">Check</button>
      </form>
    </div>
  `;
}

function submitScrambleGuess(e) {
  e.preventDefault();
  const val = document.getElementById('scrambleInput').value.trim().toUpperCase();
  if (val === arcadeState.scrambleWord) {
    arcadeState.scrambleScore += 10;
    if (arcadeState.scrambleScore >= 30) {
      calculateAndApplyELO(state.currentUser ? state.currentUser.username : 'you', arcadeState.opponent || 'ayush_mech');
      arcadeState.scrambleScore = 0;
    }
    nextWordScramble();
    renderActiveGameBoard();
  } else {
    showToast('Try again!', 'coral');
  }
}

// --- 8. ENGINEERING BLITZ MATH ---
function generateMathQuestion() {
  const a = Math.floor(Math.random() * 15) + 4;
  const b = Math.floor(Math.random() * 12) + 3;
  arcadeState.mathQ = `${a} × ${b}`;
  arcadeState.mathAns = a * b;
}

function renderSpeedMathUI() {
  return `
    <div class="flex flex-col items-center space-y-3">
      <div class="text-xs font-mono text-vibe-emerald">Blitz Race: ${arcadeState.mathScore} / 25 pts</div>
      <div class="px-7 py-4 rounded-3xl bg-surface-950 border border-surface-800 font-display text-2xl font-bold text-white">
        ${arcadeState.mathQ} = ?
      </div>
      <form onsubmit="submitMathAns(event)" class="flex gap-2">
        <input type="number" id="mathInput" placeholder="Ans" class="input-modern px-4 py-2 rounded-xl text-xs text-white w-28">
        <button type="submit" class="px-4 py-2 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">Submit</button>
      </form>
    </div>
  `;
}

function submitMathAns(e) {
  e.preventDefault();
  const val = parseInt(document.getElementById('mathInput').value, 10);
  if (val === arcadeState.mathAns) {
    arcadeState.mathScore += 5;
    if (arcadeState.mathScore >= 25) {
      calculateAndApplyELO(state.currentUser ? state.currentUser.username : 'you', arcadeState.opponent || 'ayush_mech');
      arcadeState.mathScore = 0;
    }
    generateMathQuestion();
    renderActiveGameBoard();
  } else {
    showToast('Wrong answer!', 'coral');
  }
}

// --- 9. VALORANT REFLEX DUEL ---
function renderReflexUI() {
  let color = 'bg-surface-900 border-surface-700';
  let label = 'Click to Start Reflex Duel (Target: < 320ms)';
  if (arcadeState.reflexState === 'waiting') {
    color = 'bg-vibe-coral/30 border-vibe-coral';
    label = 'Wait for GREEN...';
  } else if (arcadeState.reflexState === 'click') {
    color = 'bg-vibe-emerald text-surface-950 border-vibe-emerald';
    label = 'CLICK NOW!';
  }
  return `
    <div class="flex flex-col items-center space-y-3">
      <div class="text-xs font-mono text-gray-300">Your Best: <span class="text-vibe-emerald font-bold">${arcadeState.reflexBest ? arcadeState.reflexBest + ' ms' : '--'}</span> (Opponent target: 320 ms)</div>
      <button onclick="handleReflexClick()" class="w-64 h-36 rounded-3xl border-2 font-display font-bold text-sm px-4 transition ${color}">
        ${label}
      </button>
    </div>
  `;
}

let reflexTimer = null;
function handleReflexClick() {
  if (arcadeState.reflexState === 'idle') {
    arcadeState.reflexState = 'waiting';
    renderActiveGameBoard();
    reflexTimer = setTimeout(() => {
      arcadeState.reflexState = 'click';
      arcadeState.reflexStart = performance.now();
      renderActiveGameBoard();
    }, 1000 + Math.random() * 1800);
  } else if (arcadeState.reflexState === 'waiting') {
    clearTimeout(reflexTimer);
    arcadeState.reflexState = 'idle';
    showToast('Too early!', 'coral');
    renderActiveGameBoard();
  } else if (arcadeState.reflexState === 'click') {
    const ms = Math.round(performance.now() - arcadeState.reflexStart);
    if (!arcadeState.reflexBest || ms < arcadeState.reflexBest) arcadeState.reflexBest = ms;
    arcadeState.reflexState = 'idle';
    if (ms <= 320) {
      calculateAndApplyELO(state.currentUser ? state.currentUser.username : 'you', arcadeState.opponent || 'ayush_mech');
    } else {
      showToast(`${ms} ms! Beat 320 ms to claim ELO win.`, 'emerald');
    }
    renderActiveGameBoard();
  }
}

// --- 10. 3-DIGIT CODE BREAKER ---
function initCodeBreaker() {
  arcadeState.secretCode = String(Math.floor(100 + Math.random() * 900));
  arcadeState.codeHistory = [];
}

function renderCodeBreakerUI() {
  return `
    <div class="flex flex-col items-center space-y-3">
      <div class="text-xs font-mono text-gray-400">Crack the 3-digit vault before @${arcadeState.opponent}</div>
      <form onsubmit="submitCodeGuess(event)" class="flex gap-2">
        <input type="text" id="codeGuessInput" maxlength="3" placeholder="742" class="input-modern px-4 py-1.5 rounded-xl text-xs text-white font-mono w-24 text-center">
        <button type="submit" class="px-4 py-1.5 rounded-xl bg-vibe-emerald text-surface-950 font-bold text-xs">Crack</button>
      </form>
      <div class="w-60 space-y-1 max-h-32 overflow-y-auto">
        ${arcadeState.codeHistory.map(h => `
          <div class="flex justify-between text-xs font-mono px-3 py-1 rounded-xl bg-surface-900 border border-surface-800">
            <span class="text-white font-bold">${h.guess}</span>
            <span class="text-vibe-emerald">${h.hint}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function submitCodeGuess(e) {
  e.preventDefault();
  const g = document.getElementById('codeGuessInput').value.trim();
  if (g.length !== 3) return;
  let exact = 0, partial = 0;
  for (let i = 0; i < 3; i++) {
    if (g[i] === arcadeState.secretCode[i]) exact++;
    else if (arcadeState.secretCode.includes(g[i])) partial++;
  }
  const hint = exact === 3 ? '🔓 UNLOCKED!' : `${exact} Exact, ${partial} Close`;
  arcadeState.codeHistory.unshift({ guess: g, hint });
  if (exact === 3) {
    calculateAndApplyELO(state.currentUser ? state.currentUser.username : 'you', arcadeState.opponent || 'ayush_mech');
    initCodeBreaker();
  }
  renderActiveGameBoard();
}

// --- SPECTATOR & CHAT HELPERS ---
async function simulateSpectatorMove() {
  if (arcadeState.activeGame === 'chess' && chessEngine) {
    await makeStockfishOrSmartMove();
  }
  showToast('Simulated live move on board!', 'emerald');
  renderActiveGameBoard();
}

function renderArcadeChat() {
  const box = document.getElementById('arcadeChatContainer');
  if (!box) return;
  box.innerHTML = arcadeState.arcadeChat.map(m => `
    <div class="text-xs bg-surface-900/70 p-2 rounded-xl border ${m.sender === 'arena_bot' ? 'border-vibe-amber/50 bg-vibe-amber/10' : 'border-surface-800'}">
      <div class="flex justify-between font-mono">
        <span class="${m.sender === 'arena_bot' ? 'text-vibe-amber' : 'text-vibe-emerald'} font-bold">@${m.sender}</span>
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
  const msgObj = {
    sender: state.currentUser ? state.currentUser.username : 'player',
    text: input.value.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  arcadeState.arcadeChat.push(msgObj);
  liveChannel.postMessage({ type: 'ARCADE_CHAT', msg: msgObj });
  input.value = '';
  renderArcadeChat();
}

function sendQuickReaction(emote) {
  const msgObj = {
    sender: state.currentUser ? state.currentUser.username : 'spectator',
    text: `Reaction: ${emote}`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
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
        <span class="text-[10px] font-mono text-vibe-amber ml-1">(${u.elo || 1200} ELO)</span>
      </div>
      <div class="flex gap-1.5">
        <button onclick="invitePeerToArcade('${u.username}', 'play')" class="px-2.5 py-1 rounded-lg bg-vibe-emerald text-surface-950 font-mono font-bold text-[10px] hover:bg-emerald-400">
          + Invite 1v1
        </button>
        <button onclick="invitePeerToArcade('${u.username}', 'watch')" class="px-2 py-1 rounded-lg bg-surface-800 text-gray-300 font-mono text-[10px]">
          Watch
        </button>
      </div>
    </div>
  `).join('');
}
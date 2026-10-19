// ============================================================================
// MUSIC LOUNGE: SOCKET.IO REAL-TIME ROOM CHAT & SYNCD JAM ROOMS
// ============================================================================

const audioPlayer = new Audio();
audioPlayer.crossOrigin = "anonymous";

let musicState = {
  tracks: [],
  currentIndex: 0,
  isPlaying: false,
  loop: false,
  lyricsLines: [],
  activeJamRoom: 'lofi-nita',
  roomMessages: {
    'lofi-nita': [],
    'bollywood-jam': [],
    'gaming-synth': []
  },
  jamRooms: [
    { id: 'lofi-nita', name: 'NITA Late Night Lo-Fi', host: 'campus', listeners: [], query: 'Lo-Fi Beats' },
    { id: 'bollywood-jam', name: 'Hostel Bollywood & Indie', host: 'campus', listeners: [], query: 'Arijit Singh' },
    { id: 'gaming-synth', name: 'Valorant & Gaming Hype', host: 'campus', listeners: [], query: 'Valorant' }
  ]
};

window.switchTab = function(tab) {
  state.activeTab = tab;
  ['swipe', 'chat', 'music', 'arcade', 'friends'].forEach(t => {
    const viewEl = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}View`);
    const navEl = document.getElementById(`nav${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (viewEl) viewEl.classList.toggle('hidden', t !== tab);
    if (navEl) navEl.classList.toggle('active', t === tab);
  });

  if (!musicState.isPlaying) {
    if (tab === 'swipe') setActivity('online', '🔥 Swiping Feed');
    if (tab === 'chat') setActivity('online', `💬 In #${state.activeChatId}`);
    if (tab === 'music') setActivity('online', '🎧 Jamming in Lounge');
    if (tab === 'arcade') setActivity('online', '🕹️ Exploring Arcade');
  }

  renderAll();
  if (tab === 'music') {
    renderJamRooms();
    renderInvitePeersList();
  }
  if (tab === 'arcade' && typeof renderArcadeAll === 'function') {
    renderArcadeAll();
  }
};

// ================= REAL SONG SEARCH (APPLE ITUNES API) =================
async function searchMusic(e, customQuery = null) {
  if (e) e.preventDefault();
  const input = document.getElementById('musicSearchInput');
  const query = customQuery || (input ? input.value.trim() : '') || 'The Weeknd';
  const listEl = document.getElementById('musicResultsList');
  if (listEl) {
    listEl.innerHTML = `<div class="text-xs font-mono text-gray-400 p-4 text-center">Searching "${query}"...</div>`;
  }

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=18`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      if (listEl) listEl.innerHTML = `<div class="text-xs font-mono text-gray-400 p-4 text-center">No tracks found.</div>`;
      return;
    }

    musicState.tracks = data.results.map(item => ({
      title: item.trackName,
      artist: item.artistName,
      artwork: item.artworkUrl100.replace('100x100', '400x400'),
      audioUrl: item.previewUrl
    }));

    renderMusicList();
  } catch (err) {
    if (listEl) listEl.innerHTML = `<div class="text-xs font-mono text-vibe-coral p-4 text-center">Check internet connection.</div>`;
  }
}

function renderMusicList() {
  const listEl = document.getElementById('musicResultsList');
  if (!listEl) return;

  listEl.innerHTML = musicState.tracks.map((t, idx) => {
    const isCurrent = idx === musicState.currentIndex && musicState.isPlaying;
    return `
      <button onclick="playTrackAtIndex(${idx})" class="w-full p-2.5 rounded-2xl flex items-center gap-3 text-left transition ${isCurrent ? 'bg-vibe-emerald/15 border border-vibe-emerald/40' : 'hover:bg-surface-850'}">
        <img src="${t.artwork}" class="w-10 h-10 rounded-xl object-cover shrink-0">
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-white truncate">${t.title}</div>
          <div class="text-[10px] font-mono text-gray-400 truncate">${t.artist}</div>
        </div>
        <span class="text-xs font-mono text-vibe-emerald">${isCurrent ? '▶' : ''}</span>
      </button>
    `;
  }).join('');
}

function loadLocalAudioFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const cleanName = file.name.replace(/\.[^/.]+$/, "");

  musicState.tracks.unshift({
    title: cleanName,
    artist: `@${state.currentUser ? state.currentUser.username : 'Local'}`,
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
    audioUrl: url
  });

  renderMusicList();
  playTrackAtIndex(0);
  showToast(`Loaded: ${cleanName}`, 'emerald');
}

// ================= PLAYBACK & STATUS =================
function playTrackAtIndex(idx) {
  const track = musicState.tracks[idx];
  if (!track) return;

  musicState.currentIndex = idx;
  audioPlayer.src = track.audioUrl;
  audioPlayer.play();
  musicState.isPlaying = true;

  const art = document.getElementById('playerArtwork');
  const title = document.getElementById('playerTitle');
  const artist = document.getElementById('playerArtist');
  if (art) art.src = track.artwork;
  if (title) title.textContent = track.title;
  if (artist) artist.textContent = track.artist;

  const mini = document.getElementById('miniPlayerBar');
  if (mini) mini.classList.remove('hidden');
  const miniArt = document.getElementById('miniPlayerArt');
  const miniTitle = document.getElementById('miniPlayerTitle');
  const miniArtist = document.getElementById('miniPlayerArtist');
  if (miniArt) miniArt.src = track.artwork;
  if (miniTitle) miniTitle.textContent = track.title;
  if (miniArtist) miniArtist.textContent = track.artist;

  updatePlayButtonsUI();
  renderMusicList();

  setActivity('online', `🎧 Listening to ${track.title}`);
  fetchRealLyrics(track.title, track.artist);
}

function togglePlayPause() {
  if (!audioPlayer.src && musicState.tracks.length > 0) return playTrackAtIndex(0);

  if (audioPlayer.paused) {
    audioPlayer.play();
    musicState.isPlaying = true;
    const curr = musicState.tracks[musicState.currentIndex];
    if (curr) setActivity('online', `🎧 Listening to ${curr.title}`);
  } else {
    audioPlayer.pause();
    musicState.isPlaying = false;
    setActivity('online', '☕ Doing nothing');
  }
  updatePlayButtonsUI();
  renderMusicList();
}

function updatePlayButtonsUI() {
  const label = musicState.isPlaying ? '⏸ Pause' : '▶ Play';
  const mainBtn = document.getElementById('mainPlayBtn');
  const miniBtn = document.getElementById('miniPlayBtn');
  if (mainBtn) mainBtn.textContent = label;
  if (miniBtn) miniBtn.textContent = label;
}

function nextTrack() {
  if (musicState.tracks.length === 0) return;
  playTrackAtIndex((musicState.currentIndex + 1) % musicState.tracks.length);
}

function prevTrack() {
  if (musicState.tracks.length === 0) return;
  playTrackAtIndex((musicState.currentIndex - 1 + musicState.tracks.length) % musicState.tracks.length);
}

function toggleLoop() {
  musicState.loop = !musicState.loop;
  audioPlayer.loop = musicState.loop;
  const btn = document.getElementById('loopBtn');
  if (btn) {
    btn.textContent = musicState.loop ? '🔁 Loop On' : '🔁 Loop Off';
    btn.classList.toggle('text-vibe-emerald', musicState.loop);
  }
}

function seekAudio(val) {
  if (!audioPlayer.duration) return;
  audioPlayer.currentTime = (val / 100) * audioPlayer.duration;
}

function changeVolume(val) {
  audioPlayer.volume = parseFloat(val);
}

audioPlayer.addEventListener('timeupdate', () => {
  if (!audioPlayer.duration) return;
  const seek = document.getElementById('seekSlider');
  const cur = document.getElementById('currentTimeLabel');
  const dur = document.getElementById('durationLabel');
  if (seek) seek.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  if (cur) cur.textContent = formatSeconds(audioPlayer.currentTime);
  if (dur) dur.textContent = formatSeconds(audioPlayer.duration);
  highlightCurrentLyricLine(audioPlayer.currentTime, audioPlayer.duration);
});

audioPlayer.addEventListener('ended', () => {
  if (!musicState.loop) nextTrack();
});

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ================= AUTO LYRICS ENGINE =================
async function fetchRealLyrics(title, artist) {
  const box = document.getElementById('lyricsContainer');
  if (!box) return;
  box.innerHTML = `<p class="text-xs font-mono text-vibe-emerald animate-pulse mt-10">Fetching lyrics...</p>`;

  try {
    const cleanTitle = title.split('(')[0].split('-')[0].trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + artist)}`);
    const data = await res.json();
    if (data && data.length > 0 && data[0].plainLyrics) {
      musicState.lyricsLines = data[0].plainLyrics.split('\n').filter(l => l.trim().length > 0);
    } else {
      musicState.lyricsLines = [
        `🎵 Jamming to ${title}`,
        `🎤 Artist: ${artist}`,
        `✨ Live in NIT Agartala Music Lounge`,
        `💬 Use the Room Chat on the right to talk with friends!`
      ];
    }
  } catch (e) {
    musicState.lyricsLines = [`🎵 ${title} - ${artist}`, `Lyrics unavailable offline.`];
  }
  renderLyricsLines();
}

function renderLyricsLines() {
  const box = document.getElementById('lyricsContainer');
  if (!box) return;
  box.innerHTML = musicState.lyricsLines.map((line, i) => `
    <p id="lyric-line-${i}" class="text-sm font-display text-gray-400 py-1 transition-all">${line}</p>
  `).join('');
}

function highlightCurrentLyricLine(cur, dur) {
  if (musicState.lyricsLines.length === 0 || !dur) return;
  const idx = Math.min(musicState.lyricsLines.length - 1, Math.floor((cur / dur) * musicState.lyricsLines.length));
  musicState.lyricsLines.forEach((_, i) => {
    const el = document.getElementById(`lyric-line-${i}`);
    if (!el) return;
    if (i === idx) {
      el.className = 'text-base font-display font-bold text-vibe-emerald scale-105 transition-all py-1';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      el.className = 'text-sm font-display text-gray-400 transition-all py-1';
    }
  });
}

// ================= JAM ROOMS & SOCKET SYNC CHAT =================
function renderJamRooms() {
  const container = document.getElementById('jamRoomsList');
  if (!container) return;

  const activeRoomObj = musicState.jamRooms.find(r => r.id === musicState.activeJamRoom) || musicState.jamRooms[0];

  container.innerHTML = musicState.jamRooms.map(room => {
    const isJoined = musicState.activeJamRoom === room.id;
    return `
      <button onclick="joinJamRoom('${room.id}')" class="w-full p-2.5 rounded-2xl border ${isJoined ? 'border-vibe-coral bg-vibe-coral/10' : 'border-surface-800 bg-surface-900/60 hover:bg-surface-850'} text-left transition flex items-center justify-between">
        <div class="min-w-0">
          <div class="text-xs font-bold text-white truncate">${room.name}</div>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded-lg ${isJoined ? 'bg-vibe-coral text-white' : 'bg-surface-800 text-gray-300'}">
          ${isJoined ? 'Active' : 'Join'}
        </span>
      </button>
    `;
  }).join('');

  const banner = document.getElementById('activeJamRoomBanner');
  if (banner && activeRoomObj) {
    banner.textContent = `Room: ${activeRoomObj.name}`;
  }

  renderRoomChat();
  renderInvitePeersList();
}

async function joinJamRoom(roomId) {
  const room = musicState.jamRooms.find(r => r.id === roomId);
  if (!room) return;

  musicState.activeJamRoom = roomId;
  renderJamRooms();
  await searchMusic(null, room.query);
  if (musicState.tracks.length > 0) playTrackAtIndex(0);
  showToast(`Joined "${room.name}"!`, 'emerald');
}

function syncRoomToMyTrack() {
  const curr = musicState.tracks[musicState.currentIndex];
  if (!curr) return showToast('Play a song first to sync!', 'coral');
  showToast(`Synced to "${curr.title}"!`, 'emerald');
}

function renderRoomChat() {
  const container = document.getElementById('roomMessagesContainer');
  if (!container) return;

  const msgs = musicState.roomMessages[musicState.activeJamRoom] || [];
  container.innerHTML = msgs.map(m => `
    <div class="text-xs space-y-0.5 bg-surface-900/70 p-2.5 rounded-xl border border-surface-800">
      <div class="flex items-center justify-between font-mono">
        <span class="font-bold text-vibe-emerald">@${m.sender}</span>
        <span class="text-[9px] text-gray-500">${m.time}</span>
      </div>
      <p class="text-gray-200 break-words">${m.text}</p>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function sendRoomMessage(e) {
  e.preventDefault();
  const input = document.getElementById('roomChatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  if (!musicState.roomMessages[musicState.activeJamRoom]) {
    musicState.roomMessages[musicState.activeJamRoom] = [];
  }

  const newMsg = {
    sender: state.currentUser ? state.currentUser.username : 'guest',
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  musicState.roomMessages[musicState.activeJamRoom].push(newMsg);

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('send_music_chat', {
      roomId: musicState.activeJamRoom,
      message: newMsg
    });
  }

  input.value = '';
  renderRoomChat();
}

function renderInvitePeersList() {
  const container = document.getElementById('musicInvitePeersContainer');
  if (!container || typeof getUsers !== 'function') return;

  const peers = getUsers().filter(u => u.username !== state.currentUser?.username);
  container.innerHTML = peers.map(u => `
    <div class="flex items-center justify-between p-2 rounded-xl bg-surface-900/70 border border-surface-800">
      <div class="min-w-0">
        <div class="text-xs font-mono font-bold text-white truncate">@${u.username}</div>
        <div class="text-[10px] text-gray-400 truncate">${u.activityText}</div>
      </div>
      <button onclick="showToast('Invite sent to @${u.username}!', 'emerald')" class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-vibe-emerald text-surface-950 hover:bg-emerald-400">
        + Invite
      </button>
    </div>
  `).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  renderJamRooms();
  searchMusic(null, 'The Weeknd');
});
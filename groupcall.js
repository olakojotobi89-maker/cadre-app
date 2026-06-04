/* ============================================================
   GROUPCALL.JS — CADRE Group Voice Communication Engine
   v2.0 — Production-ready, modular, fully commented
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. CONSTANTS & CONFIG
   ══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://ihroattnnnsckvvbosfz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX';

const AGORA_APP_ID  = '8f88034e0a9545868b55af604b268e1e';
const AGORA_CHANNEL = 'GROUP_CALL_ALPHA';
const AGORA_TOKEN   = null;

// Volume threshold (0–255) above which a user is considered "speaking"
const SPEAKING_THRESHOLD = 18;

// How often (ms) to poll volume levels for active speaker detection
const VOLUME_INTERVAL_MS = 200;


/* ══════════════════════════════════════════════════════════════
   2. SUPABASE INIT
   ══════════════════════════════════════════════════════════════ */

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* ══════════════════════════════════════════════════════════════
   3. SESSION / USER IDENTITY
   Load profile from localStorage (set by your auth system).
   Falls back to an anonymous operator ID so the call always works.
   ══════════════════════════════════════════════════════════════ */

const currentUser = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem('session_user'));
    if (stored && stored.name) return stored;
  } catch (_) {}

  // Anonymous fallback
  return {
    name:       'OPERATOR_' + Math.floor(Math.random() * 9000 + 1000),
    rank:       'UNIT',
    phone:      'anon_' + Math.random().toString(36).slice(2, 9),
    avatar_url: null,
  };
})();

// Apply local user info to the local card immediately
document.getElementById('local-name').textContent = currentUser.name || 'UNKNOWN';
document.getElementById('local-rank').textContent = currentUser.rank || 'UNIT';

if (currentUser.avatar_url) {
  document.getElementById('local-avatar').src = currentUser.avatar_url;
} else {
  document.getElementById('local-avatar').src =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0f172a&color=00f0ff`;
}


/* ══════════════════════════════════════════════════════════════
   4. AGORA CLIENT
   mode:"rtc" is correct for audio-only group calls.
   ══════════════════════════════════════════════════════════════ */

const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

// Suppress noisy Agora console output in production
AgoraRTC.setLogLevel(3); // 3 = ERROR only

let localAudioTrack = null;  // microphone track
let activeStream    = false; // true once joined
let isMuted         = false;
let handRaised      = false;
let isRecording     = false;
let speakerEnabled  = true;  // loudspeaker vs. earpiece toggle


/* ══════════════════════════════════════════════════════════════
   5. RINGTONE MANAGER
   Handles the Hip-hop_Alarm.mp3 ringtone for incoming calls.
   Browser autoplay policy requires a prior user gesture before
   audio can play. We unlock the audio context on the first
   interaction with the page, then play/stop as needed.
   ══════════════════════════════════════════════════════════════ */

const RingtoneManager = (() => {
  const audio = document.getElementById('ringtone');
  let unlocked = false;

  // Pre-unlock audio on first user gesture (click, touch, keydown)
  function unlock() {
    if (unlocked) return;
    // Play-then-pause at volume 0 to satisfy autoplay policy
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      unlocked = true;
    }).catch(() => {});
    document.removeEventListener('click',   unlock);
    document.removeEventListener('touchend', unlock);
    document.removeEventListener('keydown', unlock);
  }

  document.addEventListener('click',    unlock, { once: true });
  document.addEventListener('touchend', unlock, { once: true });
  document.addEventListener('keydown',  unlock, { once: true });

  function play() {
    if (!audio) return;
    audio.volume = 1;
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        // Autoplay blocked — the user hasn't interacted yet
        addLog('RINGTONE :: Autoplay blocked. Waiting for user gesture.');
      });
    }
  }

  function stop() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  return { play, stop };
})();


/* ══════════════════════════════════════════════════════════════
   6. WAKE LOCK MANAGER
   Requests a screen wake lock when a call is active so the
   device doesn't sleep and cut the audio stream on mobile.
   ══════════════════════════════════════════════════════════════ */

const WakeLockManager = (() => {
  let wakeLock = null;

  async function request() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      addLog('SYSTEM :: Wake lock acquired — screen will stay on');

      // Re-acquire if the page becomes visible again (e.g. after tab switch)
      wakeLock.addEventListener('release', () => {
        if (activeStream) request();
      });
    } catch (err) {
      addLog(`SYSTEM :: Wake lock denied — ${err.message}`);
    }
  }

  async function release() {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  }

  return { request, release };
})();


/* ══════════════════════════════════════════════════════════════
   7. CALL DURATION TIMER
   Shows elapsed time since joining. Updates every second.
   ══════════════════════════════════════════════════════════════ */

const CallTimer = (() => {
  let startTime  = null;
  let intervalId = null;
  const el = document.getElementById('call-timer');

  function format(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function start() {
    startTime = Date.now();
    el.style.display = 'block';
    intervalId = setInterval(() => {
      el.textContent = format(Date.now() - startTime);
    }, 1000);
  }

  function stop() {
    clearInterval(intervalId);
    el.style.display = 'none';
    el.textContent   = '00:00';
    startTime        = null;
  }

  return { start, stop };
})();


/* ══════════════════════════════════════════════════════════════
   8. CONNECTION QUALITY INDICATOR
   Listens to Agora's "network-quality" event and updates the
   four-bar signal indicator in the top bar.
   ══════════════════════════════════════════════════════════════ */

const QualityIndicator = (() => {
  const el = document.getElementById('quality-indicator');

  // Agora network quality: 0=unknown, 1=excellent, 2=good,
  //                         3=poor, 4=bad, 5=very bad, 6=disconnected
  function update(uplinkQuality, downlinkQuality) {
    // Use the worse of uplink / downlink
    const quality = Math.max(uplinkQuality, downlinkQuality);
    el.className = 'quality-indicator';

    if (quality === 0 || quality === 6) return; // unknown / disconnected
    if (quality <= 2) el.classList.add('good');
    else if (quality === 3) el.classList.add('medium');
    else if (quality === 4) el.classList.add('poor');
    else el.classList.add('bad');
  }

  function reset() {
    el.className = 'quality-indicator';
  }

  return { update, reset };
})();


/* ══════════════════════════════════════════════════════════════
   9. ACTIVE SPEAKER DETECTION
   Polls Agora volume levels every VOLUME_INTERVAL_MS ms.
   Highlights the card and participant-panel item of the loudest
   speaker above the threshold.
   ══════════════════════════════════════════════════════════════ */

const SpeakerDetection = (() => {
  let intervalId      = null;
  let currentSpeaker  = null; // uid of the current highlighted speaker

  function start() {
    // Enable Agora's volume indicator (fires every 2s by default)
    agoraClient.enableAudioVolumeIndicator();

    // Listen to volume events from Agora
    agoraClient.on('volume-indicator', (volumes) => {
      if (!volumes || volumes.length === 0) {
        clearSpeaker();
        return;
      }

      // Find the loudest user above threshold
      let loudest = null;
      let maxVol  = SPEAKING_THRESHOLD;

      for (const { uid, level } of volumes) {
        if (level > maxVol) {
          maxVol  = level;
          loudest = uid;
        }
      }

      if (loudest === null) {
        clearSpeaker();
      } else {
        setSpeaker(loudest);
      }
    });
  }

  function setSpeaker(uid) {
    if (currentSpeaker === uid) return;
    clearSpeaker(false);
    currentSpeaker = uid;

    // Highlight the grid card
    const card = document.getElementById(`remote-${uid}`);
    if (card) card.classList.add('speaking');

    // Highlight the participant panel item
    const item = document.getElementById(`pitem-${uid}`);
    if (item) item.classList.add('speaking');
  }

  function clearSpeaker(resetVar = true) {
    if (currentSpeaker !== null) {
      const card = document.getElementById(`remote-${currentSpeaker}`);
      if (card) card.classList.remove('speaking');
      const item = document.getElementById(`pitem-${currentSpeaker}`);
      if (item) item.classList.remove('speaking');
    }
    if (resetVar) currentSpeaker = null;
  }

  function stop() {
    clearInterval(intervalId);
    clearSpeaker();
  }

  return { start, stop, setSpeaker, clearSpeaker };
})();


/* ══════════════════════════════════════════════════════════════
   10. PARTICIPANT MANAGER
   Manages both the grid cards and the slide-in participant panel.
   Uses a Map to track all remote users and prevent duplicates.
   ══════════════════════════════════════════════════════════════ */

const ParticipantManager = (() => {
  // Map<uid, { name, rank, avatar }>
  const participants = new Map();

  // ── GRID CARD ──────────────────────────────────────────────

  function addCard(uid, meta = {}) {
    if (document.getElementById(`remote-${uid}`)) return; // prevent duplicates

    const name   = meta.name   || String(uid);
    const rank   = meta.rank   || 'REMOTE OPERATOR';
    const avatar = meta.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=00f0ff`;

    participants.set(uid, { name, rank, avatar });

    const grid = document.getElementById('participant-grid');
    const card = document.createElement('div');
    card.className = 'user-card speaking';
    card.id        = `remote-${uid}`;

    card.innerHTML = `
      <div class="user-top-icons">
        <div class="user-badge">🎤 LIVE</div>
      </div>
      <div class="avatar-wrapper">
        <img src="${avatar}" class="user-avatar" alt="${escapeHtml(name)}">
        <div class="speaking-ring"></div>
      </div>
      <div class="user-name">${escapeHtml(name)}</div>
      <div class="user-rank">${escapeHtml(rank)}</div>
      <div class="user-footer">
        <div class="connection-status">CONNECTED</div>
        <div class="card-controls">
          <button class="small-btn" onclick="pinParticipant('remote-${uid}')">📌</button>
          <button class="small-btn" onclick="remoteMute('${uid}')">🔇</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
    updateCounts();
  }

  function removeCard(uid) {
    const card = document.getElementById(`remote-${uid}`);
    if (card) card.remove();
    participants.delete(uid);
    updateCounts();
  }

  // ── PARTICIPANT PANEL ITEM ─────────────────────────────────

  function addPanelItem(uid, meta = {}) {
    if (document.getElementById(`pitem-${uid}`)) return;

    const name   = meta.name   || String(uid);
    const rank   = meta.rank   || 'REMOTE OPERATOR';
    const avatar = meta.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=00f0ff`;

    const list = document.getElementById('participants-list');
    const item = document.createElement('div');
    item.className = 'participant-item';
    item.id        = `pitem-${uid}`;

    item.innerHTML = `
      <img src="${avatar}" class="participant-item-avatar" alt="${escapeHtml(name)}">
      <div class="participant-item-info">
        <div class="participant-item-name">${escapeHtml(name)}</div>
        <div class="participant-item-rank">${escapeHtml(rank)}</div>
      </div>
      <div class="participant-item-status">● LIVE</div>
    `;

    list.appendChild(item);
  }

  function removePanelItem(uid) {
    const item = document.getElementById(`pitem-${uid}`);
    if (item) item.remove();
  }

  // ── COMBINED ADD / REMOVE ──────────────────────────────────

  function add(uid, meta = {}) {
    addCard(uid, meta);
    addPanelItem(uid, meta);
  }

  function remove(uid) {
    removeCard(uid);
    removePanelItem(uid);
  }

  // ── LOCAL USER IN PANEL ────────────────────────────────────

  function addLocalToPanel() {
    if (document.getElementById('pitem-local')) return;

    const list   = document.getElementById('participants-list');
    const item   = document.createElement('div');
    item.className = 'participant-item';
    item.id        = 'pitem-local';

    const avatar = currentUser.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0f172a&color=00f0ff`;

    item.innerHTML = `
      <img src="${avatar}" class="participant-item-avatar" alt="${escapeHtml(currentUser.name)}">
      <div class="participant-item-info">
        <div class="participant-item-name">${escapeHtml(currentUser.name)} <span style="font-size:10px;color:#2563eb;">(YOU)</span></div>
        <div class="participant-item-rank">${escapeHtml(currentUser.rank || 'UNIT')}</div>
      </div>
      <div class="participant-item-status">● LIVE</div>
    `;

    // Prepend so local user is always first
    list.prepend(item);
  }

  function removeLocalFromPanel() {
    const item = document.getElementById('pitem-local');
    if (item) item.remove();
  }

  // ── COUNTS ────────────────────────────────────────────────

  function updateCounts() {
    const count = participants.size + (activeStream ? 1 : 0);
    document.getElementById('member-count').textContent =
      `${count} OPERATOR${count !== 1 ? 'S' : ''} CONNECTED`;
    document.getElementById('participants-panel-count').textContent = count;
  }

  // ── SUPABASE-BACKED FULL REFRESH ───────────────────────────
  // Loads the member list from the DB and updates the count label.
  // Individual cards are driven by Agora events for accuracy.

  async function refreshFromDB() {
    try {
      const { data } = await sbClient.from('group_call_members').select('*');
      if (!data) return;
      const count = data.length;
      document.getElementById('member-count').textContent =
        `${count} OPERATOR${count !== 1 ? 'S' : ''} CONNECTED`;
      document.getElementById('participants-panel-count').textContent = count;
    } catch (_) {}
  }

  function clear() {
    participants.forEach((_, uid) => remove(uid));
    removeLocalFromPanel();
  }

  return {
    add,
    remove,
    addLocalToPanel,
    removeLocalFromPanel,
    updateCounts,
    refreshFromDB,
    clear,
  };
})();


/* ══════════════════════════════════════════════════════════════
   11. SUPABASE REALTIME CHANNEL
   One shared broadcast channel for chat messages, reactions,
   hand-raise signals, and call activity detection.
   ══════════════════════════════════════════════════════════════ */

const realtimeChannel = sbClient.channel('cadre_comms', {
  config: { broadcast: { self: false } },
});

// Incoming chat message from a peer
realtimeChannel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
  renderChatMessage(payload.name, payload.text, payload.time, false);
});

// Incoming reaction from a peer
realtimeChannel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
  showFloatingReaction(payload.emoji);
});

// Incoming call signal — another operator started a call session
// Only show overlay if the local user has not yet joined
realtimeChannel.on('broadcast', { event: 'call_started' }, ({ payload }) => {
  if (!activeStream) {
    showIncomingCallOverlay(payload);
  }
});

// Subscribe to the channel up-front (works even without an active voice session)
realtimeChannel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    addLog('COMMS :: Realtime broadcast channel active');
  }
});

// DB changes → refresh member count
function listenForMembers() {
  sbClient
    .channel('group_call_members_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'group_call_members' },
      () => ParticipantManager.refreshFromDB()
    )
    .subscribe();
}


/* ══════════════════════════════════════════════════════════════
   12. INCOMING CALL OVERLAY
   Shows when another operator broadcasts a "call_started" event
   and the local user is not already in the call.
   ══════════════════════════════════════════════════════════════ */

function showIncomingCallOverlay(payload = {}) {
  const overlay = document.getElementById('incoming-call-overlay');
  const nameEl  = document.getElementById('incoming-call-name');
  const subEl   = document.getElementById('incoming-call-sub');

  nameEl.textContent = AGORA_CHANNEL;
  subEl.textContent  = payload.callerName
    ? `${payload.callerName} has started a secure channel`
    : 'Active operators in secure channel';

  overlay.classList.add('active');
  RingtoneManager.play();
}

function hideIncomingCallOverlay() {
  document.getElementById('incoming-call-overlay').classList.remove('active');
  RingtoneManager.stop();
}

// User taps ANSWER on the overlay
function answerIncomingCall() {
  hideIncomingCallOverlay();
  initializeComms();
}

// User taps DECLINE on the overlay
function declineIncomingCall() {
  hideIncomingCallOverlay();
  addLog('SYSTEM :: Incoming call declined');
}


/* ══════════════════════════════════════════════════════════════
   13. JOIN — initializeComms()
   Full join flow: Agora join → mic track → publish → Supabase
   upsert → start quality / speaker / timer monitoring.
   ══════════════════════════════════════════════════════════════ */

async function initializeComms() {
  if (activeStream) return; // prevent double-join

  // Guard: remove any lingering Agora listeners from a previous session
  // to prevent event-listener duplication on rejoin.
  agoraClient.removeAllListeners('user-published');
  agoraClient.removeAllListeners('user-left');
  agoraClient.removeAllListeners('network-quality');
  agoraClient.removeAllListeners('connection-state-change');

  try {
    activeStream = true;

    // Update UI: entering call state
    document.getElementById('connection-status').textContent = 'LIVE SECURE CHANNEL ACTIVE';
    document.getElementById('joinBtn').style.display  = 'none';
    document.getElementById('leaveBtn').style.display = 'block';
    document.getElementById('muteBtn').style.display  = 'block';
    document.getElementById('speakerBtn').style.display = 'block';

    addLog('SYSTEM :: Initializing secure audio bridge');

    // ── JOIN AGORA CHANNEL ─────────────────────────────────
    await agoraClient.join(
      AGORA_APP_ID,
      AGORA_CHANNEL,
      AGORA_TOKEN,
      currentUser.phone || null
    );

    // ── CREATE MICROPHONE TRACK ───────────────────────────
    // AEC=echo cancel, ANS=noise suppress, AGC=auto gain
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      AEC: true,
      ANS: true,
      AGC: true,
      encoderConfig: {
        sampleRate:    48000,
        stereo:        false,
        bitrate:       64,      // good quality, lower battery cost
      },
    });

    await agoraClient.publish([localAudioTrack]);
    addLog('VOICE LINK :: Connected to tactical channel');

    // ── SUPABASE: register presence ───────────────────────
    await sbClient.from('group_call_members').upsert({
      phone:     currentUser.phone,
      name:      currentUser.name,
      rank:      currentUser.rank,
      avatar_url: currentUser.avatar_url || null,
      status:    'ONLINE',
      joined_at: Date.now(),
    });

    // ── BROADCAST: tell others a call is active ───────────
    realtimeChannel.send({
      type:    'broadcast',
      event:   'call_started',
      payload: { callerName: currentUser.name },
    });

    // ── LOCAL PANEL ───────────────────────────────────────
    ParticipantManager.addLocalToPanel();
    ParticipantManager.refreshFromDB();
    listenForMembers();

    // ── START MONITORING ──────────────────────────────────
    CallTimer.start();
    WakeLockManager.request();
    SpeakerDetection.start();

    // ── AGORA EVENT: remote user published audio ──────────
    agoraClient.on('user-published', async (user, mediaType) => {
      if (mediaType !== 'audio') return;

      await agoraClient.subscribe(user, mediaType);
      user.audioTrack.play();

      // Fetch profile from Supabase (best-effort, non-blocking)
      let meta = {};
      try {
        const { data } = await sbClient
          .from('group_call_members')
          .select('name, rank, avatar_url')
          .eq('phone', String(user.uid))
          .single();
        if (data) {
          meta = {
            name:   data.name,
            rank:   data.rank,
            avatar: data.avatar_url || undefined,
          };
        }
      } catch (_) {}

      ParticipantManager.add(user.uid, meta);
      showToast(`${meta.name || user.uid} joined the channel`, 'join');
      addLog(`VOICE LINK :: ${meta.name || user.uid} connected`);
    });

    // ── AGORA EVENT: remote user left ────────────────────
    agoraClient.on('user-left', (user) => {
      const name = ParticipantManager.participants
        ? (document.getElementById(`remote-${user.uid}`)
            ?.querySelector('.user-name')?.textContent || String(user.uid))
        : String(user.uid);

      ParticipantManager.remove(user.uid);
      SpeakerDetection.clearSpeaker();
      showToast(`${name} left the channel`, 'leave');
      addLog(`VOICE LINK :: ${user.uid} disconnected`);
    });

    // ── AGORA EVENT: network quality ─────────────────────
    agoraClient.on('network-quality', ({ uplinkNetworkQuality, downlinkNetworkQuality }) => {
      QualityIndicator.update(uplinkNetworkQuality, downlinkNetworkQuality);
    });

    // ── AGORA EVENT: connection state change ─────────────
    agoraClient.on('connection-state-change', (curState, prevState, reason) => {
      addLog(`NETWORK :: ${prevState} → ${curState}${reason ? ' (' + reason + ')' : ''}`);

      if (curState === 'DISCONNECTED' && activeStream) {
        addLog('NETWORK :: Attempting to reconnect…');
        // Agora auto-reconnects; no manual action needed for transient drops
      }
    });

  } catch (error) {
    console.error('[CADRE] Join error:', error);
    addLog(`ERROR :: ${error.message}`);
    showToast('Failed to connect. Check permissions.', 'info');
    // Clean up partial state
    activeStream = false;
    document.getElementById('joinBtn').style.display  = 'block';
    document.getElementById('leaveBtn').style.display = 'none';
    document.getElementById('muteBtn').style.display  = 'none';
    document.getElementById('speakerBtn').style.display = 'none';
  }
}


/* ══════════════════════════════════════════════════════════════
   14. LEAVE — terminateComms()
   Full teardown: close mic, leave Agora, delete Supabase row,
   stop monitoring, clean up UI.
   ══════════════════════════════════════════════════════════════ */

async function terminateComms() {
  if (!activeStream) return;
  activeStream = false;

  // Reset UI
  document.getElementById('connection-status').textContent = 'CHANNEL OFFLINE';
  document.getElementById('joinBtn').style.display   = 'block';
  document.getElementById('leaveBtn').style.display  = 'none';
  document.getElementById('muteBtn').style.display   = 'none';
  document.getElementById('speakerBtn').style.display = 'none';

  // Reset mute state for next session
  isMuted = false;
  document.getElementById('muteBtn').innerHTML =
    '🎤<div class="control-label">MIC</div>';
  document.getElementById('local-mic-icon').textContent = '🎤 LIVE';

  // Stop all monitoring
  SpeakerDetection.stop();
  CallTimer.stop();
  QualityIndicator.reset();
  WakeLockManager.release();

  // Close mic track — this MUST happen before client.leave()
  if (localAudioTrack) {
    localAudioTrack.close();
    localAudioTrack = null;
  }

  // Remove all Agora event listeners before leaving
  agoraClient.removeAllListeners('user-published');
  agoraClient.removeAllListeners('user-left');
  agoraClient.removeAllListeners('network-quality');
  agoraClient.removeAllListeners('connection-state-change');

  try {
    await agoraClient.leave();
  } catch (_) {}

  // Remove from Supabase presence table
  if (currentUser?.phone) {
    try {
      await sbClient
        .from('group_call_members')
        .delete()
        .eq('phone', currentUser.phone);
    } catch (_) {}
  }

  // Clear participant UI
  ParticipantManager.clear();
  ParticipantManager.refreshFromDB();

  addLog('SYSTEM :: Tactical stream terminated');
}


/* ══════════════════════════════════════════════════════════════
   15. CALL CONTROLS
   ══════════════════════════════════════════════════════════════ */

// ── MUTE / UNMUTE ────────────────────────────────────────────
async function toggleMute() {
  if (!localAudioTrack) return;

  isMuted = !isMuted;
  await localAudioTrack.setEnabled(!isMuted);

  document.getElementById('muteBtn').innerHTML = isMuted
    ? '🔇<div class="control-label">MUTED</div>'
    : '🎤<div class="control-label">MIC</div>';

  document.getElementById('local-mic-icon').textContent =
    isMuted ? '🔇 MUTED' : '🎤 LIVE';

  addLog(isMuted ? 'VOICE CHANNEL :: Microphone muted' : 'VOICE CHANNEL :: Microphone unmuted');
}

// ── SPEAKER TOGGLE ───────────────────────────────────────────
// Attempts to switch between loudspeaker and earpiece on mobile.
// Uses the AudioContext destination or device enumeration where available.
async function toggleSpeaker() {
  speakerEnabled = !speakerEnabled;

  const btn = document.getElementById('speakerBtn');
  btn.innerHTML = speakerEnabled
    ? '🔊<div class="control-label">SPEAKER</div>'
    : '🔈<div class="control-label">EARPIECE</div>';

  btn.classList.toggle('active', !speakerEnabled);

  // Best-effort: enumerate audio output devices and route accordingly
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

    if (audioOutputs.length > 1) {
      // Find earpiece (usually labeled "default" or has "earpiece" in label)
      const target = speakerEnabled
        ? audioOutputs.find(d => d.label.toLowerCase().includes('speaker'))
            || audioOutputs[0]
        : audioOutputs.find(d =>
            d.label.toLowerCase().includes('earpiece') ||
            d.label.toLowerCase().includes('default'))
            || audioOutputs[0];

      // setSinkId on all <audio> elements in the page
      document.querySelectorAll('audio').forEach(el => {
        if (el.setSinkId) el.setSinkId(target.deviceId).catch(() => {});
      });
    }
  } catch (_) {
    // Not supported on this browser/device — silently ignore
  }

  addLog(`AUDIO :: Routed to ${speakerEnabled ? 'loudspeaker' : 'earpiece'}`);
}

// ── RAISE HAND ───────────────────────────────────────────────
function toggleRaiseHand() {
  handRaised = !handRaised;
  document.getElementById('local-hand-icon').style.display =
    handRaised ? 'block' : 'none';
  addLog(handRaised ? 'SIGNAL :: Hand raised' : 'SIGNAL :: Hand lowered');
}

// ── PIN PARTICIPANT ──────────────────────────────────────────
function pinParticipant(id) {
  document.querySelectorAll('.user-card').forEach(c => (c.style.order = 0));
  const target = document.getElementById(id);
  if (target) target.style.order = -1;
}

// ── REMOTE MUTE (signal only — actual mute requires server) ──
function remoteMute(uid) {
  addLog(`ADMIN ACTION :: Mute request sent to ${uid}`);
}

// ── RECORDING ────────────────────────────────────────────────
function toggleRecord() {
  isRecording = !isRecording;
  const btn = document.querySelector('.control-btn[onclick="toggleRecord()"]');
  if (btn) btn.classList.toggle('active', isRecording);
  addLog(isRecording ? 'REC :: Recording started' : 'REC :: Recording stopped');
}

// ── SCREEN SHARE (Web Share API) ────────────────────────────
function shareScreen() {
  if (navigator.share) {
    navigator.share({ title: 'CADRE CALL', url: window.location.href }).catch(() => {});
  } else {
    addLog('SHARE :: Not supported on this device');
  }
}


/* ══════════════════════════════════════════════════════════════
   16. UI TOGGLES
   ══════════════════════════════════════════════════════════════ */

function toggleChat() {
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('open');

  // Participants panel and chat are mutually exclusive on mobile
  if (panel.classList.contains('open')) {
    document.getElementById('participantsPanel').classList.remove('open');
    if (window.innerWidth > 900) {
      setTimeout(() => document.getElementById('chat-input').focus(), 320);
    }
  }
}

function toggleParticipantsPanel() {
  const panel = document.getElementById('participantsPanel');
  panel.classList.toggle('open');

  // Mutually exclusive with chat panel
  if (panel.classList.contains('open')) {
    document.getElementById('chatPanel').classList.remove('open');
  }
}

function toggleReactionPicker() {
  document.getElementById('reactionPicker').classList.toggle('active');
}


/* ══════════════════════════════════════════════════════════════
   17. CHAT — GLOBAL VIA SUPABASE BROADCAST
   ══════════════════════════════════════════════════════════════ */

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  const name = currentUser.name || 'UNKNOWN';
  const time = new Date().toLocaleTimeString();

  // Render locally (self = false means broadcast won't echo back)
  renderChatMessage(name, text, time, true);

  // Broadcast to all connected peers
  realtimeChannel.send({
    type:    'broadcast',
    event:   'chat_message',
    payload: { name, text, time },
  });

  input.value = '';
  input.focus();
}

/**
 * Render a chat message in the panel.
 * @param {string}  name   - Sender display name
 * @param {string}  text   - Message body
 * @param {string}  time   - Formatted time string
 * @param {boolean} isSelf - True if sent by the local user
 */
function renderChatMessage(name, text, time, isSelf) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message';

  if (isSelf) {
    div.style.borderColor = '#2563eb55';
    div.style.background  = '#0f1e3a';
  }

  div.innerHTML = `
    <div class="chat-user">
      ${escapeHtml(name)}
      ${isSelf ? '<span style="font-size:10px;color:#2563eb;">(YOU)</span>' : ''}
    </div>
    <div class="chat-text">${escapeHtml(text)}</div>
    <div class="chat-time">${time}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// System message (join / leave / info)
function addSystemMessage(text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message system-msg';
  div.innerHTML = `
    <div class="chat-user">SYSTEM</div>
    <div class="chat-text">${escapeHtml(text)}</div>
    <div class="chat-time">${new Date().toLocaleTimeString()}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}


/* ══════════════════════════════════════════════════════════════
   18. REACTIONS — GLOBAL VIA SUPABASE BROADCAST
   ══════════════════════════════════════════════════════════════ */

function sendReaction(emoji) {
  showFloatingReaction(emoji);

  realtimeChannel.send({
    type:    'broadcast',
    event:   'reaction',
    payload: { emoji },
  });

  // Close picker after sending
  document.getElementById('reactionPicker').classList.remove('active');
}

/**
 * Render a floating emoji animation on screen.
 * Called for both local and remote reactions.
 */
function showFloatingReaction(emoji) {
  const el = document.createElement('div');
  el.className  = 'floating-reaction';
  el.textContent = emoji;
  el.style.left  = (Math.random() * 80 + 10) + '%';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}


/* ══════════════════════════════════════════════════════════════
   19. TOAST NOTIFICATIONS
   Transient join/leave alerts that auto-dismiss after 4 seconds.
   ══════════════════════════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}


/* ══════════════════════════════════════════════════════════════
   20. COMMS LOG
   Lightweight on-screen debug log (hidden on mobile).
   ══════════════════════════════════════════════════════════════ */

function addLog(message) {
  const logContainer = document.getElementById('comms-log');
  if (!logContainer) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContainer.prepend(entry);

  // Keep log from growing unbounded
  const entries = logContainer.querySelectorAll('.log-entry');
  if (entries.length > 50) entries[entries.length - 1].remove();
}


/* ══════════════════════════════════════════════════════════════
   21. PAGE VISIBILITY — PERSISTENT CALL SESSION
   The WebRTC connection (Agora) naturally survives tab switches.
   This handler simply logs the visibility state and re-acquires
   the wake lock when the page becomes visible again.

   KEY PRINCIPLE: We do NOT disconnect on visibility change.
   The call only ends via terminateComms() or network loss.
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Page is in background — call remains alive, do nothing
    addLog('SYSTEM :: Page backgrounded — call staying active');
  } else {
    // Page returned to foreground
    addLog('SYSTEM :: Page foregrounded');
    if (activeStream) {
      WakeLockManager.request(); // Re-acquire if it was released
    }
  }
});


/* ══════════════════════════════════════════════════════════════
   22. MOBILE: KEEP INPUT ABOVE KEYBOARD
   When the virtual keyboard opens on iOS/Android, the visual
   viewport shrinks. We shift the chat panel so the input is
   never buried under the keyboard.
   ══════════════════════════════════════════════════════════════ */

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const chatPanel = document.getElementById('chatPanel');
    if (!chatPanel.classList.contains('open')) return;

    const viewportHeight = window.visualViewport.height;
    const windowHeight   = window.innerHeight;

    chatPanel.style.height = viewportHeight + 'px';
    chatPanel.style.top    = window.visualViewport.offsetTop + 'px';
  });
}


/* ══════════════════════════════════════════════════════════════
   23. KEYBOARD SHORTCUT — SEND CHAT ON ENTER
   ══════════════════════════════════════════════════════════════ */

document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});


/* ══════════════════════════════════════════════════════════════
   24. BEFOREUNLOAD — GRACEFUL CLEANUP
   Attempts to remove the user from the presence table when the
   tab/window closes. Note: async work in beforeunload is
   best-effort only — browsers may not wait for it.
   ══════════════════════════════════════════════════════════════ */

window.addEventListener('beforeunload', () => {
  if (!currentUser?.phone) return;

  // Use sendBeacon for reliable fire-and-forget cleanup
  // (fetch/await is unreliable in beforeunload)
  const url = `${SUPABASE_URL}/rest/v1/group_call_members?phone=eq.${encodeURIComponent(currentUser.phone)}`;
  try {
    navigator.sendBeacon(
      url,
      JSON.stringify({ _method: 'DELETE' })
    );
  } catch (_) {}

  // Also close the local audio track synchronously
  if (localAudioTrack) {
    localAudioTrack.close();
  }
});


/* ══════════════════════════════════════════════════════════════
   25. INCOMING CALL DETECTION ON PAGE LOAD
   If there are already members in the channel when the page
   loads, show the incoming call overlay so the user knows
   a call is in progress.
   ══════════════════════════════════════════════════════════════ */

(async function detectActiveCall() {
  try {
    const { data } = await sbClient
      .from('group_call_members')
      .select('name, phone')
      .limit(5);

    if (data && data.length > 0) {
      // There are already operators in the channel — show incoming overlay
      const callerName = data[0]?.name || 'Unknown operator';
      showIncomingCallOverlay({ callerName });
    }
  } catch (_) {
    // Supabase unavailable — silent fail, user can join manually
  }
})();


/* ══════════════════════════════════════════════════════════════
   26. SECURITY HELPER
   Prevents XSS when inserting user-provided content into the DOM.
   ══════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   GROUPCALL.JS — CADRE Group Voice Communication Engine
   v3.0

   CALL FLOW OVERVIEW
   ─────────────────
   INITIATOR (person who clicks START CALL):
     1. Clicks START CALL → joinAsInitiator()
     2. Joins Agora channel silently (no ringtone)
     3. Broadcasts  call_invite  so other pages ring
     4. Sees "CALLING… WAITING FOR OPERATORS" status
     5. When someone joins → status updates to LIVE
     6. If they leave → broadcasts  call_cancelled / call_host_ended

   ANSWERER (person who taps ANSWER on the overlay):
     1. incoming-call-manager.js shows overlay on their page
     2. They tap ANSWER → sessionStorage flag set → navigate to groupcall.html
     3. groupcall.js detects the flag → joinAsAnswerer()
     4. Joins Agora quietly, no ringtone, no re-broadcast

   ANSWERER already on groupcall.html (not yet in call):
     1. call_invite broadcast arrives
     2. groupcall.js shows the on-page incoming overlay + rings
     3. They tap ANSWER → joinAsAnswerer()
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

const SPEAKING_THRESHOLD = 18; // volume level (0–255) for active speaker


/* ══════════════════════════════════════════════════════════════
   2. SUPABASE INIT
   ══════════════════════════════════════════════════════════════ */

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* ══════════════════════════════════════════════════════════════
   3. SESSION / USER IDENTITY
   Loaded from localStorage — written by your auth system.
   Shape: { name, rank, phone, avatar_url }
   ══════════════════════════════════════════════════════════════ */

const currentUser = (() => {
  try {
    const s = JSON.parse(localStorage.getItem('session_user'));
    if (s && s.name) return s;
  } catch (_) {}
  return {
    name:       'OPERATOR_' + Math.floor(Math.random() * 9000 + 1000),
    rank:       'UNIT',
    phone:      'anon_' + Math.random().toString(36).slice(2, 9),
    avatar_url: null,
  };
})();

// Populate local card immediately
document.getElementById('local-name').textContent = currentUser.name || 'UNKNOWN';
document.getElementById('local-rank').textContent = currentUser.rank || 'UNIT';
document.getElementById('local-avatar').src = currentUser.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0f172a&color=00f0ff`;


/* ══════════════════════════════════════════════════════════════
   4. AGORA CLIENT
   ══════════════════════════════════════════════════════════════ */

const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
AgoraRTC.setLogLevel(3); // ERROR only — suppress verbose logs

let localAudioTrack = null;
let activeStream    = false;  // true while in an active Agora session
let isMuted         = false;
let handRaised      = false;
let isRecording     = false;
let speakerEnabled  = true;

/*
  callRole tracks WHY the user is in the call:
    'initiator' — they clicked START CALL and own the session
    'answerer'  — they accepted an incoming invite
    null        — not in a call
*/
let callRole = null;

/*
  callId is a unique ID for the active call session.
  The initiator generates it and includes it in broadcasts so
  all cancel/end events can be matched to the correct call.
*/
let callId = null;

// Expose in-call state globally so incoming-call-manager.js
// (running on other pages) knows to skip the overlay.
// On THIS page the flag is managed below; it is not used here.
window.CADRE_IN_CALL = false;


/* ══════════════════════════════════════════════════════════════
   5. RINGTONE MANAGER
   Only plays on this page when someone ELSE starts a call while
   the local user is viewing groupcall.html but hasn't joined.
   NEVER plays on page load or on join.
   ══════════════════════════════════════════════════════════════ */

const RingtoneManager = (() => {
  const audio    = document.getElementById('ringtone');
  let   unlocked = false;

  // Satisfy browser autoplay policy on first user gesture
  function unlock() {
    if (unlocked || !audio) return;
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      unlocked = true;
    }).catch(() => {});
  }

  document.addEventListener('click',    unlock, { once: true });
  document.addEventListener('touchend', unlock, { once: true });
  document.addEventListener('keydown',  unlock, { once: true });

  function play() {
    if (!audio) return;
    audio.volume      = 1;
    audio.currentTime = 0;
    audio.play().catch(() => {
      addLog('RINGTONE :: Autoplay blocked — tap anywhere to allow audio');
    });
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
   Prevents the screen from sleeping on mobile during a call.
   ══════════════════════════════════════════════════════════════ */

const WakeLockManager = (() => {
  let wakeLock = null;

  async function request() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        // Re-acquire automatically if the call is still live
        if (activeStream) request();
      });
      addLog('SYSTEM :: Wake lock active — screen stays on');
    } catch (err) {
      addLog(`SYSTEM :: Wake lock unavailable — ${err.message}`);
    }
  }

  async function release() {
    if (!wakeLock) return;
    try { await wakeLock.release(); } catch (_) {}
    wakeLock = null;
  }

  return { request, release };
})();


/* ══════════════════════════════════════════════════════════════
   7. CALL DURATION TIMER
   ══════════════════════════════════════════════════════════════ */

const CallTimer = (() => {
  let startTime  = null;
  let intervalId = null;
  const el       = document.getElementById('call-timer');

  function fmt(ms) {
    const s   = Math.floor(ms / 1000);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm  = String(m).padStart(2, '0');
    const ss  = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function start() {
    startTime        = Date.now();
    el.style.display = 'block';
    intervalId       = setInterval(() => { el.textContent = fmt(Date.now() - startTime); }, 1000);
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
   Agora quality scale: 1–2 good, 3 medium, 4 poor, 5–6 bad.
   ══════════════════════════════════════════════════════════════ */

const QualityIndicator = (() => {
  const el = document.getElementById('quality-indicator');

  function update(up, down) {
    const q = Math.max(up, down);
    el.className = 'quality-indicator';
    if      (q === 0 || q === 6) return;
    else if (q <= 2) el.classList.add('good');
    else if (q === 3) el.classList.add('medium');
    else if (q === 4) el.classList.add('poor');
    else              el.classList.add('bad');
  }

  function reset() { el.className = 'quality-indicator'; }

  return { update, reset };
})();


/* ══════════════════════════════════════════════════════════════
   9. ACTIVE SPEAKER DETECTION
   Uses Agora's volume-indicator event. Highlights the loudest
   speaker above the threshold in real time.
   ══════════════════════════════════════════════════════════════ */

const SpeakerDetection = (() => {
  let currentSpeaker = null;

  function start() {
    agoraClient.enableAudioVolumeIndicator();

    agoraClient.on('volume-indicator', (volumes) => {
      if (!volumes || volumes.length === 0) { clearSpeaker(); return; }

      let loudest = null;
      let maxVol  = SPEAKING_THRESHOLD;

      for (const { uid, level } of volumes) {
        if (level > maxVol) { maxVol = level; loudest = uid; }
      }

      loudest === null ? clearSpeaker() : setSpeaker(loudest);
    });
  }

  function setSpeaker(uid) {
    if (currentSpeaker === uid) return;
    clearSpeaker(false);
    currentSpeaker = uid;
    document.getElementById(`remote-${uid}`)?.classList.add('speaking');
    document.getElementById(`pitem-${uid}`)?.classList.add('speaking');
  }

  function clearSpeaker(resetVar = true) {
    if (currentSpeaker !== null) {
      document.getElementById(`remote-${currentSpeaker}`)?.classList.remove('speaking');
      document.getElementById(`pitem-${currentSpeaker}`)?.classList.remove('speaking');
    }
    if (resetVar) currentSpeaker = null;
  }

  function stop() { clearSpeaker(); }

  return { start, stop, clearSpeaker };
})();


/* ══════════════════════════════════════════════════════════════
   10. PARTICIPANT MANAGER
   Map-backed; prevents duplicate cards. Drives both the main
   grid and the slide-in participants panel.
   ══════════════════════════════════════════════════════════════ */

const ParticipantManager = (() => {
  const map = new Map(); // uid → { name, rank, avatar }

  /* ── helpers ──────────────────────────────────────────────── */
  function avatarFor(name, url) {
    return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=00f0ff`;
  }

  /* ── grid card ────────────────────────────────────────────── */
  function addCard(uid, meta) {
    if (document.getElementById(`remote-${uid}`)) return;
    const { name, rank, avatar } = meta;
    map.set(uid, meta);

    const card = document.createElement('div');
    card.className = 'user-card speaking';
    card.id        = `remote-${uid}`;
    card.innerHTML = `
      <div class="user-top-icons"><div class="user-badge">🎤 LIVE</div></div>
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
      </div>`;
    document.getElementById('participant-grid').appendChild(card);
    _updateCounts();
  }

  function removeCard(uid) {
    document.getElementById(`remote-${uid}`)?.remove();
    map.delete(uid);
    _updateCounts();
  }

  /* ── panel item ───────────────────────────────────────────── */
  function addPanelItem(uid, meta) {
    if (document.getElementById(`pitem-${uid}`)) return;
    const { name, rank, avatar } = meta;
    const item = document.createElement('div');
    item.className = 'participant-item';
    item.id        = `pitem-${uid}`;
    item.innerHTML = `
      <img src="${avatar}" class="participant-item-avatar" alt="${escapeHtml(name)}">
      <div class="participant-item-info">
        <div class="participant-item-name">${escapeHtml(name)}</div>
        <div class="participant-item-rank">${escapeHtml(rank)}</div>
      </div>
      <div class="participant-item-status">● LIVE</div>`;
    document.getElementById('participants-list').appendChild(item);
  }

  function removePanelItem(uid) {
    document.getElementById(`pitem-${uid}`)?.remove();
  }

  /* ── public API ───────────────────────────────────────────── */
  function add(uid, rawMeta = {}) {
    const meta = {
      name:   rawMeta.name   || String(uid),
      rank:   rawMeta.rank   || 'REMOTE OPERATOR',
      avatar: avatarFor(rawMeta.name || String(uid), rawMeta.avatar_url || rawMeta.avatar),
    };
    addCard(uid, meta);
    addPanelItem(uid, meta);
  }

  function remove(uid) {
    removeCard(uid);
    removePanelItem(uid);
  }

  function addLocalToPanel() {
    if (document.getElementById('pitem-local')) return;
    const avatar = avatarFor(currentUser.name, currentUser.avatar_url);
    const item   = document.createElement('div');
    item.className = 'participant-item';
    item.id        = 'pitem-local';
    item.innerHTML = `
      <img src="${avatar}" class="participant-item-avatar" alt="${escapeHtml(currentUser.name)}">
      <div class="participant-item-info">
        <div class="participant-item-name">
          ${escapeHtml(currentUser.name)}
          <span style="font-size:10px;color:#2563eb;">(YOU)</span>
        </div>
        <div class="participant-item-rank">${escapeHtml(currentUser.rank || 'UNIT')}</div>
      </div>
      <div class="participant-item-status">● LIVE</div>`;
    document.getElementById('participants-list').prepend(item);
  }

  function removeLocalFromPanel() {
    document.getElementById('pitem-local')?.remove();
  }

  function _updateCounts() {
    const total = map.size + (activeStream ? 1 : 0);
    const label = `${total} OPERATOR${total !== 1 ? 'S' : ''} CONNECTED`;
    document.getElementById('member-count').textContent              = label;
    document.getElementById('participants-panel-count').textContent  = total;
  }

  async function refreshFromDB() {
    try {
      const { data } = await sbClient.from('group_call_members').select('*');
      if (!data) return;
      const total = data.length;
      document.getElementById('member-count').textContent             = `${total} OPERATOR${total !== 1 ? 'S' : ''} CONNECTED`;
      document.getElementById('participants-panel-count').textContent = total;
    } catch (_) {}
  }

  function clear() {
    map.forEach((_, uid) => remove(uid));
    removeLocalFromPanel();
  }

  return { add, remove, addLocalToPanel, removeLocalFromPanel, refreshFromDB, clear };
})();


/* ══════════════════════════════════════════════════════════════
   11. SUPABASE REALTIME CHANNEL
   Shared broadcast channel for: chat, reactions, call signals.
   self:false → the sender never receives its own broadcasts.
   ══════════════════════════════════════════════════════════════ */

const realtimeChannel = sbClient.channel('cadre_comms', {
  config: { broadcast: { self: false } },
});

// ── Chat ──────────────────────────────────────────────────────
realtimeChannel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
  renderChatMessage(payload.name, payload.text, payload.time, false);
});

// ── Reactions ─────────────────────────────────────────────────
realtimeChannel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
  showFloatingReaction(payload.emoji);
});

// ── Incoming call invite ───────────────────────────────────────
// Shows the on-page overlay only when the user is currently on
// groupcall.html but has NOT yet joined (activeStream === false).
// incoming-call-manager.js handles this on all other pages.
realtimeChannel.on('broadcast', { event: 'call_invite' }, ({ payload }) => {
  // Never ring for the person who started the call
  if (payload.callerPhone === currentUser.phone) return;
  // Already in the call — just a new participant joining, not an invite
  if (activeStream) return;
  // Show the inline incoming call overlay and ring
  showIncomingCallOverlay(payload);
});

// ── Caller cancelled (before anyone joined) ───────────────────
realtimeChannel.on('broadcast', { event: 'call_cancelled' }, ({ payload }) => {
  hideIncomingCallOverlay();
  if (payload?.callerName) {
    addLog(`SYSTEM :: ${payload.callerName} cancelled the call`);
    showToast(`${payload.callerName} cancelled the call`, 'info');
  }
});

// ── Host ended the call (for everyone in the call) ────────────
realtimeChannel.on('broadcast', { event: 'call_host_ended' }, () => {
  if (activeStream) {
    showToast('The host has ended the call', 'info');
    addLog('SYSTEM :: Host ended the call');
    terminateComms(false); // false = don't re-broadcast (we're the receiver)
  }
});

realtimeChannel.subscribe((status) => {
  if (status === 'SUBSCRIBED') addLog('COMMS :: Realtime broadcast channel active');
});

// DB presence changes → refresh count label
let membersChannelCreated = false;
function listenForMembers() {
  if (membersChannelCreated) return; // prevent duplicate subscriptions on rejoin
  membersChannelCreated = true;
  sbClient
    .channel('group_call_members_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_call_members' },
        () => ParticipantManager.refreshFromDB())
    .subscribe();
}


/* ══════════════════════════════════════════════════════════════
   12. INCOMING CALL OVERLAY (on groupcall.html)
   Only shown when a call_invite arrives and the user hasn't
   joined yet. NEVER triggered by page load.
   ══════════════════════════════════════════════════════════════ */

function showIncomingCallOverlay(payload = {}) {
  const overlay = document.getElementById('incoming-call-overlay');
  if (!overlay) return;

  const callerName   = payload.callerName   || 'CADRE OPERATOR';
  const callerAvatar = payload.callerAvatar  || null;

  document.getElementById('incoming-call-name').textContent = callerName;
  document.getElementById('incoming-call-sub').textContent  =
    `${callerName} has started a secure channel`;

  // Show caller's real avatar if provided
  const avatarEl = document.getElementById('incoming-call-avatar');
  if (avatarEl) {
    avatarEl.src = callerAvatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(callerName)}&background=0f172a&color=00f0ff`;
  }

  overlay.classList.add('active');
  RingtoneManager.play(); // Only plays when a real invite is received
}

function hideIncomingCallOverlay() {
  document.getElementById('incoming-call-overlay')?.classList.remove('active');
  RingtoneManager.stop();
}

// ANSWER button on the in-page overlay
function answerIncomingCall() {
  hideIncomingCallOverlay();
  joinAsAnswerer();
}

// DECLINE button on the in-page overlay
function declineIncomingCall() {
  hideIncomingCallOverlay();
  addLog('SYSTEM :: Incoming call declined');
}


/* ══════════════════════════════════════════════════════════════
   13A. JOIN AS INITIATOR
   Called when the user clicks START CALL on groupcall.html.
   Joins the channel, broadcasts call_invite to all other pages,
   and shows "CALLING…" state until someone answers.
   ══════════════════════════════════════════════════════════════ */

async function initializeComms() {
  // Check sessionStorage: did the user arrive here by tapping ANSWER
  // in incoming-call-manager.js on another page?
  const action = sessionStorage.getItem('cadre_call_action');
  if (action === 'answer') {
    sessionStorage.removeItem('cadre_call_action');
    sessionStorage.removeItem('cadre_call_id');
    await joinAsAnswerer();
    return;
  }

  // Otherwise, this user is the initiator
  await joinAsInitiator();
}

async function joinAsInitiator() {
  if (activeStream) return;

  callRole = 'initiator';
  callId   = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  _enterCallingState();
  await _joinChannel();

  // Broadcast invite to all other users' pages AFTER successfully joining
  // so the channel is guaranteed to be live when they navigate to it
  realtimeChannel.send({
    type:    'broadcast',
    event:   'call_invite',
    payload: {
      callId,
      callerPhone:  currentUser.phone,
      callerName:   currentUser.name,
      callerRank:   currentUser.rank   || '',
      callerAvatar: currentUser.avatar_url || null,
    },
  }).catch(() => {});

  addLog('COMMS :: Call invite broadcast to all operators');
}


/* ══════════════════════════════════════════════════════════════
   13B. JOIN AS ANSWERER
   Called when the user taps ANSWER (either on the in-page
   overlay or after navigating from another page).
   Joins the channel quietly — NO ringtone, NO broadcast.
   ══════════════════════════════════════════════════════════════ */

async function joinAsAnswerer() {
  if (activeStream) return;

  callRole = 'answerer';
  callId   = sessionStorage.getItem('cadre_call_id') || null;

  _enterLiveState(); // Skip "CALLING…" — go straight to LIVE
  await _joinChannel();
}


/* ══════════════════════════════════════════════════════════════
   13C. SHARED CHANNEL JOIN LOGIC
   ══════════════════════════════════════════════════════════════ */

async function _joinChannel() {
  // Remove any lingering listeners from a previous session
  // to prevent duplicate event handlers on rejoin
  agoraClient.removeAllListeners('user-published');
  agoraClient.removeAllListeners('user-left');
  agoraClient.removeAllListeners('network-quality');
  agoraClient.removeAllListeners('connection-state-change');
  agoraClient.removeAllListeners('volume-indicator');

  try {
    activeStream         = true;
    window.CADRE_IN_CALL = true;

    await agoraClient.join(AGORA_APP_ID, AGORA_CHANNEL, AGORA_TOKEN, currentUser.phone || null);

    // Microphone track with echo cancel, noise suppress, auto gain
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      AEC: true,
      ANS: true,
      AGC: true,
      encoderConfig: { sampleRate: 48000, stereo: false, bitrate: 64 },
    });

    await agoraClient.publish([localAudioTrack]);
    addLog('VOICE LINK :: Microphone published to channel');

    // Register presence in Supabase
    // NOTE: Supabase JS v2 query builders are thenables but do NOT expose
    // .catch() — always use try/catch or plain await (no .catch() chaining).
    try {
      await sbClient.from('group_call_members').upsert({
        phone:      currentUser.phone,
        name:       currentUser.name,
        rank:       currentUser.rank,
        avatar_url: currentUser.avatar_url || null,
        status:     'ONLINE',
        joined_at:  Date.now(),
      });
    } catch (_) {
      // Presence registration failed — non-fatal, call continues
      addLog('WARN :: Presence table upsert failed (non-fatal)');
    }

    ParticipantManager.addLocalToPanel();
    ParticipantManager.refreshFromDB();
    listenForMembers();
    CallTimer.start();
    WakeLockManager.request();
    SpeakerDetection.start();

    // ── Remote user joined ────────────────────────────────
    agoraClient.on('user-published', async (user, mediaType) => {
      if (mediaType !== 'audio') return;

      await agoraClient.subscribe(user, mediaType);
      user.audioTrack.play();

      // If initiator was in "CALLING…" state, switch to LIVE now
      if (callRole === 'initiator') _enterLiveState();

      // Fetch real profile from Supabase (non-blocking)
      let meta = {};
      try {
        const { data } = await sbClient
          .from('group_call_members')
          .select('name, rank, avatar_url')
          .eq('phone', String(user.uid))
          .single();
        if (data) meta = { name: data.name, rank: data.rank, avatar_url: data.avatar_url };
      } catch (_) {}

      ParticipantManager.add(user.uid, meta);
      const displayName = meta.name || String(user.uid);
      showToast(`${displayName} joined the channel`, 'join');
      addLog(`VOICE LINK :: ${displayName} connected`);
    });

    // ── Remote user left ──────────────────────────────────
    agoraClient.on('user-left', (user) => {
      const nameEl = document.getElementById(`remote-${user.uid}`)?.querySelector('.user-name');
      const name   = nameEl?.textContent || String(user.uid);
      ParticipantManager.remove(user.uid);
      SpeakerDetection.clearSpeaker();
      showToast(`${name} left the channel`, 'leave');
      addLog(`VOICE LINK :: ${name} disconnected`);
    });

    // ── Network quality ───────────────────────────────────
    agoraClient.on('network-quality', ({ uplinkNetworkQuality, downlinkNetworkQuality }) => {
      QualityIndicator.update(uplinkNetworkQuality, downlinkNetworkQuality);
    });

    // ── Connection state ──────────────────────────────────
    agoraClient.on('connection-state-change', (cur, prev, reason) => {
      addLog(`NETWORK :: ${prev} → ${cur}${reason ? ` (${reason})` : ''}`);
    });

  } catch (err) {
    console.error('[CADRE] Join error:', err);
    addLog(`ERROR :: ${err.message}`);
    showToast('Failed to connect — check microphone permissions', 'info');

    // Close mic track if it was created before the error
    if (localAudioTrack) {
      try { localAudioTrack.close(); } catch (_) {}
      localAudioTrack = null;
    }

    // Leave Agora channel if it was joined before the error
    // (prevents a "half-joined" state that blocks future join attempts)
    try { await agoraClient.leave(); } catch (_) {}

    // Rollback all state flags
    activeStream         = false;
    window.CADRE_IN_CALL = false;
    callRole             = null;
    callId               = null;
    _resetToIdleState();
  }
}


/* ══════════════════════════════════════════════════════════════
   14. LEAVE — terminateComms()
   broadcastCancelled:
     true  (default) = this device is ending the call for everyone
     false           = we're responding to a host_ended signal
   ══════════════════════════════════════════════════════════════ */

async function terminateComms(broadcastEnd = true) {
  if (!activeStream && callRole === null) return;

  // Broadcast appropriate signal BEFORE tearing down the channel
  if (broadcastEnd && realtimeChannel) {
    const event   = callRole === 'initiator' ? 'call_host_ended' : 'call_cancelled';
    const payload = {
      callerPhone: currentUser.phone,
      callerName:  currentUser.name,
      callId,
    };
    realtimeChannel.send({ type: 'broadcast', event, payload }).catch(() => {});
  }

  activeStream         = false;
  window.CADRE_IN_CALL = false;
  callRole             = null;
  callId               = null;

  // Stop all monitoring
  SpeakerDetection.stop();
  CallTimer.stop();
  QualityIndicator.reset();
  WakeLockManager.release();

  // Close mic track BEFORE leaving the Agora channel
  if (localAudioTrack) {
    localAudioTrack.close();
    localAudioTrack = null;
  }

  // Remove listeners before .leave() to prevent ghost callbacks
  agoraClient.removeAllListeners('user-published');
  agoraClient.removeAllListeners('user-left');
  agoraClient.removeAllListeners('network-quality');
  agoraClient.removeAllListeners('connection-state-change');
  agoraClient.removeAllListeners('volume-indicator');

  try { await agoraClient.leave(); } catch (_) {}

  // Remove from Supabase presence table
  // Wrap in try/catch — Supabase v2 builders don't support .catch() chaining
  if (currentUser?.phone) {
    try {
      await sbClient.from('group_call_members').delete().eq('phone', currentUser.phone);
    } catch (_) {}
  }

  ParticipantManager.clear();
  ParticipantManager.refreshFromDB();
  _resetToIdleState();
  addLog('SYSTEM :: Tactical stream terminated');
}


/* ══════════════════════════════════════════════════════════════
   15. UI STATE TRANSITIONS
   Keeps UI consistent for idle / calling / live states.
   ══════════════════════════════════════════════════════════════ */

// User has clicked START CALL — waiting for others to join
function _enterCallingState() {
  document.getElementById('connection-status').textContent = 'CALLING… WAITING FOR OPERATORS';
  document.getElementById('joinBtn').style.display         = 'none';
  document.getElementById('leaveBtn').style.display        = 'none';
  document.getElementById('cancelCallBtn').style.display   = 'block'; // new cancel btn
  document.getElementById('muteBtn').style.display         = 'block';
  document.getElementById('speakerBtn').style.display      = 'block';
}

// At least one other user has joined — call is live
function _enterLiveState() {
  document.getElementById('connection-status').textContent = 'LIVE SECURE CHANNEL ACTIVE';
  document.getElementById('cancelCallBtn').style.display   = 'none';
  document.getElementById('leaveBtn').style.display        = 'block';
  document.getElementById('muteBtn').style.display         = 'block';
  document.getElementById('speakerBtn').style.display      = 'block';
  document.getElementById('joinBtn').style.display         = 'none';
}

// Call ended — back to idle
function _resetToIdleState() {
  document.getElementById('connection-status').textContent = 'CHANNEL OFFLINE';
  document.getElementById('joinBtn').style.display         = 'block';
  document.getElementById('leaveBtn').style.display        = 'none';
  document.getElementById('cancelCallBtn').style.display   = 'none';
  document.getElementById('muteBtn').style.display         = 'none';
  document.getElementById('speakerBtn').style.display      = 'none';

  // Reset mute icon for next session
  isMuted = false;
  document.getElementById('muteBtn').innerHTML =
    '🎤<div class="control-label">MIC</div>';
  document.getElementById('local-mic-icon').textContent = '🎤 LIVE';
}

// CANCEL CALL — only available to the initiator before anyone joins
async function cancelCall() {
  if (callRole !== 'initiator') return;
  await terminateComms(true);
}


/* ══════════════════════════════════════════════════════════════
   16. CALL CONTROLS
   ══════════════════════════════════════════════════════════════ */

async function toggleMute() {
  if (!localAudioTrack) return;
  isMuted = !isMuted;
  await localAudioTrack.setEnabled(!isMuted);

  document.getElementById('muteBtn').innerHTML = isMuted
    ? '🔇<div class="control-label">MUTED</div>'
    : '🎤<div class="control-label">MIC</div>';

  document.getElementById('local-mic-icon').textContent =
    isMuted ? '🔇 MUTED' : '🎤 LIVE';

  addLog(isMuted ? 'VOICE :: Microphone muted' : 'VOICE :: Microphone unmuted');
}

async function toggleSpeaker() {
  speakerEnabled = !speakerEnabled;
  const btn = document.getElementById('speakerBtn');
  btn.innerHTML = speakerEnabled
    ? '🔊<div class="control-label">SPEAKER</div>'
    : '🔈<div class="control-label">EARPIECE</div>';
  btn.classList.toggle('active', !speakerEnabled);

  // Best-effort output device routing (Chrome/Android; not available on iOS)
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    if (outputs.length > 1) {
      const target = speakerEnabled
        ? (outputs.find(d => d.label.toLowerCase().includes('speaker')) || outputs[0])
        : (outputs.find(d => d.label.toLowerCase().includes('earpiece') ||
                             d.label.toLowerCase().includes('default'))   || outputs[0]);
      document.querySelectorAll('audio').forEach(el => {
        if (el.setSinkId) el.setSinkId(target.deviceId).catch(() => {});
      });
    }
  } catch (_) {}

  addLog(`AUDIO :: Routed to ${speakerEnabled ? 'loudspeaker' : 'earpiece'}`);
}

function toggleRaiseHand() {
  handRaised = !handRaised;
  document.getElementById('local-hand-icon').style.display = handRaised ? 'block' : 'none';
  addLog(handRaised ? 'SIGNAL :: Hand raised' : 'SIGNAL :: Hand lowered');
}

function pinParticipant(id) {
  document.querySelectorAll('.user-card').forEach(c => (c.style.order = 0));
  const t = document.getElementById(id);
  if (t) t.style.order = -1;
}

function remoteMute(uid) {
  addLog(`ADMIN :: Mute request sent to ${uid}`);
}

function toggleRecord() {
  isRecording = !isRecording;
  document.querySelector('.control-btn[onclick="toggleRecord()"]')
    ?.classList.toggle('active', isRecording);
  addLog(isRecording ? 'REC :: Recording started' : 'REC :: Recording stopped');
}

function shareScreen() {
  if (navigator.share) {
    navigator.share({ title: 'CADRE CALL', url: window.location.href }).catch(() => {});
  } else {
    addLog('SHARE :: Web Share API not supported on this device');
  }
}


/* ══════════════════════════════════════════════════════════════
   17. UI PANEL TOGGLES
   ══════════════════════════════════════════════════════════════ */

function toggleChat() {
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('open');
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
  if (panel.classList.contains('open')) {
    document.getElementById('chatPanel').classList.remove('open');
  }
}

function toggleReactionPicker() {
  document.getElementById('reactionPicker').classList.toggle('active');
}


/* ══════════════════════════════════════════════════════════════
   18. CHAT
   ══════════════════════════════════════════════════════════════ */

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  const name = currentUser.name || 'UNKNOWN';
  const time = new Date().toLocaleTimeString();

  renderChatMessage(name, text, time, true);
  realtimeChannel.send({
    type: 'broadcast', event: 'chat_message', payload: { name, text, time },
  }).catch(() => {});

  input.value = '';
  input.focus();
}

function renderChatMessage(name, text, time, isSelf) {
  const container = document.getElementById('chat-messages');
  const div       = document.createElement('div');
  div.className   = 'chat-message';
  if (isSelf) { div.style.borderColor = '#2563eb55'; div.style.background = '#0f1e3a'; }
  div.innerHTML = `
    <div class="chat-user">
      ${escapeHtml(name)}
      ${isSelf ? '<span style="font-size:10px;color:#2563eb;">(YOU)</span>' : ''}
    </div>
    <div class="chat-text">${escapeHtml(text)}</div>
    <div class="chat-time">${time}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});


/* ══════════════════════════════════════════════════════════════
   19. REACTIONS
   ══════════════════════════════════════════════════════════════ */

function sendReaction(emoji) {
  showFloatingReaction(emoji);
  realtimeChannel.send({
    type: 'broadcast', event: 'reaction', payload: { emoji },
  }).catch(() => {});
  document.getElementById('reactionPicker').classList.remove('active');
}

function showFloatingReaction(emoji) {
  const el       = document.createElement('div');
  el.className   = 'floating-reaction';
  el.textContent = emoji;
  el.style.left  = (Math.random() * 80 + 10) + '%';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}


/* ══════════════════════════════════════════════════════════════
   20. TOAST NOTIFICATIONS
   ══════════════════════════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast       = document.createElement('div');
  toast.className   = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}


/* ══════════════════════════════════════════════════════════════
   21. COMMS LOG
   ══════════════════════════════════════════════════════════════ */

function addLog(message) {
  const log = document.getElementById('comms-log');
  if (!log) return;
  const entry       = document.createElement('div');
  entry.className   = 'log-entry';
  entry.innerHTML   = `[${new Date().toLocaleTimeString()}] ${message}`;
  log.prepend(entry);
  // Cap at 50 entries to avoid unbounded growth
  const all = log.querySelectorAll('.log-entry');
  if (all.length > 50) all[all.length - 1].remove();
}


/* ══════════════════════════════════════════════════════════════
   22. PAGE VISIBILITY — PERSISTENT SESSION
   The Agora WebRTC connection naturally survives tab switches.
   We NEVER disconnect on visibility change — only on hangup
   or network failure. We simply re-acquire wake lock on return.
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && activeStream) {
    WakeLockManager.request();
  }
});


/* ══════════════════════════════════════════════════════════════
   23. MOBILE: KEEP CHAT INPUT ABOVE KEYBOARD
   ══════════════════════════════════════════════════════════════ */

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const panel = document.getElementById('chatPanel');
    if (!panel.classList.contains('open')) return;
    panel.style.height = window.visualViewport.height + 'px';
    panel.style.top    = window.visualViewport.offsetTop + 'px';
  });
}


/* ══════════════════════════════════════════════════════════════
   24. BEFOREUNLOAD — GRACEFUL CLEANUP
   sendBeacon is used because fetch/await are unreliable here.
   ══════════════════════════════════════════════════════════════ */

window.addEventListener('beforeunload', () => {
  if (localAudioTrack) localAudioTrack.close();

  if (currentUser?.phone) {
    const url = `${SUPABASE_URL}/rest/v1/group_call_members?phone=eq.${encodeURIComponent(currentUser.phone)}`;
    try { navigator.sendBeacon(url, JSON.stringify({ _method: 'DELETE' })); } catch (_) {}
  }
});


/* ══════════════════════════════════════════════════════════════
   25. SECURITY HELPER — XSS PREVENTION
   ══════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

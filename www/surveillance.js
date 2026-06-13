'use strict';

(function () {
  const W = typeof window !== 'undefined' ? window : {};

  const CONFIG = {
    appId: null,
    token: null,
    channel: null,
    uid: null,
    maxOfficers: 10,
    joinRetryMs: 2500,
    maxJoinRetries: 5,
    activeSpeakerDebounceMs: 120,
    activeSpeakerMinIntervalMs: 200,
    inactiveBrightnessOpacity: 0.55,
  };

  const STATE = {
    currentMode: 'map', // 'grid' | 'map'
    recordingState: false,
    isMutedAll: false,
    lockdownActive: false,
    activeSpeakerUid: null,
    activeUsers: [],
    activeStreams: new Map(), // uid -> { user, videoTrack, audioTrack }
    selectedOfficerUid: null,
  };

  const OFFICERS = new Map(); // officerId -> officer

  const DOM = {
    grid: null,
    map: null,
    videoGridWrap: null,
    tacticalMap: null,
    toolbarInfo: null,
    activeFeedCount: null,
    systemStatusText: null,
    systemStatusPill: null,
    recStatus: null,
    btnStartRec: null,
    btnStopRec: null,
    btnMuteAll: null,
    btnUnmuteAll: null,
    btnSwitchView: null,
    btnEmergency: null,
    lockdownOverlay: null,
    lockdownCountdown: null,
    snapshotFlash: null,
    notifStack: null,
    officerRoster: null,
    onlineCount: null,
    scanFill: null,
  };

  const AGORA = {
    client: null,
    joined: false,
    localTracks: {
      video: null,
      audio: null,
    },
    joinRetries: 0,
    destroyed: false,
    activeSpeakerTimer: null,
    lastActiveSpeakerTs: 0,
  };

  function $id(id) {
    return document.getElementById(id);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function safeText(el, t) {
    if (!el) return;
    el.textContent = String(t);
  }

  function ensureDomRefs() {
    DOM.grid = $id('videoGrid') || $id('surveillance-grid');
    DOM.videoGridWrap = $id('surveillance-grid') || DOM.grid;
    DOM.tacticalMap = $id('tacticalMap') || $id('tactical-map');
    DOM.map = DOM.tacticalMap;
    DOM.toolbarInfo = $id('toolbarInfo');
    DOM.activeFeedCount = $id('activeFeedCount');
    DOM.systemStatusText = $id('systemStatusText');
    DOM.systemStatusPill = $id('systemStatusPill');

    DOM.recStatus = $id('recStatus');
    DOM.btnStartRec = $id('btnStartRec');
    DOM.btnStopRec = $id('btnStopRec');
    DOM.btnMuteAll = $id('btnMuteAll');
    DOM.btnUnmuteAll = $id('btnUnmuteAll');
    DOM.btnSwitchView = $id('btnSwitchView');
    DOM.btnEmergency = $id('btnLockdown') || $id('btnEmergency');

    DOM.lockdownOverlay = $id('lockdownOverlay');
    DOM.lockdownCountdown = $id('lockdownCountdown');
    DOM.snapshotFlash = $id('snapshotFlash');
    DOM.notifStack = $id('notifStack');

    DOM.officerRoster = $id('officerRoster');
    DOM.onlineCount = $id('onlineCount');
    DOM.scanFill = $id('scanFill');

    return DOM.grid && DOM.map;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function showNotif(message, type = 'info') {
    const stack = DOM.notifStack;
    if (!stack) return;
    const div = document.createElement('div');
    div.className = `notif notif-${type}`;
    div.innerHTML = `
      <span class="notif-icon">${
        type === 'ok' ? '✓' :
        type === 'warn' ? '⚠' :
        type === 'emergency' ? '🔴' : '▸'
      }</span>
      <span class="notif-text">${message}</span>
    `;
    stack.appendChild(div);
    requestAnimationFrame(() => div.classList.add('notif-show'));
    setTimeout(() => {
      div.classList.remove('notif-show');
      setTimeout(() => div.remove(), 400);
    }, 4000);
  }

  function addSysLog(level, text) {
    const log = $id('sysLog');
    if (!log) return;
    const ts = new Date();
    const time = `${String(ts.getUTCHours()).padStart(2, '0')}:${String(ts.getUTCMinutes()).padStart(2, '0')}:${String(ts.getUTCSeconds()).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = `log-entry log-${String(level || 'INFO').toLowerCase()}`;
    div.innerHTML = `<span class="log-time">${time}</span><span class="log-level">[${level}]</span><span class="log-text">${text}</span>`;
    log.insertBefore(div, log.firstChild);
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  function setView(mode) {
    STATE.currentMode = mode;

    if (DOM.map && DOM.grid) {
      DOM.map.classList.toggle('hidden', mode !== 'map');
      DOM.grid.classList.toggle('hidden', mode !== 'grid');
    }

    const info = DOM.toolbarInfo;
    if (info) {
      if (mode === 'grid') {
        info.textContent = `GRID VIEW — ${STATE.activeStreams.size} ACTIVE FEEDS`;
      } else {
        info.textContent = 'NO ACTIVE FEEDS — TACTICAL MAP MODE';
      }
    }

    if (mode === 'map') {
      STATE.activeSpeakerUid = null;
      syncActiveSpeakerVisuals();
    }
  }

  function ensureMapFallback(reason) {
    setView('map');
    const scanText = document.querySelector('.map-center-text .map-primary-text');
    if (scanText) scanText.textContent = 'TACTICAL SURVEILLANCE GRID ACTIVE – NO LIVE FEEDS';
    const secondary = document.querySelector('.map-center-text .map-secondary-text');
    if (secondary && reason) secondary.textContent = reason;

    if (DOM.scanFill) {
      DOM.scanFill.style.width = '100%';
      setTimeout(() => (DOM.scanFill.style.width = '0%'), 200);
    }
  }

  function ensureGridModeIfNeeded() {
    const active = getActiveVideoCount();
    if (active <= 0) {
      ensureMapFallback();
      return;
    }
    setView('grid');
  }

  function updateFeedCountUI() {
    const c = getActiveVideoCount();
    if (DOM.activeFeedCount) DOM.activeFeedCount.textContent = String(c);
  }

  function getActiveVideoCount() {
    let count = 0;
    for (const [, s] of STATE.activeStreams) {
      if (s && s.videoTrack && !s.videoTrack.isPlaying) count++;
      else if (s && s.videoTrack) count++;
    }
    // fallback: count keys
    if (STATE.activeStreams.size > 0 && count === 0) return STATE.activeStreams.size;
    return clamp(count, 0, CONFIG.maxOfficers);
  }

  function officerFromUid(uid) {
    const uidKey = String(uid);
    return (
      OFFICERS.get(uidKey) || {
        id: uid,
        name: `OFFICER-${uidKey.slice(-4)}`,
        codename: `COD${uidKey.slice(-3)}`,
        uid,
        channel: CONFIG.channel,
        videoTrack: null,
        mute: false,
        status: 'online',
      }
    );
  }

  function buildOfficerRoster() {
    const roster = DOM.officerRoster;
    const onlineCount = DOM.onlineCount;
    if (!roster || !onlineCount) return;

    roster.innerHTML = '';
    const officers = Array.from(OFFICERS.values()).slice(0, CONFIG.maxOfficers);
    const online = officers.filter((o) => o.status === 'online').length;
    safeText(onlineCount, `${online} ONLINE`);

    officers.forEach((o) => {
      const div = document.createElement('div');
      div.className = `officer-card ${o.status} ${String(STATE.selectedOfficerUid) === String(o.uid) ? 'selected' : ''}`;
      div.id = `officer-card-${o.uid}`;
      div.onclick = () => selectOfficer(o.uid);
      div.innerHTML = `
        <div class="officer-avatar">
          <svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 38 Q6 26 20 26 Q34 26 34 38" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          <div class="officer-status-dot ${o.status}"></div>
        </div>
        <div class="officer-info">
          <div class="officer-name">${o.name}</div>
          <div class="officer-codename">${o.codename || ''}</div>
        </div>
        <div class="officer-badges">
          ${o.mute ? '<span class="badge muted-badge">MUTED</span>' : ''}
          <span class="badge status-badge ${o.status}">${String(o.status).toUpperCase()}</span>
        </div>
      `;
      roster.appendChild(div);
    });
  }

  function selectOfficer(uid) {
    STATE.selectedOfficerUid = STATE.selectedOfficerUid === uid ? null : uid;
    const tiles = document.querySelectorAll('.video-tile');
    tiles.forEach((t) => t.classList.toggle('selected-tile', String(t.dataset.officerId) === String(uid)));
    buildOfficerRoster();
  }

  function createVideoTile(officer, trackPlayId) {
    if (!DOM.grid) return null;
    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = `tile-${officer.uid}`;
    tile.dataset.officerId = String(officer.uid);
    tile.onclick = () => selectOfficer(officer.uid);

    const quality = document.createElement('div');
    quality.className = 'tile-quality';
    quality.id = `tileQuality-${officer.uid}`;
    quality.textContent = 'HD';

    tile.innerHTML = `
      <div class="tile-video-area" id="${trackPlayId}">
        <div class="tile-placeholder">
          <div class="tile-placeholder-icon">
            <svg viewBox="0 0 60 60"><circle cx="30" cy="22" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 55 Q10 38 30 38 Q50 38 50 55" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <div class="tile-connecting">CONNECTING...</div>
        </div>
      </div>
      <div class="tile-hud">
        <div class="tile-hud-top">
          <div class="tile-live-ind">
            <span class="tile-live-dot"></span>
            <span class="tile-live-txt">LIVE</span>
          </div>
          <div class="tile-badge-row">
            ${officer.mute ? '<span class="tile-badge muted">MUTED</span>' : ''}
          </div>
        </div>
        <div class="tile-hud-bottom">
          <div class="tile-officer-info">
            <span class="tile-officer-name">${officer.name || `OFFICER-${officer.uid}`}</span>
            <span class="tile-officer-code">${officer.codename || ''}</span>
          </div>
          <div class="tile-controls">
            <button class="tile-btn" data-action="mute" aria-label="Toggle Mute">
              <svg viewBox="0 0 16 16"><path d="M8 2 L8 10 M5 4 Q2 6 2 8 Q2 12 8 12 Q14 12 14 8 Q14 6 11 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
            <button class="tile-btn" data-action="expand" aria-label="Expand">
              <svg viewBox="0 0 16 16"><path d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="tile-scanline"></div>
      <div class="tile-active-ring"></div>
      <div class="tile-conn-status" id="tileConn-${officer.uid}">
        <div class="conn-bar"><div class="conn-fill" style="width:85%"></div></div>
        <span>85ms</span>
      </div>
    `;

    const badgeRow = tile.querySelector('.tile-badge-row');
    if (badgeRow && !badgeRow.contains(quality)) badgeRow.appendChild(quality);

    DOM.grid.appendChild(tile);
    return tile;
  }

  function removeVideoTile(uid) {
    const tile = document.getElementById(`tile-${uid}`);
    if (!tile) return;
    tile.classList.add('tile-removing');
    setTimeout(() => tile.remove(), 500);
  }

  function syncActiveSpeakerVisuals() {
    const activeUid = STATE.activeSpeakerUid;
    const tiles = document.querySelectorAll('.video-tile');
    tiles.forEach((t) => {
      const isActive = activeUid != null && String(t.dataset.officerId) === String(activeUid);
      t.classList.toggle('active-speaker', isActive);
      t.style.filter = isActive ? 'brightness(1) contrast(1.05)' : `brightness(${CONFIG.inactiveBrightnessOpacity})`;
    });
  }

  function setVideoTileBrightness(uid, isActive) {
    const tile = document.getElementById(`tile-${uid}`);
    if (!tile) return;
    tile.style.filter = isActive ? 'brightness(1) contrast(1.05)' : `brightness(${CONFIG.inactiveBrightnessOpacity})`;
    tile.classList.toggle('active-speaker', isActive);
  }

  function updateTileMuteUI(uid, muted) {
    const tile = document.getElementById(`tile-${uid}`);
    if (!tile) return;
    const badgeRow = tile.querySelector('.tile-badge-row');
    if (!badgeRow) return;
    const existing = badgeRow.querySelector('.tile-badge.muted');
    if (muted && !existing) {
      const b = document.createElement('span');
      b.className = 'tile-badge muted';
      b.textContent = 'MUTED';
      badgeRow.insertBefore(b, badgeRow.firstChild);
    }
    if (!muted && existing) existing.remove();
  }

  function applyMuteAllToTiles() {
    for (const [uid] of STATE.activeStreams) {
      const officer = officerFromUid(uid);
      officer.mute = STATE.isMutedAll;
      updateTileMuteUI(uid, officer.mute);
      setVideoTileBrightness(uid, STATE.activeSpeakerUid != null && String(STATE.activeSpeakerUid) === String(uid));
    }
  }

  function wireTileButtons() {
    if (!DOM.grid) return;
    DOM.grid.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button[data-action]') : null;
      if (!btn) return;
      const tile = btn.closest('.video-tile');
      if (!tile) return;
      const uid = tile.dataset.officerId;

      if (btn.dataset.action === 'mute') {
        e.stopPropagation();
        const officer = officerFromUid(uid);
        officer.mute = !officer.mute;
        OFFICERS.set(String(uid), officer);
        updateTileMuteUI(uid, officer.mute);
        showNotif(`${officer.codename || officer.name || `OFFICER-${uid}`}: ${officer.mute ? 'MUTED' : 'UNMUTED'}`, 'warn');
      }
      if (btn.dataset.action === 'expand') {
        e.stopPropagation();
        document.querySelectorAll('.video-tile').forEach((t) => {
          if (String(t.dataset.officerId) === String(uid)) t.classList.toggle('tile-expanded');
          else t.classList.remove('tile-expanded');
        });
      }
    });
  }

  function getAgoraClient() {
    if (AGORA.client) return AGORA.client;
    const AgoraRTC = W.AgoraRTC || W.AgoraRTC_N;
    if (!AgoraRTC || typeof AgoraRTC.createClient !== 'function') {
      throw new Error('AgoraRTC SDK not found. Ensure AgoraRTC_N.js is loaded before surveillance.js');
    }
    AGORA.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
    return AGORA.client;
  }

  function decodeInitConfig() {
    // Support multiple naming conventions without backend.
    CONFIG.channel = CONFIG.channel || getQueryParam('channel') || 'cadre-surveillance';
    CONFIG.appId = CONFIG.appId || getQueryParam('appId') || null;
    CONFIG.token = CONFIG.token || getQueryParam('token') || null;
    CONFIG.uid = CONFIG.uid || getQueryParam('uid') || null;

    // If SDK globals set defaults, prefer them.
    if (W.__AGORA_APP_ID) CONFIG.appId = W.__AGORA_APP_ID;
    if (W.__AGORA_TOKEN) CONFIG.token = W.__AGORA_TOKEN;
    if (W.__AGORA_CHANNEL) CONFIG.channel = W.__AGORA_CHANNEL;
    if (W.__AGORA_UID) CONFIG.uid = W.__AGORA_UID;
  }

  function getQueryParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch {
      return null;
    }
  }

  async function joinChannel() {
    decodeInitConfig();

    const client = getAgoraClient();
    if (!CONFIG.appId || !CONFIG.channel) {
      showNotif('Agora config missing (appId/channel). Running UI-only mode.', 'warn');
      addSysLog('WARN', 'Agora join skipped — missing appId or channel');
      ensureMapFallback('SYSTEM ACTIVE — AWAITING AGORA CONFIG');
      return;
    }

    client.setClientRole && client.setClientRole('audience');

    client.on('user-published', onUserPublished);
    client.on('user-unpublished', onUserUnpublished);
    client.on('user-joined', onUserJoined);
    client.on('user-left', onUserLeft);

    // Active speaker via volume-indicator (best-effort)
    client.enableDualStream && client.enableDualStream(false);

    try {
      const joinUid = CONFIG.uid != null ? Number(CONFIG.uid) : null;
      const token = CONFIG.token || null;
      if (token) await client.join(CONFIG.appId, CONFIG.channel, token, joinUid ?? undefined);
      else await client.join(CONFIG.appId, CONFIG.channel, null, joinUid ?? undefined);

      AGORA.joined = true;
      AGORA.joinRetries = 0;
      addSysLog('INFO', `Joined Agora channel: ${CONFIG.channel}`);

      ensureGridModeIfNeeded();
    } catch (err) {
      AGORA.joined = false;
      addSysLog('ERROR', `Agora join failed: ${String(err && err.message ? err.message : err)}`);
      if (AGORA.joinRetries < CONFIG.maxJoinRetries) {
        AGORA.joinRetries++;
        setTimeout(joinChannel, CONFIG.joinRetryMs);
      } else {
        ensureMapFallback('AGORA CONNECTION FAILED — GRID STANDBY');
      }
    }
  }

  async function onUserJoined(user) {
    // Prepare officer record for roster
    const uid = user.uid;
    if (!OFFICERS.has(String(uid))) {
      OFFICERS.set(String(uid), {
        id: uid,
        uid,
        name: `OFFICER-${String(uid).slice(-4)}`,
        codename: `COD-${String(uid).slice(-3)}`,
        channel: CONFIG.channel,
        videoTrack: null,
        mute: false,
        status: 'online',
      });
      buildOfficerRoster();
    }
  }

  async function onUserPublished(user, mediaType) {
    if (!AGORA.joined) return;

    const uid = user.uid;
    if (!OFFICERS.has(String(uid))) await onUserJoined(user);
    const officer = officerFromUid(uid);

    try {
      await AGORA.client.subscribe(user, mediaType);

      let state = STATE.activeStreams.get(uid);
      if (!state) {
        state = { user, videoTrack: null, audioTrack: null };
        STATE.activeStreams.set(uid, state);
      }

      if (mediaType === 'video') {
        const videoTrack = user.videoTrack;
        state.videoTrack = videoTrack;
        officer.videoTrack = videoTrack;

        const playId = `agora-video-${uid}`;
        if (!document.getElementById(`tile-${uid}`)) {
          createVideoTile(officer, playId);
        }

        const tileArea = document.getElementById(playId);
        if (videoTrack && tileArea) {
          videoTrack.play(playId);
          setVideoTileBrightness(uid, false);
        }

        setTileLive(uid, true);
      }

      if (mediaType === 'audio') {
        const audioTrack = user.audioTrack;
        state.audioTrack = audioTrack;
        if (audioTrack) {
          try {
            audioTrack.play && audioTrack.play();
          } catch {}
        }
      }

      // Keep view consistent
      updateFeedCountUI();
      ensureGridModeIfNeeded();

      // If muted-all, disable remote audio tracks in best-effort.
      if (STATE.isMutedAll) {
        try {
          if (state.audioTrack && typeof state.audioTrack.setEnabled === 'function') state.audioTrack.setEnabled(false);
        } catch {}
      }

      syncActiveSpeakerVisuals();
    } catch (err) {
      addSysLog('WARN', `Subscribe failed for uid=${uid}: ${String(err && err.message ? err.message : err)}`);
    }
  }

  function setTileLive(uid, live) {
    const tile = document.getElementById(`tile-${uid}`);
    if (!tile) return;
    tile.classList.toggle('hidden', !live);
  }

  function onUserUnpublished(user, mediaType) {
    const uid = user.uid;
    const state = STATE.activeStreams.get(uid);
    if (!state) return;

    if (mediaType === 'video') {
      if (state.videoTrack) {
        try { state.videoTrack.stop && state.videoTrack.stop(); } catch {}
      }
      state.videoTrack = null;
      removeVideoTile(uid);
      STATE.activeStreams.delete(uid);
    }

    updateFeedCountUI();
    ensureGridModeIfNeeded();
  }

  function onUserLeft(user) {
    const uid = user.uid;
    const state = STATE.activeStreams.get(uid);

    if (state) {
      try {
        if (state.videoTrack) state.videoTrack.stop && state.videoTrack.stop();
      } catch {}
      try {
        if (state.audioTrack && state.audioTrack.stop) state.audioTrack.stop();
      } catch {}
      STATE.activeStreams.delete(uid);
    }

    removeVideoTile(uid);

    if (String(STATE.activeSpeakerUid) === String(uid)) {
      STATE.activeSpeakerUid = null;
    }

    updateFeedCountUI();

    if (STATE.activeStreams.size === 0) {
      ensureMapFallback('TACTICAL SURVEILLANCE GRID ACTIVE – NO LIVE FEEDS');
    } else {
      ensureGridModeIfNeeded();
    }

    if (OFFICERS.has(String(uid))) {
      const o = OFFICERS.get(String(uid));
      o.status = 'offline';
      OFFICERS.set(String(uid), o);
      buildOfficerRoster();
    }
  }

  function startActiveSpeakerDetection() {
    const client = AGORA.client;
    const AgoraRTC = W.AgoraRTC || W.AgoraRTC_N;
    if (!client || !AgoraRTC) return;

    try {
      // Agora web SDK emits volume-indicator when enabled.
      if (typeof client.enableAudioVolumeIndicator === 'function') {
        client.enableAudioVolumeIndicator();
        client.on('volume-indicator', (evt) => {
          if (!evt || !Array.isArray(evt) || evt.length === 0) return;
          // Choose highest level among active streams.
          const candidates = evt
            .map((u) => ({ uid: u.uid, level: u.level }))
            .filter((x) => STATE.activeStreams.has(x.uid) && (STATE.activeStreams.get(x.uid).audioTrack || STATE.activeStreams.get(x.uid).videoTrack));

          if (candidates.length === 0) return;
          candidates.sort((a, b) => b.level - a.level);

          const loudest = candidates[0];
          const loudestUid = loudest.uid;

          const t = performance.now();
          if (loudest.level < 20) return; // ignore low levels

          if (STATE.activeSpeakerUid == null || String(STATE.activeSpeakerUid) !== String(loudestUid)) {
            const minOk = t - AGORA.lastActiveSpeakerTs >= CONFIG.activeSpeakerMinIntervalMs;
            if (!minOk) return;
            AGORA.lastActiveSpeakerTs = t;

            STATE.activeSpeakerUid = loudestUid;
            syncActiveSpeakerVisuals();
          }
        });
      }
    } catch {
      // Active speaker detection remains best-effort.
    }
  }

  function startControlWiring() {
    // Map ↔ Grid toggle: uses existing onclick hooks if present, but also supports manual binding.

    W.setView = setView;
    W.cycleView = function cycleView() {
      if (STATE.currentMode === 'map') setView('grid');
      else setView('map');
    };
    W.setLayout = function setLayout(layout) {
      const grid = DOM.grid;
      if (!grid) return;
      STATE.currentMode = grid.classList.contains('hidden') ? 'map' : 'grid';
      grid.className = 'video-grid';
      if (layout && layout !== 'auto') grid.classList.add('layout-' + layout);
      if (layout === 'auto') grid.classList.remove('layout-2x2', 'layout-3x3', 'layout-solo');
      showNotif(`GRID LAYOUT: ${(layout || 'auto').toUpperCase()}`, 'info');
    };

    W.startRecording = startRecording;
    W.stopRecording = stopRecording;
    W.takeSnapshot = takeSnapshot;
    W.muteAllFeeds = muteAllFeeds;
    W.unmuteAllFeeds = unmuteAllFeeds;
    W.triggerEmergencyLockdown = triggerEmergencyLockdown;
    W.cancelLockdown = cancelLockdown;
    W.toggleFullscreen = toggleFullscreen;

    // Emergency: also map to header button if it exists.
    if (DOM.btnEmergency) {
      DOM.btnEmergency.onclick = triggerEmergencyLockdown;
    }

    // Tile internal buttons
    wireTileButtons();
  }

  function startRecording() {
    if (STATE.recordingState) return;
    STATE.recordingState = true;

    if (DOM.btnStartRec) DOM.btnStartRec.disabled = true;
    if (DOM.btnStopRec) DOM.btnStopRec.disabled = false;

    if (DOM.recStatus) {
      DOM.recStatus.textContent = 'LIVE';
      DOM.recStatus.classList.add('rec-live');
    }

    const hudStatusTxt = $id('hudStatusTxt');
    if (hudStatusTxt) hudStatusTxt.textContent = 'RECORDING';
    const dot = $id('hudPanel')?.querySelector?.('.hud-dot');
    if (dot) dot.classList.add('rec-pulse');

    if (DOM.systemStatusText && DOM.systemStatusPill) {
      // leave systemStatus pill as-is unless in lockdown
    }

    showNotif('RECORDING STARTED — ALL FEEDS CAPTURED', 'warn');
    addSysLog('WARN', 'Recording session initiated');

    // Placeholder: no backend. We keep UI state only.
  }

  function stopRecording() {
    if (!STATE.recordingState) return;
    STATE.recordingState = false;

    if (DOM.btnStartRec) DOM.btnStartRec.disabled = false;
    if (DOM.btnStopRec) DOM.btnStopRec.disabled = true;

    if (DOM.recStatus) {
      DOM.recStatus.textContent = 'OFF';
      DOM.recStatus.classList.remove('rec-live');
    }

    const hudStatusTxt = $id('hudStatusTxt');
    if (hudStatusTxt) hudStatusTxt.textContent = 'STANDBY';
    const dot = $id('hudPanel')?.querySelector?.('.hud-dot');
    if (dot) dot.classList.remove('rec-pulse');

    showNotif('RECORDING STOPPED', 'ok');
    addSysLog('INFO', `Recording stopped @ ${nowIso()}`);
  }

  function takeSnapshot() {
    const flash = DOM.snapshotFlash;
    if (flash) {
      flash.classList.remove('hidden');
      setTimeout(() => flash.classList.add('hidden'), 400);
    }

    const tiles = Array.from(document.querySelectorAll('.video-tile'));
    let tile = null;
    if (STATE.selectedOfficerUid != null) {
      tile = document.getElementById(`tile-${STATE.selectedOfficerUid}`);
    }
    if (!tile) tile = tiles.length ? tiles[0] : null;

    const officerId = tile?.dataset?.officerId;
    showNotif(`SNAPSHOT CAPTURED — OFFICER ${officerId ?? 'N/A'}`, 'ok');
    addSysLog('OK', `Snapshot requested @ ${nowIso()} (target=${officerId ?? 'none'})`);
  }

  function muteAllFeeds() {
    STATE.isMutedAll = true;
    if (DOM.btnMuteAll) DOM.btnMuteAll.disabled = true;
    if (DOM.btnUnmuteAll) DOM.btnUnmuteAll.disabled = false;

    // Best-effort disable audio tracks if they exist
    for (const [uid, s] of STATE.activeStreams.entries()) {
      try {
        if (s.audioTrack && typeof s.audioTrack.setEnabled === 'function') s.audioTrack.setEnabled(false);
      } catch {}
      const officer = officerFromUid(uid);
      officer.mute = true;
      OFFICERS.set(String(uid), officer);
      updateTileMuteUI(uid, true);
    }

    applyMuteAllToTiles();

    showNotif('ALL FEEDS MUTED', 'warn');
    addSysLog('WARN', 'All audio feeds muted');
  }

  function unmuteAllFeeds() {
    STATE.isMutedAll = false;
    if (DOM.btnMuteAll) DOM.btnMuteAll.disabled = false;
    if (DOM.btnUnmuteAll) DOM.btnUnmuteAll.disabled = true;

    for (const [uid, s] of STATE.activeStreams.entries()) {
      try {
        if (s.audioTrack && typeof s.audioTrack.setEnabled === 'function') s.audioTrack.setEnabled(true);
      } catch {}
      const officer = officerFromUid(uid);
      officer.mute = false;
      OFFICERS.set(String(uid), officer);
      updateTileMuteUI(uid, false);
    }

    applyMuteAllToTiles();

    showNotif('ALL FEEDS UNMUTED', 'ok');
    addSysLog('INFO', 'All audio feeds restored');
  }

  let _lockdownInterval = null;
  let _lockdownCountdown = 10;

  function triggerEmergencyLockdown() {
    if (STATE.lockdownActive) return;
    STATE.lockdownActive = true;

    if (DOM.lockdownOverlay) DOM.lockdownOverlay.classList.remove('hidden');

    const cd = DOM.lockdownCountdown;
    _lockdownCountdown = 10;
    if (cd) cd.textContent = `CANCELLING IN: ${_lockdownCountdown}`;

    if (DOM.systemStatusText && DOM.systemStatusPill) {
      DOM.systemStatusText.textContent = 'LOCKDOWN';
      DOM.systemStatusPill.className = 'status-pill status-lockdown';
    }

    // Visual-only broadcast UI state change.
    showNotif('⚠ EMERGENCY LOCKDOWN INITIATED — 10 SECONDS', 'emergency');
    addSysLog('WARN', 'EMERGENCY LOCKDOWN TRIGGERED');

    if (_lockdownInterval) clearInterval(_lockdownInterval);
    _lockdownInterval = setInterval(() => {
      _lockdownCountdown -= 1;
      if (cd) cd.textContent = `CANCELLING IN: ${_lockdownCountdown}`;
      if (_lockdownCountdown <= 0) {
        clearInterval(_lockdownInterval);
        _lockdownInterval = null;
        executeLockdown();
      }
    }, 1000);
  }

  function cancelLockdown() {
    if (!STATE.lockdownActive) return;
    STATE.lockdownActive = false;
    if (_lockdownInterval) clearInterval(_lockdownInterval);
    _lockdownInterval = null;

    if (DOM.lockdownOverlay) DOM.lockdownOverlay.classList.add('hidden');
    showNotif('LOCKDOWN CANCELLED', 'ok');
    addSysLog('INFO', 'Lockdown sequence cancelled');

    if (DOM.systemStatusText && DOM.systemStatusPill) {
      DOM.systemStatusText.textContent = 'SYSTEM ACTIVE';
      DOM.systemStatusPill.className = 'status-pill status-live';
    }
  }

  function executeLockdown() {
    if (!STATE.lockdownActive) return;

    if (DOM.lockdownOverlay) DOM.lockdownOverlay.classList.add('hidden');

    if (DOM.systemStatusText && DOM.systemStatusPill) {
      DOM.systemStatusText.textContent = 'LOCKDOWN';
      DOM.systemStatusPill.className = 'status-pill status-lockdown';
    }

    showNotif('🔒 SYSTEM LOCKED DOWN — ALL FEEDS ENCRYPTED', 'emergency');
    addSysLog('WARN', 'SYSTEM LOCKDOWN EXECUTED');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  async function init() {
    if (AGORA.destroyed) return;
    ensureDomRefs();
    startControlWiring();

    if (!DOM.grid || !DOM.map) {
      // UI elements missing; nothing to do.
      return;
    }

    setView('map');
    updateFeedCountUI();

    // Seed officer roster with any known tiles if roster is empty.
    if (OFFICERS.size === 0) {
      // Pre-create placeholders from any existing roster cards if present.
      const cards = document.querySelectorAll('.officer-card');
      if (cards && cards.length) {
        cards.forEach((c) => {
          const id = c.id?.replace('officer-card-', '');
          if (!id) return;
          OFFICERS.set(String(id), {
            id,
            uid: id,
            name: c.querySelector('.officer-name')?.textContent?.trim() || `OFFICER-${String(id).slice(-4)}`,
            codename: c.querySelector('.officer-codename')?.textContent?.trim() || `COD${String(id).slice(-3)}`,
            channel: CONFIG.channel,
            videoTrack: null,
            mute: c.querySelector('.badge.muted-badge') ? true : false,
            status: c.classList.contains('online') ? 'online' : c.classList.contains('away') ? 'away' : 'offline',
          });
        });
      }
    }

    buildOfficerRoster();

    // Join Agora (production). If Agora not configured, UI stays in standby map mode.
    try {
      await joinChannel();
      startActiveSpeakerDetection();
    } catch (e) {
      ensureMapFallback('AGORA INIT FAILED — GRID STANDBY');
      addSysLog('ERROR', `Agora init error: ${String(e && e.message ? e.message : e)}`);
    }

    // Initial fallback based on streams
    if (STATE.activeStreams.size === 0) ensureMapFallback('TACTICAL SURVEILLANCE GRID ACTIVE – NO LIVE FEEDS');
    else ensureGridModeIfNeeded();
  }

  function cleanup() {
    AGORA.destroyed = true;

    try {
      if (AGORA.client) {
        AGORA.client.removeAllListeners && AGORA.client.removeAllListeners();
        if (typeof AGORA.client.leave === 'function') AGORA.client.leave().catch(() => {});
      }
    } catch {}

    for (const [, s] of STATE.activeStreams.entries()) {
      try { if (s.videoTrack && s.videoTrack.stop) s.videoTrack.stop(); } catch {}
      try { if (s.audioTrack && s.audioTrack.stop) s.audioTrack.stop(); } catch {}
    }
    STATE.activeStreams.clear();
    STATE.activeUsers = [];

    const tiles = document.querySelectorAll('.video-tile');
    tiles.forEach((t) => t.remove());

    STATE.activeSpeakerUid = null;
  }

  // Exported for SPA/router integration if needed.
  W.CadreSurveillance = {
    state: STATE,
    officers: OFFICERS,
    cleanup,
  };

  // Auto-init on load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();


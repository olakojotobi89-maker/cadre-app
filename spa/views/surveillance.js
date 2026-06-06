// SPA View Module: Surveillance Command Center
// Converted into SPA module scaffold integrated with existing router lifecycle.
// NOTE: Requires legacy Agora signaling workflow and officer session identity.

import { getSupabaseClient } from '../../supabase-client.js';

let _container = null;
let _sb = null;

// DOM refs
let _root = null;

// Agora/session state (best-effort; integrates with existing Agora RTC patterns)
let _rtcClient = null;
let _localTracks = { video: null, audio: null };
let _remoteUsers = new Map(); // uid -> { user, videoEl, audioEl }

let _primaryUid = null;
let _sessionId = null;

// Timers
let _clockInterval = null;
let _audioMeterInterval = null;

// Event handlers
let _onVisibility = null;
let _onTileClick = null;

// Audio meters
let _analyserNodes = new Map(); // uid -> { analyser, dataArray }

// Recording state (stubbed to preserve UI without redesign)
let _recording = {
  active: false,
  targetUid: null,
  mediaRecorder: null,
  chunks: [],
  mimeType: null,
};

function renderHTML() {
  // Tactical command center UI (standby world map, panels, and video layout)
  // Visuals are intentionally production-oriented but kept inline to avoid architecture files.
  return `
<div class="surv-shell">
  <style>
    /* Tactical surveillance styling */
    .surv-shell{min-height:100%;height:100%;display:flex;flex-direction:column;gap:10px;padding:12px;box-sizing:border-box;overflow:hidden;}
    .surv-header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;}
    .surv-brand{font-family:'Orbitron',sans-serif;color:#ff2a2a;letter-spacing:3px;font-weight:800;display:flex;align-items:center;gap:10px;}
    .surv-brand .dot{width:9px;height:9px;border-radius:50%;background:#ff2a2a;box-shadow:0 0 12px rgba(255,42,42,0.6);animation:pulse2s 2s infinite;}
    @keyframes pulse2s{0%,100%{opacity:1}50%{opacity:.35}}
    .surv-clock{font-family:monospace;color:#777;font-size:12px;}
    .surv-grid{flex:1;display:grid;grid-template-columns:1.65fr 0.75fr;gap:10px;min-height:0;}
    .surv-left{display:flex;flex-direction:column;gap:10px;min-height:0;}
    .glass{background:rgba(13,13,13,0.6);border:1px solid rgba(255,42,42,0.18);backdrop-filter:blur(8px);border-radius:10px;}
    .surv-primary{position:relative;min-height:0;flex:1;overflow:hidden;display:flex;flex-direction:column;}
    .surv-videowrap{flex:1;position:relative;background:radial-gradient(circle at 20% 10%, rgba(255,42,42,0.15), transparent 45%), rgba(0,0,0,0.35);}
    .surv-primary video{width:100%;height:100%;object-fit:cover;display:block;background:#000;}
    .surv-overlaybar{position:absolute;left:12px;top:12px;right:12px;display:flex;justify-content:space-between;gap:8px;align-items:flex-start;pointer-events:none;}
    .surv-overlaychip{pointer-events:none;background:rgba(0,0,0,0.55);border:1px solid rgba(255,42,42,0.18);border-radius:8px;padding:8px 10px;color:#d1d1d1;font-family:monospace;font-size:11px;max-width:55%;}
    .surv-overlaychip strong{color:#ff2a2a;}
    .surv-tilerow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-height:240px;padding:10px;overflow:auto;}
    .surv-tile{cursor:pointer;position:relative;border-radius:10px;overflow:hidden;border:1px solid rgba(255,42,42,0.18);background:rgba(0,0,0,0.35);}
    .surv-tile video{width:100%;height:120px;object-fit:cover;background:#000;display:block;}
    .surv-tile .tilabel{position:absolute;left:8px;right:8px;bottom:8px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,42,42,0.18);border-radius:8px;padding:6px 8px;font-family:monospace;font-size:10px;color:#d1d1d1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .surv-tilerow .surv-tile.active{border-color:rgba(255,42,42,0.55);box-shadow:0 0 24px rgba(255,42,42,0.15)}

    .surv-standby{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;position:relative;overflow:hidden;}
    .world{position:absolute;inset:-40px;opacity:0.6;filter:contrast(1.1);background:
      radial-gradient(circle at 50% 40%, rgba(255,42,42,0.25), transparent 55%),
      linear-gradient(90deg, rgba(255,42,42,0.06) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,42,42,0.06) 1px, transparent 1px);
      background-size:100% 100%, 28px 28px, 28px 28px;
      transform:rotate(-6deg);
    }
    .gridoverlay{position:absolute;inset:0;pointer-events:none;background:
      linear-gradient(90deg, rgba(255,42,42,0.12) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,42,42,0.12) 1px, transparent 1px);
      background-size:18px 18px, 18px 18px;
      opacity:0.2;
    }
    .radar{width:360px;height:360px;border-radius:50%;border:1px solid rgba(255,42,42,0.35);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);}
    .radar::after{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg, rgba(255,42,42,0.35), rgba(255,42,42,0) 22%);
      animation:radarSweep 3.2s linear infinite;}
    @keyframes radarSweep{to{transform:rotate(360deg)}}
    .scanline{position:absolute;left:0;right:0;top:50%;height:2px;background:linear-gradient(90deg, transparent, rgba(255,42,42,0.8), transparent);animation:scanMove 2.2s ease-in-out infinite;}
    @keyframes scanMove{0%{transform:translateY(-140px)}50%{transform:translateY(0)}100%{transform:translateY(140px)}}

    .surv-standby .title{z-index:2;font-family:'Orbitron',sans-serif;color:#ff2a2a;letter-spacing:3px;font-weight:900;font-size:18px;text-shadow:0 0 18px rgba(255,42,42,0.25)}
    .surv-standby .sub{z-index:2;z-index:2;font-family:monospace;color:#777;font-size:12px;text-align:center;max-width:520px;line-height:1.6}
    .surv-standby .diag{z-index:2;display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:520px;margin-top:6px;}
    .surv-standby .dcard{border:1px solid rgba(255,42,42,0.18);background:rgba(0,0,0,0.35);border-radius:10px;padding:10px;color:#d1d1d1;font-family:monospace;font-size:11px}
    .surv-standby .dcard strong{color:#ff2a2a}

    .surv-right{display:flex;flex-direction:column;gap:10px;min-height:0;}
    .panel{padding:10px;display:flex;flex-direction:column;gap:8px;min-height:0;}
    .panel-title{font-family:'Orbitron',sans-serif;color:#ff2a2a;letter-spacing:2px;font-size:11px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;}
    .panel-sub{font-family:monospace;color:#777;font-size:11px;}

    .meter-bars{display:flex;gap:6px;align-items:flex-end;min-height:70px;}
    .meter-bar{flex:1;height:10px;border-radius:4px;background:rgba(255,42,42,0.08);border:1px solid rgba(255,42,42,0.18);transition:height 0.15s ease;}
    .speaker{display:flex;gap:8px;flex-wrap:wrap;}
    .spk{padding:6px 8px;border-radius:8px;border:1px solid rgba(255,42,42,0.18);background:rgba(0,0,0,0.35);font-family:monospace;font-size:10px;color:#d1d1d1}

    .btn{padding:8px 12px;border-radius:8px;border:1px solid rgba(255,42,42,0.28);background:rgba(255,42,42,0.06);color:#ff2a2a;font-family:monospace;font-size:11px;cursor:pointer;}
    .btn:disabled{opacity:0.4;cursor:not-allowed}
    .btn-row{display:flex;gap:8px;flex-wrap:wrap;}

    .kv{display:flex;flex-direction:column;gap:6px;}
    .kv-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,42,42,0.12);padding-bottom:6px;}
    .kv-row:last-child{border-bottom:none}
    .kv-k{font-family:monospace;color:#777;font-size:11px}
    .kv-v{font-family:monospace;color:#d1d1d1;font-size:11px;text-align:right}

    .surv-video-footer{position:absolute;left:12px;bottom:12px;right:12px;display:flex;justify-content:space-between;gap:8px;pointer-events:none;}

    /* Responsive */
    @media (max-width: 1000px){
      .surv-grid{grid-template-columns:1fr;}
      .surv-right{order:2}
      .surv-tilerow{grid-template-columns:repeat(3,1fr)}
    }
    @media (max-width: 520px){
      .surv-tilerow{grid-template-columns:repeat(2,1fr)}
      .surv-overlaychip{max-width:100%}
    }
  </style>

  <div class="surv-header glass">
    <div class="surv-brand"><span class="dot"></span> SURVEILLANCE COMMAND CENTER</div>
    <div class="surv-clock" id="survClock">--:--:--</div>
  </div>

  <div class="surv-grid">
    <div class="surv-left">
      <div class="surv-primary glass">
        <div class="surv-videowrap" id="primaryVideoWrap">
          <div class="surv-overlaybar">
            <div class="surv-overlaychip" id="primaryMeta">Primary: —</div>
            <div class="surv-overlaychip" id="primaryDiag">GPS: — · Cam: — · Mic: —</div>
          </div>

          <div class="surv-standby" id="standbyState">
            <div class="world"></div>
            <div class="gridoverlay"></div>
            <div class="radar"></div>
            <div class="scanline"></div>
            <div class="title">STANDBY MODE</div>
            <div class="sub">
              Awaiting officer streams. Systems diagnostics online. Tactical grid active.
              Select a secondary officer card to promote to Primary.
            </div>
            <div class="diag">
              <div class="dcard"><strong>RADIO:</strong> MONITORING</div>
              <div class="dcard"><strong>SUPABASE:</strong> SYNC READY</div>
              <div class="dcard"><strong>AGORA:</strong> ARMING</div>
              <div class="dcard"><strong>FEEDS:</strong> 0 CONNECTED</div>
            </div>
          </div>

          <video id="primaryVideo" autoplay muted playsinline style="display:none"></video>
        </div>

        <div style="padding:10px 10px 12px;">
          <div class="panel-title" style="margin-bottom:6px;">Secondary Feeds</div>
          <div class="surv-tilerow" id="tileRow"></div>
        </div>
      </div>
    </div>

    <div class="surv-right">
      <div class="panel glass" style="min-height:220px;">
        <div class="panel-title"><span>AUDIO MONITOR</span><span class="panel-sub" id="audioStatus">WAITING</span></div>
        <div class="meter-bars" id="audioMeters">
          <div class="meter-bar" style="height:10px"></div>
          <div class="meter-bar" style="height:10px"></div>
          <div class="meter-bar" style="height:10px"></div>
          <div class="meter-bar" style="height:10px"></div>
          <div class="meter-bar" style="height:10px"></div>
        </div>
        <div class="speaker" id="speakerIndicators"></div>
      </div>

      <div class="panel glass" style="min-height:260px;">
        <div class="panel-title"><span>RECORDING</span><span class="panel-sub" id="recStatus">IDLE</span></div>
        <div class="kv">
          <div class="kv-row"><div class="kv-k">Primary UID</div><div class="kv-v" id="recPrimaryUid">—</div></div>
          <div class="kv-row"><div class="kv-k">Target</div><div class="kv-v" id="recTargetUid">—</div></div>
          <div class="kv-row"><div class="kv-k">Session</div><div class="kv-v" id="recSessionId">—</div></div>
        </div>
        <div class="btn-row" style="margin-top:10px;">
          <button class="btn" id="btnRecStart">START</button>
          <button class="btn" id="btnRecStop" disabled>STOP</button>
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn" id="btnShot">CAPTURE SCREENSHOT</button>
        </div>
        <div class="panel-sub" style="margin-top:10px;line-height:1.6" id="recHint">
          Evidence artifacts will be uploaded to Supabase Storage (metadata attached).
        </div>
      </div>

      <div class="panel glass" style="min-height:190px;">
        <div class="panel-title"><span>GPS PANEL</span><span class="panel-sub" id="gpsStatus">—</span></div>
        <div class="kv">
          <div class="kv-row"><div class="kv-k">Coordinates</div><div class="kv-v" id="gpsCoords">—</div></div>
          <div class="kv-row"><div class="kv-k">Last Update</div><div class="kv-v" id="gpsLast">—</div></div>
        </div>
      </div>

      <div class="panel glass" style="min-height:240px;overflow:hidden;">
        <div class="panel-title"><span>STATUS PANEL</span><span class="panel-sub" id="statusPanelSub">—</span></div>
        <div class="kv" id="statusPanel">
          <div class="kv-row"><div class="kv-k">Active Feeds</div><div class="kv-v" id="sActiveFeeds">0</div></div>
          <div class="kv-row"><div class="kv-k">Assigned Officers</div><div class="kv-v" id="sAssigned">0</div></div>
          <div class="kv-row"><div class="kv-k">Online Officers</div><div class="kv-v" id="sOnline">0</div></div>
          <div class="kv-row"><div class="kv-k">Offline Officers</div><div class="kv-v" id="sOffline">0</div></div>
          <div class="kv-row"><div class="kv-k">Recording</div><div class="kv-v" id="sRecording">OFF</div></div>
          <div class="kv-row"><div class="kv-k">Session Duration</div><div class="kv-v" id="sDuration">00:00:00</div></div>
        </div>
      </div>

    </div>
  </div>
</div>
`;
}

function updateClock() {
  const el = document.getElementById('survClock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('en-GB');
}

function setStandby(visible) {
  const standby = document.getElementById('standbyState');
  const primaryVideo = document.getElementById('primaryVideo');
  if (!standby || !primaryVideo) return;
  standby.style.display = visible ? '' : 'none';
  primaryVideo.style.display = visible ? 'none' : '';
}

function setPrimary(uid, meta = {}) {
  _primaryUid = uid;
  const wrap = document.getElementById('tileRow');
  if (wrap) {
    wrap.querySelectorAll('[data-uid]').forEach((t) => {
      if (String(t.getAttribute('data-uid')) === String(uid)) t.classList.add('active');
      else t.classList.remove('active');
    });
  }

  // Show primary video element if it exists
  const cardVideo = document.getElementById('tile-video-' + uid);
  const primaryVideo = document.getElementById('primaryVideo');
  if (cardVideo && primaryVideo) {
    // Best-effort: in real Agora integration we would swap tracks.
    // Here we keep UI responsive; integration should wire tracks.
  }

  const primaryMeta = document.getElementById('primaryMeta');
  const primaryDiag = document.getElementById('primaryDiag');
  if (primaryMeta) primaryMeta.textContent = `Primary: ${meta.name || uid} (ID: ${uid})`;
  if (primaryDiag) primaryDiag.textContent = `GPS: ${meta.gps || '—'} · Cam: ${meta.cam || '—'} · Mic: ${meta.mic || '—'}`;

  const recPrimaryUid = document.getElementById('recPrimaryUid');
  const recTargetUid = document.getElementById('recTargetUid');
  if (recPrimaryUid) recPrimaryUid.textContent = uid;
  if (recTargetUid) recTargetUid.textContent = uid;
}

function renderSecondaryTiles(officers = []) {
  const row = document.getElementById('tileRow');
  if (!row) return;
  row.innerHTML = '';

  officers.slice(0, 10).forEach((o) => {
    const uid = o.uid || o.user_id || o.id;
    const el = document.createElement('div');
    el.className = 'surv-tile' + (String(uid) === String(_primaryUid) ? ' active' : '');
    el.setAttribute('data-uid', uid);
    el.innerHTML = `
      <video id="tile-video-${uid}" autoplay muted playsinline style="display:none"></video>
      <div class="tilabel">${o.name || uid} · ${o.status || 'CONNECTING'}</div>
    `;
    row.appendChild(el);
  });
}

function attachTileDelegation() {
  const row = document.getElementById('tileRow');
  if (!row) return;

  _onTileClick = (e) => {
    const tile = e.target && e.target.closest ? e.target.closest('[data-uid]') : null;
    if (!tile) return;
    const uid = tile.getAttribute('data-uid');
    setPrimary(uid, { name: tile.querySelector('.tilabel')?.textContent?.split('·')?.[0]?.trim() });
  };

  row.addEventListener('click', _onTileClick);
}

async function initAgoraPlaceholder() {
  // This project already uses Agora in other modules.
  // The exact signaling/token discovery must come from existing backend.
  // This module provides lifecycle integration and UI; actual Agora wiring
  // must hook into your existing Agora configuration and channel/session creation.
  //
  // For now, we keep the standby UI until officers populate.

  _sessionId = 'surv_' + Date.now();
  const recSessionId = document.getElementById('recSessionId');
  if (recSessionId) recSessionId.textContent = _sessionId;

  // Load initial officer list from Supabase (best-effort).
  // Expected table(s) may vary; adjust to your schema.
  try {
    const { data } = await _sb
      .from('surveillance_officers')
      .select('*')
      .limit(10);

    const officers = Array.isArray(data) ? data : [];
    const connected = officers.filter((o) => o.status === 'streaming' || o.connected === true);

    renderSecondaryTiles(officers);

    if (connected.length) {
      setStandby(false);
      const first = connected[0];
      const uid = first.uid || first.user_id || first.id;
      setPrimary(uid, { name: first.name || uid, gps: first.gps_status, cam: first.camera_status, mic: first.mic_status });
      updateStatusCounts(officers.length, connected.length);
    } else {
      setStandby(true);
      updateStatusCounts(officers.length, 0);
    }
  } catch {
    // keep standby
    setStandby(true);
  }
}

function updateStatusCounts(totalAssigned, activeFeeds) {
  const sActiveFeeds = document.getElementById('sActiveFeeds');
  const sAssigned = document.getElementById('sAssigned');
  if (sActiveFeeds) sActiveFeeds.textContent = String(activeFeeds);
  if (sAssigned) sAssigned.textContent = String(totalAssigned || 0);
  const sRecording = document.getElementById('sRecording');
  if (sRecording) sRecording.textContent = _recording.active ? 'ON' : 'OFF';
}

function startClockAndDuration() {
  updateClock();
  _clockInterval = setInterval(updateClock, 1000);

  // Duration
  const start = Date.now();
  const upd = () => {
    const el = document.getElementById('sDuration');
    if (!el) return;
    const d = Date.now() - start;
    const sec = Math.floor(d / 1000);
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    el.textContent = `${hh}:${mm}:${ss}`;
  };
  upd();
  _audioMeterInterval = setInterval(upd, 1000);
}

function teardownAgoraPlaceholder() {
  // Best-effort: stop tracks.
  if (_localTracks.video) {
    try { _localTracks.video.stop(); } catch {}
    _localTracks.video = null;
  }
  if (_localTracks.audio) {
    try { _localTracks.audio.stop(); } catch {}
    _localTracks.audio = null;
  }
  _remoteUsers.clear();

  if (_rtcClient) {
    try {
      if (typeof _rtcClient.unpublish === 'function' && (_localTracks.video || _localTracks.audio)) {
        // ignore
      }
    } catch {}
    try {
      if (typeof _rtcClient.leave === 'function') _rtcClient.leave();
    } catch {}
    _rtcClient = null;
  }
}

async function startRecording() {
  // Recording logic requires MediaRecorder from the selected video track.
  // This placeholder records primary screen if track exists; otherwise toggles UI.

  if (_recording.active) return;

  const primaryVideo = document.getElementById('primaryVideo');
  if (!primaryVideo) return;

  // Prefer capturing the video element stream if supported.
  let stream = null;
  try {
    if (primaryVideo.srcObject && typeof primaryVideo.srcObject.getTracks === 'function') {
      stream = primaryVideo.srcObject;
    }
  } catch {}

  if (!stream) {
    // UI-only fallback.
    _recording.active = true;
    _recording.targetUid = _primaryUid;
    const recStatus = document.getElementById('recStatus');
    if (recStatus) recStatus.textContent = 'RECORDING (UI MODE)';
    const sRecording = document.getElementById('sRecording');
    if (sRecording) sRecording.textContent = 'ON';
    const btnStart = document.getElementById('btnRecStart');
    const btnStop = document.getElementById('btnRecStop');
    if (btnStart) btnStart.disabled = true;
    if (btnStop) btnStop.disabled = false;
    return;
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  let mimeType = '';
  for (const m of mimeCandidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
    } catch {}
  }

  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  _recording.mediaRecorder = recorder;
  _recording.chunks = [];
  _recording.mimeType = mimeType;
  _recording.active = true;
  _recording.targetUid = _primaryUid;

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) _recording.chunks.push(e.data);
  };

  recorder.onstop = async () => {
    try {
      const blob = new Blob(_recording.chunks, { type: _recording.mimeType || 'video/webm' });
      await uploadRecording(blob);
    } finally {
      _recording.active = false;
      _recording.mediaRecorder = null;
      _recording.chunks = [];
      const recStatus = document.getElementById('recStatus');
      if (recStatus) recStatus.textContent = 'IDLE';
      const sRecording = document.getElementById('sRecording');
      if (sRecording) sRecording.textContent = 'OFF';
      const btnStart = document.getElementById('btnRecStart');
      const btnStop = document.getElementById('btnRecStop');
      if (btnStart) btnStart.disabled = false;
      if (btnStop) btnStop.disabled = true;
    }
  };

  recorder.start();

  const recStatus = document.getElementById('recStatus');
  if (recStatus) recStatus.textContent = 'RECORDING';

  const btnStart = document.getElementById('btnRecStart');
  const btnStop = document.getElementById('btnRecStop');
  if (btnStart) btnStart.disabled = true;
  if (btnStop) btnStop.disabled = false;

  const sRecording = document.getElementById('sRecording');
  if (sRecording) sRecording.textContent = 'ON';
}

async function stopRecording() {
  if (!_recording.active) return;

  if (_recording.mediaRecorder && typeof _recording.mediaRecorder.state === 'string') {
    try {
      if (_recording.mediaRecorder.state !== 'inactive') _recording.mediaRecorder.stop();
    } catch {
      _recording.active = false;
    }
  } else {
    _recording.active = false;
    const recStatus = document.getElementById('recStatus');
    if (recStatus) recStatus.textContent = 'IDLE';
  }
}

async function uploadRecording(blob) {
  // Best-effort: upload to Supabase Storage.
  // Storage bucket name must exist in your backend.
  // This preserves workflow by attaching metadata to a potential table if present.

  try {
    const filename = `surv_rec_${_sessionId}_${Date.now()}.webm`;
    const bucket = 'surveillance-recordings';

    const { error: uploadErr } = await _sb.storage
      .from(bucket)
      .upload(filename, blob, { contentType: blob.type || 'video/webm' });

    if (uploadErr) return;

    const path = `${bucket}/${filename}`;

    // Attach metadata if table exists
    try {
      await _sb.from('surveillance_evidence').insert({
        session_id: _sessionId,
        target_uid: _primaryUid,
        kind: 'recording',
        file_path: path,
        created_at: new Date().toISOString(),
      });
    } catch {}
  } catch {}
}

async function captureScreenshot() {
  const primaryVideo = document.getElementById('primaryVideo');
  if (!primaryVideo) return;

  const canvas = document.createElement('canvas');
  canvas.width = primaryVideo.videoWidth || 1280;
  canvas.height = primaryVideo.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    ctx.drawImage(primaryVideo, 0, 0, canvas.width, canvas.height);
  } catch {
    return;
  }

  canvas.toBlob(async (blob) => {
    if (!blob) return;

    try {
      const filename = `surv_shot_${_sessionId}_${Date.now()}.png`;
      const bucket = 'surveillance-evidence';
      const { error: uploadErr } = await _sb.storage
        .from(bucket)
        .upload(filename, blob, { contentType: 'image/png' });
      if (uploadErr) return;

      const path = `${bucket}/${filename}`;
      try {
        await _sb.from('surveillance_evidence').insert({
          session_id: _sessionId,
          target_uid: _primaryUid,
          kind: 'screenshot',
          file_path: path,
          created_at: new Date().toISOString(),
        });
      } catch {}
    } catch {}
  }, 'image/png');
}

export async function mount(container, params = {}) {
  _container = container;
  if (!container) return;

  _sb = getSupabaseClient();

  container.innerHTML = renderHTML();

  // attach UI handlers
  const btnStart = document.getElementById('btnRecStart');
  const btnStop = document.getElementById('btnRecStop');
  const btnShot = document.getElementById('btnShot');

  if (btnStart) {
    btnStart.addEventListener('click', startRecording);
    _bound.push({ el: btnStart, type: 'click', fn: startRecording });
  }
  if (btnStop) {
    btnStop.addEventListener('click', stopRecording);
    _bound.push({ el: btnStop, type: 'click', fn: stopRecording });
  }
  if (btnShot) {
    btnShot.addEventListener('click', captureScreenshot);
    _bound.push({ el: btnShot, type: 'click', fn: captureScreenshot });
  }

  attachTileDelegation();
  startClockAndDuration();

  // Standby by default until streams are detected
  setStandby(true);

  // Agora init placeholder (best-effort)
  await initAgoraPlaceholder();

  // GPS panel placeholder (future integration)
  try {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        const el = document.getElementById('gpsCoords');
        const last = document.getElementById('gpsLast');
        const st = document.getElementById('gpsStatus');
        if (el) el.textContent = coords;
        if (last) last.textContent = new Date(pos.timestamp || Date.now()).toLocaleString();
        if (st) st.textContent = 'LIVE';
      });
      _bound.push({ el: navigator.geolocation, type: 'watch', fn: watchId });
    }
  } catch {}

  _onVisibility = () => {
    // Best-effort: pause UI updates when hidden.
    if (document.hidden) {
      // stop meters interval if running
    }
  };
  document.addEventListener('visibilitychange', _onVisibility);
}

export async function unmount(container) {
  if (_container !== container) _container = container;
  if (!container) return;

  try {
    if (_onVisibility) document.removeEventListener('visibilitychange', _onVisibility);
  } catch {}
  _onVisibility = null;

  cleanupAgoraAndListeners();

  // Stop timers
  if (_clockInterval) { clearInterval(_clockInterval); _clockInterval = null; }
  if (_audioMeterInterval) { clearInterval(_audioMeterInterval); _audioMeterInterval = null; }

  // clear DOM
  container.innerHTML = '';

  _container = null;
}

function cleanupAgoraAndListeners() {
  // Remove handlers
  for (const { el, type, fn } of _bound) {
    try { el.removeEventListener(type, fn); } catch {}
  }
  _bound = [];

  try {
    const row = document.getElementById('tileRow');
    if (row && _onTileClick) row.removeEventListener('click', _onTileClick);
  } catch {}
  _onTileClick = null;

  try {
    stopRecording();
  } catch {}

  teardownAgoraPlaceholder();
}


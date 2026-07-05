// SPA View Module: Emergency (migrated from emergency.html)
// Converts legacy DOM + inline scripts into an SPA view module.

import { getSupabaseClient } from '../../supabase-client.js';

let _container = null;

let _sbClient = null;
let _currentUser = null;
let _isAlertActive = false;
let _watchId = null;
let _micIntervalId = null;

// realtime
let _distressChannel = null;

// handlers
let _onSosClick = null;
let _onDocKeydown = null;

// timers
let _timeouts = new Set();
let _intervals = new Set();

function tryParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function routerNavigate(hashOrPath) {
  if (window.router?.navigate) window.router.navigate(hashOrPath);
  else if (hashOrPath.startsWith('#')) window.location.hash = hashOrPath;
  else window.location.hash = '#' + hashOrPath;
}

function clearAllTimers() {
  for (const t of _timeouts) clearTimeout(t);
  for (const i of _intervals) clearInterval(i);
  _timeouts.clear();
  _intervals.clear();
}

function logToConsole(message, statusClass) {
  statusClass = statusClass || '';
  const box = document.getElementById('console-logs');
  if (!box) return;

  const line = document.createElement('div');
  line.className = 'telemetry-line';
  const label = statusClass ? statusClass.replace('status-', '').toUpperCase() : '';
  line.innerHTML = '<span>> ' + message + '</span><span class="' + statusClass + '">' + label + '</span>';
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function stopLocationWatch() {
  if (_watchId !== null) {
    try {
      navigator.geolocation.clearWatch(_watchId);
    } catch {}
    _watchId = null;
  }
}

function stopMicInterval() {
  if (_micIntervalId) {
    clearInterval(_micIntervalId);
    _micIntervalId = null;
  }
}

function trackLiveLocation() {
  if (!navigator.geolocation) {
    logToConsole('GEOLOCATION UNAVAILABLE', 'status-active');
    return;
  }

  _watchId = navigator.geolocation.watchPosition(
    async function (position) {
      const lat = position.coords.latitude.toFixed(5);
      const lng = position.coords.longitude.toFixed(5);
      logToConsole('COORD LOCK: ' + lat + ', ' + lng, 'status-resolved');

      const updateBase = { lat: lat, lng: lng };
      const updateWithTs = Object.assign({}, updateBase, {
        last_telemetry_timestamp: new Date().toISOString(),
      });

      const { error: errTs } = await _sbClient
        .from('distress_signals')
        .update(updateWithTs)
        .eq('user_id', _currentUser.id);

      if (errTs && errTs.code === 'PGRST204') {
        await _sbClient.from('distress_signals').update(updateBase).eq('user_id', _currentUser.id);
      }
    },
    function (err) {
      logToConsole('GEO ERROR: ' + err.message, 'status-active');
    },
    { enableHighAccuracy: true }
  );
}

async function checkActiveStatus(userId) {
  const { data, error } = await _sbClient
    .from('distress_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  if (error) {
    logToConsole('DB CHECK ERROR: ' + error.message, 'status-error');
    return;
  }

  if (data && data.length > 0) {
    _isAlertActive = true;
    document.getElementById('sos-container').classList.add('active-alert');
    document.getElementById('action-btn').textContent = 'STAND DOWN';
    logToConsole('RESUMING ACTIVE DISTRESS SESSION', 'status-critical');
    trackLiveLocation();

    if (window.CADRE_SOS_AUDIO?.startStreaming) window.CADRE_SOS_AUDIO.startStreaming();
  }
}

async function initiateDistressProtocol() {
  const btn = document.getElementById('action-btn');
  btn.disabled = true;

  if (window.CADRE && window.CADRE.ai) {
    const confirmed = await CADRE.ai.sos.confirm();
    if (!confirmed) {
      logToConsole('SOS CANCELLED BY OPERATOR', 'status-active');
      CADRE.ai.sos.cancelled();
      btn.disabled = false;
      return;
    }
  }

  logToConsole('SOS SIGNAL INITIATED — BROADCASTING...', 'status-critical');

  await _sbClient.from('distress_signals').delete().eq('user_id', _currentUser.id);

  const payload = {
    user_id: _currentUser.id,
    officer_name: _currentUser.name || 'UNKNOWN',
    officer_rank: _currentUser.rank || 'UNIT',
    officer_email: _currentUser.email || '',
    active: true,
    lat: null,
    lng: null,
  };

  const payloadWithTs = Object.assign({}, payload, {
    initiated_at: new Date().toISOString(),
    last_telemetry_timestamp: new Date().toISOString(),
  });

  let insertError = null;
  const { error: errWithTs } = await _sbClient.from('distress_signals').insert(payloadWithTs);

  if (errWithTs && errWithTs.code === 'PGRST204') {
    logToConsole('TIMESTAMP COLS MISSING — USING SAFE PAYLOAD', 'status-active');
    const { error: errSafe } = await _sbClient.from('distress_signals').insert(payload);
    insertError = errSafe;
  } else {
    insertError = errWithTs;
  }

  if (insertError) {
    logToConsole('BROADCAST FAILED: ' + insertError.message + ' (' + insertError.code + ')', 'status-error');
    btn.disabled = false;
    return;
  }

  if (window.CADRE && window.CADRE.ai) CADRE.ai.sos.activated();

  _isAlertActive = true;
  btn.disabled = false;
  btn.textContent = 'STAND DOWN';

  document.getElementById('sos-container').classList.add('active-alert');

  logToConsole('DISTRESS SIGNAL BROADCAST CONFIRMED', 'status-critical');
  logToConsole('COMMAND CENTER NOTIFIED', 'status-resolved');

  trackLiveLocation();

  if (window.CADRE_SOS_AUDIO?.startStreaming) window.CADRE_SOS_AUDIO.startStreaming();
}

async function requestSecureDeactivation() {
  const confirmed = confirm('STAND DOWN DISTRESS BEACON?\n\nPress OK to confirm you are safe.');
  if (!confirmed) return;

  logToConsole('STAND DOWN CONFIRMED — DEACTIVATING...', 'status-active');
  if (window.CADRE && window.CADRE.ai) CADRE.ai.sos.cancelled();

  _isAlertActive = false;

  stopLocationWatch();
  stopMicInterval();

  if (window.CADRE_SOS_AUDIO?.stopStreaming) window.CADRE_SOS_AUDIO.stopStreaming();

  const { error } = await _sbClient.from('distress_signals').delete().eq('user_id', _currentUser.id);
  if (error) logToConsole('STAND DOWN SYNC ERROR: ' + error.message, 'status-error');

  document.getElementById('sos-container').classList.remove('active-alert');
  document.getElementById('panic-panel')?.classList.add('status-safe');
  document.getElementById('action-btn').textContent = 'SECURED';
  document.getElementById('beacon-headline').textContent = 'SITUATION SECURED';

  logToConsole('BEACON DEACTIVATED — STAND DOWN CONFIRMED', 'status-resolved');
}

function handleSosInteraction() {
  if (!_currentUser) {
    logToConsole('SESSION NOT READY — PLEASE WAIT', 'status-error');
    return;
  }
  if (!_isAlertActive) initiateDistressProtocol();
  else requestSecureDeactivation();
}

function renderHTML() {
  // Preserve markup & inline styles/scripts from emergency.html.
  // Inline module scripts are re-injected as needed (CADRE_SOS_AUDIO included below).
  return `
<div class="app-container">
    <main class="emergency-wrapper">
        <div class="panic-card" id="panic-panel">
            <div class="gateway-title-block">
                <h1 class="gateway-h1" id="beacon-headline" style="color:var(--hud-crimson);">DISTRESS TRANSMITTER</h1>
                <p class="gateway-p" id="beacon-subline">Emergency Command Beacon Network</p>
            </div>
            <div class="sos-trigger-container" id="sos-container">
                <div class="sos-pulse-wave sos-pulse-wave-1"></div>
                <div class="sos-pulse-wave sos-pulse-wave-2"></div>
                <button type="button" class="btn-sos-trigger" id="action-btn">SOS</button>
            </div>
            <div id="sos-audio-status">
                <span class="audio-dot"></span>
                AUDIO STREAM TRANSMITTING TO COMMAND
            </div>
            <div class="telemetry-console" id="console-logs">
                <div class="telemetry-line">
                    <span>> BEACON STATUS:</span>
                    <span style="color:var(--hud-emerald);">STANDBY</span>
                </div>
                <div class="telemetry-line">
                    <span>> LOCAL TELEMETRY:</span>
                    <span>COORD LOCK VACANT</span>
                </div>
            </div>
            <div class="back-nav">
                <a href="home.html" style="color:#64748b;text-decoration:none;">← Abort &amp; Return to Feed</a>
            </div>
        </div>
    </main>
    <nav class="app-bottom-dock">
        <a href="home.html"      class="dock-node"><span class="dock-node-glyph">🏠</span><span>Feed</span></a>
        <a href="ebook.html"     class="dock-node"><span class="dock-node-glyph">📖</span><span>eBook</span></a>
        <a href="profile.html"   class="dock-node"><span class="dock-node-glyph">👤</span><span>Profile</span></a>
        <a href="emergency.html" class="dock-node dock-node-emergency active-node"><span class="dock-node-glyph">🚨</span><span>SOS</span></a>
    </nav>
</div>
`;
}

function injectCadreSosAudioModule() {
  // Reuse legacy CADRE_SOS_AUDIO implementation exactly.
  // It uses a separate Supabase client internally; we are preserving behavior.
  // (Your page already did this.)

  // Avoid duplicate injection
  if (window.CADRE_SOS_AUDIO?.init && window.CADRE_SOS_AUDIO?.startStreaming) return;

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.text = `
(function() {
    'use strict';

    const _SB_URL = 'https://ihroattnnnsckvvbosfz.supabase.co';
    const _SB_KEY = 'sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX';
    /* Use a fresh Supabase client so broadcast routing is independent */
    const _sb = supabase.createClient(_SB_URL, _SB_KEY);

    let _officerId    = null;
    let _officerName  = null;
    let _sessionId    = null;
    let _localStream  = null;
    let _peerConns    = {};       /* adminId → RTCPeerConnection */
    let _sigChannel   = null;     /* 'sos_sig_<officerId>'  — offer/answer/ICE */
    let _annChannel   = null;     /* 'sos_announcements'    — presence beacon  */
    let _heartbeatId  = null;     /* re-announce timer                         */
    let _streaming    = false;
    let _statusEl     = null;

    const _ICE = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    window.CADRE_SOS_AUDIO = {
        init:           _init,
        startStreaming: _startStreaming,
        stopStreaming:  _stopStreaming
    };

    /* ── init ── */
    function _init(officerId, officerName) {
        _officerId  = officerId;
        _officerName = officerName;
        _statusEl   = document.getElementById('sos-audio-status');
        console.log('[SOS_AUDIO] init — officer:', officerName, officerId);
    }

    /* ── startStreaming ── */
    async function _startStreaming() {
        if (_streaming) return;
        _streaming = true;
        _sessionId = _officerId + '_' + Date.now();
        console.log('[SOS_AUDIO] startStreaming — session:', _sessionId);

        /* 1 ── Capture mic */
        try {
            _localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
                video: false
            });
            console.log('[SOS_AUDIO] mic captured');
        } catch (err) {
            console.error('[SOS_AUDIO] mic capture FAILED:', err);
            _streaming = false;
            return;
        }

        /* 2 ── Open signaling channel (receives admin_join, admin_answer, admin_ice) */
        _sigChannel = _sb.channel('sos_sig_' + _officerId, {
            config: { broadcast: { ack: false } }
        });

        _sigChannel
            .on('broadcast', { event: 'admin_join' }, async function(msg) {
                const adminId = (msg.payload || {}).adminId;
                if (!adminId) return;
                console.log('[SOS_AUDIO] admin_join from:', adminId);
                await _createOfferForAdmin(adminId);
            })
            .on('broadcast', { event: 'admin_answer' }, async function(msg) {
                const { adminId, sdp } = msg.payload || {};
                if (!adminId || !sdp) return;
                const pc = _peerConns[adminId];
                if (!pc) return;
                console.log('[SOS_AUDIO] admin_answer from:', adminId);
                try { await pc.setRemoteDescription({ type: 'answer', sdp }); }
                catch(e) { console.warn('[SOS_AUDIO] setRemoteDescription err:', e); }
            })
            .on('broadcast', { event: 'admin_ice' }, async function(msg) {
                const { adminId, candidate } = msg.payload || {};
                if (!adminId || !candidate) return;
                const pc = _peerConns[adminId];
                if (!pc) return;
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
            });

        await new Promise(function(resolve) {
            _sigChannel.subscribe(function(status) {
                console.log('[SOS_AUDIO] sigChannel status:', status);
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        /* 3 ── Open announcement channel and start heartbeat */
        await _openAnnouncementChannel();
    }

    /* ── open announcement channel + heartbeat ── */
    async function _openAnnouncementChannel() {
        _annChannel = _sb.channel('sos_announcements', {
            config: { broadcast: { self: false } }
        });

        await new Promise(function(resolve) {
            _annChannel.subscribe(function(status) {
                console.log('[SOS_AUDIO] annChannel status:', status);
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        /* Send first announcement immediately */
        await _sendAnnouncement();
        _showStreamingStatus(true);

        /* Re-announce every 8 seconds so late-opening admin pages catch it */
        _heartbeatId = setInterval(_sendAnnouncement, 8000);
    }

    async function _sendAnnouncement() {
        if (!_annChannel || !_streaming) return;
        try {
            await _annChannel.send({
                type: 'broadcast', event: 'sos_announce',
                payload: {
                    officerId:   _officerId,
                    officerName: _officerName,
                    sessionId:   _sessionId,
                    timestamp:   new Date().toISOString()
                }
            });
            console.log('[SOS_AUDIO] announcement sent');
        } catch(e) { console.warn('[SOS_AUDIO] announcement send err:', e); }
    }

    /* ── create WebRTC offer for one admin ── */
    async function _createOfferForAdmin(adminId) {
        /* Close stale connection */
        if (_peerConns[adminId]) {
            try { _peerConns[adminId].close(); } catch(e) {}
            delete _peerConns[adminId];
        }

        const pc = new RTCPeerConnection(_ICE);
        _peerConns[adminId] = pc;

        _localStream.getTracks().forEach(function(t) { pc.addTrack(t, _localStream); });

        pc.onicecandidate = async function(evt) {
            if (!evt.candidate || !_sigChannel) return;
            try {
                await _sigChannel.send({
                    type: 'broadcast', event: 'officer_ice',
                    payload: { officerId: _officerId, adminId, candidate: evt.candidate.toJSON() }
                });
            } catch(e) {}
        };

        pc.onconnectionstatechange = function() {
            console.log('[SOS_AUDIO] peer state → ' + pc.connectionState + ' (admin:' + adminId + ')');
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await _sigChannel.send({
            type: 'broadcast', event: 'officer_offer',
            payload: {
                officerId:   _officerId,
                officerName: _officerName,
                sessionId:   _sessionId,
                adminId,
                sdp: offer.sdp
            }
        });
        console.log('[SOS_AUDIO] offer sent to admin:', adminId);
    }

    /* ── stopStreaming ── */
    function _stopStreaming() {
        if (!_streaming) return;
        _streaming = false;

        /* Cancel heartbeat */
        if (_heartbeatId) { clearInterval(_heartbeatId); _heartbeatId = null; }

        /* Notify command stream is over */
        if (_annChannel) {
            _annChannel.send({
                type: 'broadcast', event: 'sos_ended',
                payload: { officerId: _officerId, sessionId: _sessionId }
            }).catch(function(){}).finally(function() {
                _annChannel.unsubscribe(); _annChannel = null;
            });
        }
        if (_sigChannel) { _sigChannel.unsubscribe(); _sigChannel = null; }

        /* Close all peer connections */
        Object.values(_peerConns).forEach(function(pc) { try { pc.close(); } catch(e) {} });
        _peerConns = {};

        /* Stop mic */
        if (_localStream) {
            _localStream.getTracks().forEach(function(t) { t.stop(); });
            _localStream = null;
        }

        _showStreamingStatus(false);
        console.log('[SOS_AUDIO] stream stopped');
    }

    function _showStreamingStatus(active) {
        if (!_statusEl) return;
        if (active) { _statusEl.classList.add('streaming'); }
        else        { _statusEl.classList.remove('streaming'); }
    }

})();
`;

  document.body.appendChild(script);
}

function normalizeNavigationClicks() {
  _onDocKeydown = function (e) {
    // no special keys required; left for parity
    void e;
  };
  document.addEventListener('keydown', _onDocKeydown);

  _container.__emergencyNavClickHandler = (e) => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (!href.endsWith('.html')) return;

    e.preventDefault();

    const map = {
      'home.html': '/home',
      'ebook.html': '/ebook',
    

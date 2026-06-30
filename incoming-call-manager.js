/* ============================================================
   INCOMING-CALL-MANAGER.JS — CADRE Global Incoming Call System
   v1.0

   HOW TO USE: Add this ONE script tag to every page in your app.
   It is completely self-contained and will:
     • Skip itself silently on groupcall.html (that page manages itself)
     • Listen for call_invite broadcasts from Supabase realtime
     • Show a non-blocking incoming call popup + play the ringtone
     • Navigate to groupcall.html when the user answers
     • Stop everything when the user declines or the caller cancels

   <script src="incoming-call-manager.js"></script>
   ============================================================ */

(function () {
  'use strict';

  /* ── GUARD: Skip on groupcall.html ───────────────────────────
     groupcall.js manages its own incoming-call logic on that page.
     We detect the page by the presence of the participant grid.   */
  if (document.getElementById('participant-grid')) return;

  /* ── CONFIG ──────────────────────────────────────────────── */
  const SUPABASE_URL    = 'https://ihroattnnnsckvvbosfz.supabase.co';
  const SUPABASE_KEY    = 'sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX';
  const GROUPCALL_PAGE  = 'groupcall.html';
  const RINGTONE_SRC    = 'Hip-hop_Alarm.mp3';
  const ICM_OVERLAY_ID  = 'cadre-icm-overlay';

  /* ── STATE ───────────────────────────────────────────────── */
  let sbClient        = null;   // Supabase client instance
  let realtimeChannel = null;   // active broadcast subscription
  let ringtoneAudio   = null;   // Audio element for ringtone
  let audioUnlocked   = false;  // Whether autoplay policy is satisfied
  let activeCallId    = null;   // ID of the call currently ringing

  /* ── READ CURRENT USER ───────────────────────────────────────
     Loaded from localStorage — populated by your auth system.
     Incoming calls addressed to this exact phone are not shown
     (that would mean this device IS the caller).                  */
  const currentUser = (() => {
    try {
      const s = JSON.parse(localStorage.getItem('session_user'));
      if (s && s.name) return s;
    } catch (_) {}
    return { name: null, phone: '__unknown__', avatar_url: null };
  })();

  /* ══════════════════════════════════════════════════════════
     STEP 1: ENSURE SUPABASE IS LOADED, THEN BOOT
     ══════════════════════════════════════════════════════════ */
  function boot() {
    buildOverlay();
    buildAudio();
    initSupabase();
  }

  /* ══════════════════════════════════════════════════════════
     STEP 2: INJECT OVERLAY HTML INTO DOM
     Appended to <body> once; toggled show/hide via .active class.
     ══════════════════════════════════════════════════════════ */
  function buildOverlay() {
    if (document.getElementById(ICM_OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = ICM_OVERLAY_ID;

    // Styles are injected inline so the script works on any page
    // without requiring an external stylesheet.
    overlay.innerHTML = `
      <style>
        #cadre-icm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(11,17,32,0.97);
          backdrop-filter: blur(14px);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 22px;
          z-index: 2147483647; /* max z-index — sits above everything */
          font-family: Arial, sans-serif;
          color: white;
        }
        #cadre-icm-overlay.active { display: flex; }

        #cadre-icm-label {
          font-size: 12px;
          color: #94a3b8;
          letter-spacing: 3px;
          text-transform: uppercase;
        }
        #cadre-icm-avatar {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid #00f0ff;
          box-shadow: 0 0 40px rgba(0,240,255,0.5);
          animation: cadreIcmPulse 1.2s ease-in-out infinite;
        }
        @keyframes cadreIcmPulse {
          0%,100% { box-shadow: 0 0 30px rgba(0,240,255,0.4); }
          50%      { box-shadow: 0 0 70px rgba(0,240,255,1); }
        }
        #cadre-icm-caller-name {
          font-size: 22px;
          font-weight: bold;
        }
        #cadre-icm-call-type {
          font-size: 13px;
          color: #94a3b8;
        }
        .cadre-icm-actions {
          display: flex;
          gap: 48px;
          margin-top: 8px;
        }
        .cadre-icm-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .cadre-icm-action span {
          font-size: 11px;
          color: #94a3b8;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .cadre-icm-answer {
          width: 74px; height: 74px;
          border-radius: 50%;
          border: none;
          background: #10b981;
          color: white;
          font-size: 28px;
          cursor: pointer;
          box-shadow: 0 0 24px rgba(16,185,129,0.6);
          transition: transform .2s, box-shadow .2s;
        }
        .cadre-icm-answer:hover {
          transform: scale(1.12);
          box-shadow: 0 0 38px rgba(16,185,129,0.9);
        }
        .cadre-icm-decline {
          width: 74px; height: 74px;
          border-radius: 50%;
          border: none;
          background: #dc2626;
          color: white;
          font-size: 28px;
          cursor: pointer;
          box-shadow: 0 0 24px rgba(220,38,38,0.6);
          transition: transform .2s, box-shadow .2s;
        }
        .cadre-icm-decline:hover {
          transform: scale(1.12);
          box-shadow: 0 0 38px rgba(220,38,38,0.9);
        }
        #cadre-icm-participants {
          font-size: 12px;
          color: #64748b;
        }
      </style>

      <div id="cadre-icm-label">INCOMING GROUP CALL</div>

      <img
        id="cadre-icm-avatar"
        src="https://ui-avatars.com/api/?name=GROUP+CALL&background=0f172a&color=00f0ff"
        alt="Caller"
      >

      <div id="cadre-icm-caller-name">GROUP_CALL_ALPHA</div>
      <div id="cadre-icm-call-type">Secure Group Channel</div>
      <div id="cadre-icm-participants"></div>

      <div class="cadre-icm-actions">
        <div class="cadre-icm-action">
          <button class="cadre-icm-answer" id="cadre-icm-answer-btn">📞</button>
          <span>Answer</span>
        </div>
        <div class="cadre-icm-action">
          <button class="cadre-icm-decline" id="cadre-icm-decline-btn">📵</button>
          <span>Decline</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire up buttons AFTER insertion
    document.getElementById('cadre-icm-answer-btn').addEventListener('click', onAnswer);
    document.getElementById('cadre-icm-decline-btn').addEventListener('click', onDecline);
  }

  /* ══════════════════════════════════════════════════════════
     STEP 3: CREATE AUDIO ELEMENT FOR RINGTONE
     ══════════════════════════════════════════════════════════ */
  function buildAudio() {
    ringtoneAudio = new Audio(RINGTONE_SRC);
    ringtoneAudio.loop = true;
    ringtoneAudio.preload = 'auto';

    // Unlock audio on first user interaction (autoplay policy)
    function unlockAudio() {
      if (audioUnlocked) return;
      ringtoneAudio.volume = 0;
      ringtoneAudio.play().then(() => {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
        ringtoneAudio.volume = 1;
        audioUnlocked = true;
      }).catch(() => {});
    }

    document.addEventListener('click',    unlockAudio, { once: true });
    document.addEventListener('touchend', unlockAudio, { once: true });
    document.addEventListener('keydown',  unlockAudio, { once: true });
  }

  /* ══════════════════════════════════════════════════════════
     STEP 4: INIT SUPABASE + SUBSCRIBE TO REALTIME
     ══════════════════════════════════════════════════════════ */
  function initSupabase() {
    // Reuse window.supabase if already loaded by the host page
    const factory = window.supabase;

    if (!factory) {
      // Supabase not loaded yet — inject CDN script and retry
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = initSupabase;
      document.head.appendChild(script);
      return;
    }

    sbClient = factory.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Subscribe to the same broadcast channel as groupcall.js
    realtimeChannel = sbClient.channel('cadre_comms', {
      config: { broadcast: { self: false } },
    });

    // ── Incoming call from another operator ──────────────────
    realtimeChannel.on('broadcast', { event: 'call_invite' }, ({ payload }) => {
      // Never ring for the person who placed the call
      if (payload.callerPhone && payload.callerPhone === currentUser.phone) return;

      // If call is already showing, ignore duplicates
      if (activeCallId === payload.callId) return;

      activeCallId = payload.callId || Date.now();
      showOverlay(payload);
    });

    // ── Caller cancelled before anyone answered ──────────────
    realtimeChannel.on('broadcast', { event: 'call_cancelled' }, ({ payload }) => {
      if (activeCallId && (!payload.callId || payload.callId === activeCallId)) {
        hideOverlay();
      }
    });

    // ── Host ended an active call (for pages that listen) ────
    realtimeChannel.on('broadcast', { event: 'call_host_ended' }, () => {
      hideOverlay();
    });

    realtimeChannel.subscribe();
  }

  /* ══════════════════════════════════════════════════════════
     SHOW / HIDE OVERLAY
     ══════════════════════════════════════════════════════════ */
  function showOverlay(payload) {
    const overlay      = document.getElementById(ICM_OVERLAY_ID);
    const nameEl       = document.getElementById('cadre-icm-caller-name');
    const avatarEl     = document.getElementById('cadre-icm-avatar');
    const typeEl       = document.getElementById('cadre-icm-call-type');
    const participantsEl = document.getElementById('cadre-icm-participants');

    if (!overlay) return;

    // Populate with caller's real profile from the payload
    const callerName   = payload.callerName   || 'CADRE OPERATOR';
    const callerAvatar = payload.callerAvatar  || null;
    const callerRank   = payload.callerRank    || '';
    const memberCount  = payload.memberCount   || 1;

    nameEl.textContent = callerName;
    typeEl.textContent = callerRank ? `${callerRank} · Group Channel` : 'Secure Group Channel';
    participantsEl.textContent =
      memberCount > 1 ? `${memberCount} operator${memberCount !== 1 ? 's' : ''} in channel` : '';

    avatarEl.src = callerAvatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(callerName)}&background=0f172a&color=00f0ff`;

    overlay.classList.add('active');
    playRingtone();
  }

  function hideOverlay() {
    const overlay = document.getElementById(ICM_OVERLAY_ID);
    if (overlay) overlay.classList.remove('active');
    stopRingtone();
    activeCallId = null;
  }

  /* ══════════════════════════════════════════════════════════
     RINGTONE PLAY / STOP
     ══════════════════════════════════════════════════════════ */
  function playRingtone() {
    if (!ringtoneAudio) return;
    ringtoneAudio.volume = 1;
    ringtoneAudio.currentTime = 0;
    ringtoneAudio.play().catch(() => {
      // Autoplay still blocked — audio will start after next user gesture
      // because we attach an unlock listener on click/touchend/keydown
      document.addEventListener('click', () => {
        if (activeCallId) ringtoneAudio.play().catch(() => {});
      }, { once: true });
    });
  }

  function stopRingtone() {
    if (!ringtoneAudio) return;
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }

  /* ══════════════════════════════════════════════════════════
     ANSWER BUTTON
     Stores the call action in sessionStorage so groupcall.js
     knows the user is answering (not starting a new call),
     then navigates to groupcall.html.
     ══════════════════════════════════════════════════════════ */
  function onAnswer() {
    stopRingtone();

    // Signal to groupcall.js that this is an answer, not a new initiation
    sessionStorage.setItem('cadre_call_action', 'answer');
    sessionStorage.setItem('cadre_call_id', String(activeCallId));

    activeCallId = null;
    document.getElementById(ICM_OVERLAY_ID).classList.remove('active');

    // Navigate to the call page
    // Adjust the path to match your app's URL structure
    const target = findGroupCallUrl();
    window.location.href = target;
  }

  /* ══════════════════════════════════════════════════════════
     DECLINE BUTTON
     Stops ringtone, hides overlay, and sends a rejected signal.
     ══════════════════════════════════════════════════════════ */
  function onDecline() {
    const callId = activeCallId;
    hideOverlay();

    // Notify others that this user declined (optional — callers can count declines)
    if (realtimeChannel && callId) {
      realtimeChannel.send({
        type:    'broadcast',
        event:   'call_rejected',
        payload: {
          rejectorPhone: currentUser.phone,
          rejectorName:  currentUser.name,
          callId,
        },
      }).catch(() => {});
    }
  }

  /* ══════════════════════════════════════════════════════════
     HELPER: FIND THE groupcall.html URL
     Handles apps in subdirectories or with custom routing.
     ══════════════════════════════════════════════════════════ */
  function findGroupCallUrl() {
    // If already on the same origin, build a relative path
    const current = window.location.pathname;
    const dir     = current.substring(0, current.lastIndexOf('/') + 1);
    return dir + GROUPCALL_PAGE;
  }

  /* ══════════════════════════════════════════════════════════
     BOOT: wait for DOM then initialize
     ══════════════════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(); // end IIFE — no globals polluted

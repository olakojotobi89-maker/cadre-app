/**
 * ============================================================
 *  CADRE SFX System
 *  sfx.js
 *
 *  Web Audio API-based sound effects for CADRE operations.
 *  Handles typing clicks, transmissions, confirmations, and
 *  system audio cues. Context auto-resumes on user interaction.
 * ============================================================
 */

(function (global) {
    "use strict";

    const SFX = {};

    /* ─────────────────────────────
       AUDIO CONTEXT & STATE
    ───────────────────────────── */
    let audioContext = null;
    let isContextResumed = false;

    function getAudioContext() {
        if (!audioContext) {
            const ContextClass = window.AudioContext || window.webkitAudioContext;
            if (ContextClass) {
                audioContext = new ContextClass();
            }
        }
        return audioContext;
    }

    function ensureContextRunning() {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(err =>
                console.warn("[SFX] Could not resume AudioContext:", err)
            );
        }
        isContextResumed = true;
    }

    /* ─────────────────────────────
       RESUME ON INTERACTION
       Handles browser autoplay
       restrictions gracefully.
    ───────────────────────────── */
    function _resumeOnInteraction() {
        if (isContextResumed) return;

        const handler = () => {
            ensureContextRunning();
            document.removeEventListener("click", handler);
            document.removeEventListener("keydown", handler);
            document.removeEventListener("touchstart", handler);
        };

        document.addEventListener("click", handler);
        document.addEventListener("keydown", handler);
        document.addEventListener("touchstart", handler);
    }

    _resumeOnInteraction();

    /* ─────────────────────────────
       OSCILLATOR HELPER
       Simple sine wave generator
       with envelope (fade in/out).
    ───────────────────────────── */
    function playTone(frequency, duration, volume = 0.3) {
        const ctx = getAudioContext();
        if (!ctx) return;

        ensureContextRunning();

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = frequency;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (err) {
            console.warn("[SFX] Tone playback failed:", err);
        }
    }

    /* ─────────────────────────────
       KEY CLICK
       Lightweight typing sound.
       ~150ms short beep.
    ───────────────────────────── */
    SFX.keyClick = function () {
        playTone(800, 0.05, 0.15);
    };

    /* ─────────────────────────────
       TRANSMIT / POST SOUND
       Longer, deeper tone for
       sending operations.
    ───────────────────────────── */
    SFX.transmit = function () {
        const ctx = getAudioContext();
        if (!ctx) return;

        ensureContextRunning();

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";

            // Sweep from 600Hz down to 400Hz
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (err) {
            console.warn("[SFX] Transmit failed:", err);
        }
    };

    /* ─────────────────────────────
       CONFIRMATION CHIRP
       Two-tone ascending beep
       for confirmations.
    ───────────────────────────── */
    SFX.confirm = function () {
        playTone(600, 0.1, 0.3);
        setTimeout(() => playTone(800, 0.1, 0.3), 120);
    };

    /* ─────────────────────────────
       ERROR BUZZ
       Lower frequency warning tone.
    ───────────────────────────── */
    SFX.error = function () {
        playTone(300, 0.2, 0.3);
    };

    /* ─────────────────────────────
       ALERT / SYSTEM TONE
       Higher frequency attention signal.
    ───────────────────────────── */
    SFX.alert = function () {
        playTone(1000, 0.1, 0.3);
        setTimeout(() => playTone(1000, 0.1, 0.3), 150);
    };

    /* ─────────────────────────────
       CLICK THROTTLE
       Prevents typing sound spam.
       Per-source 100ms cooldown.
    ───────────────────────────── */
    const _lastClickTime = {};

    function _shouldPlayClick(sourceId = "default") {
        const now = Date.now();
        const lastTime = _lastClickTime[sourceId] || 0;

        if (now - lastTime < 100) {
            return false;
        }

        _lastClickTime[sourceId] = now;
        return true;
    }

    /* ─────────────────────────────
       THROTTLED KEY CLICK
       Safe to attach to keydown events.
    ───────────────────────────── */
    SFX.throttledKeyClick = function (sourceId = "default") {
        if (_shouldPlayClick(sourceId)) {
            SFX.keyClick();
        }
    };

    /* ─────────────────────────────
       EXPORT GLOBALLY
    ───────────────────────────── */
    global.SFX = SFX;

    console.log("[SFX] Audio effects system ready.");

})(window);

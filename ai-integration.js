/**
 * ============================================================
 *  CADRE AI Integration Layer
 *  ai-integration.js
 *
 *  This is the ONLY file that talks to AI.*
 *  All pages talk to CADRE.ai.* — never to AI.* directly.
 *
 *  Load order (every page):
 *    1. <script src="ai-voice.js"></script>
 *    2. <script src="ai-integration.js"></script>
 *    3. <script src="your-page-script.js"></script>
 * ============================================================
 */

(function (global) {
    "use strict";

    /* ─────────────────────────────
       GUARD — ai-voice.js must be
       loaded before this file
    ───────────────────────────── */
    function aiAvailable() {
        return typeof global.AI !== "undefined";
    }

    function safeCall(fn, ...args) {
        if (!aiAvailable()) {
            console.warn("[CADRE.ai] Skipped — ai-voice.js not loaded.");
            return Promise.resolve(false);
        }
        try {
            const result = fn(...args);
            return result instanceof Promise ? result : Promise.resolve(result);
        } catch (err) {
            console.error("[CADRE.ai] Call failed:", err);
            return Promise.resolve(false);
        }
    }

    /* ─────────────────────────────
       DEBOUNCE GUARD
       Prevents speech spam on rapid
       or repeated event triggers.
       Per-key 3 second cooldown.
    ───────────────────────────── */
    const _lastCall = {};

    function debounced(key, fn) {
        const now = Date.now();
        if (_lastCall[key] && now - _lastCall[key] < 3000) {
            console.log(`[CADRE.ai] Debounced: ${key}`);
            return Promise.resolve(false);
        }
        _lastCall[key] = now;
        return safeCall(fn);
    }

    /* ─────────────────────────────
       PUBLIC API — CADRE.ai
    ───────────────────────────── */
    const CADRE_AI = {

        /* ── General ─────────────────────────────────────────── */

        /**
         * Speak any text via AI.
         * Use for one-off announcements.
         * @param {string} text
         */
        speak(text) {
            if (!text) return;
            return safeCall(() => AI.speak(text));
        },

        /**
         * Interrupt all speech and speak urgently.
         * Use for critical system alerts only.
         * @param {string} text
         */
        interrupt(text) {
            if (!text) return;
            return safeCall(() => AI.interrupt(text));
        },

        /**
         * Speak an alert message (slightly faster rate).
         * Safe to call from Supabase realtime handlers.
         * @param {string} message
         */
        alert(message) {
            if (!message) return;
            return debounced(`alert_${message}`, () => AI.alert(message));
        },

        /* ── Auth / Session ──────────────────────────────────── */

        /**
         * Welcome the user after Supabase profile is confirmed loaded.
         * Expects profile.name and profile.rank from your DB.
         * Call ONCE after profile fetch — not on every render.
         * @param {object} profile — Supabase profile row
         */
        welcome(profile) {
            if (!profile) return;
            return debounced("welcome", () => AI.welcome(profile));
        },

        /**
         * Announce app is fully booted and ready.
         * Call once after all init logic completes.
         */
        systemReady() {
            return debounced("system_ready", () => AI.systemReady());
        },

        /**
         * Announce access was denied (auth/permission failure).
         */
        accessDenied() {
            return debounced("access_denied", () => AI.accessDenied());
        },

        /* ── Network ─────────────────────────────────────────── */

        /**
         * Announce network connection lost.
         * Interrupts any current speech — this is urgent.
         */
        connectionLost() {
            return debounced("conn_lost", () => AI.connectionLost());
        },

        /**
         * Announce network connection restored.
         */
        connectionRestored() {
            return debounced("conn_restored", () => AI.connectionRestored());
        },

        /* ── SOS ─────────────────────────────────────────────── */
        sos: {

            /**
             * Play SOS confirmation prompt.
             * Returns Promise<boolean> — true = confirmed, false = cancelled.
             * Use this to GATE your Supabase SOS write.
             *
             * Usage in emergency.html:
             *   const confirmed = await CADRE.ai.sos.confirm();
             *   if (!confirmed) { CADRE.ai.sos.cancelled(); return; }
             *   // ... supabase write ...
             *   CADRE.ai.sos.activated();
             */
            confirm() {
                return safeCall(() => AI.confirmSOS());
            },

            /**
             * Announce SOS is live.
             * Call AFTER successful Supabase write — not before.
             */
            activated() {
                return safeCall(() => AI.sosActivated());
            },

            /**
             * Announce SOS was cancelled.
             */
            cancelled() {
                return safeCall(() => AI.sosCancelled());
            },
        },

        /* ── Channels ────────────────────────────────────────── */
        channel: {

            /**
             * Announce channel join. Call after Agora client.join() resolves.
             * @param {string} channelName — e.g. "Alpha", "Bravo"
             */
            joined(channelName) {
                if (!channelName) return;
                return debounced(`ch_join_${channelName}`, () =>
                    AI.channelJoin(channelName)
                );
            },

            /**
             * Announce channel leave. Call after Agora client.leave() resolves.
             * @param {string} channelName
             */
            left(channelName) {
                if (!channelName) return;
                return debounced(`ch_left_${channelName}`, () =>
                    AI.channelLeft(channelName)
                );
            },

            /**
             * Speak a channel-level message.
             * @param {string} msg
             */
            message(msg) {
                if (!msg) return;
                return safeCall(() => AI.channelMessage(msg));
            },
        },

        /* ── Calls ───────────────────────────────────────────── */
        call: {

            /**
             * Announce incoming call.
             * Hook into Agora "user-joined" or your call invite event.
             */
            incoming() {
                return debounced("call_incoming", () => AI.incomingCall());
            },

            /**
             * Announce call ended.
             * Call after Agora session teardown completes.
             */
            ended() {
                return debounced("call_ended", () => AI.callEnded());
            },
        },

        /* ── Mute ────────────────────────────────────────────── */
        mute: {

            /**
             * Announce mic muted. Call when user mutes in Agora.
             */
            on() {
                return debounced("mute_on", () => AI.muteOn());
            },

            /**
             * Announce mic active. Call when user unmutes in Agora.
             */
            off() {
                return debounced("mute_off", () => AI.muteOff());
            },
        },

        /* ── Presence ────────────────────────────────────────── */
        presence: {

            /**
             * Announce a unit joined the session.
             * Hook into Agora "user-published" or Supabase presence.
             * @param {string} name — unit name or ID
             */
            joined(name) {
                if (!name) return;
                return debounced(`presence_join_${name}`, () =>
                    AI.userJoined(name)
                );
            },

            /**
             * Announce a unit left the session.
             * @param {string} name — unit name or ID
             */
            left(name) {
                if (!name) return;
                return debounced(`presence_left_${name}`, () =>
                    AI.userLeft(name)
                );
            },
        },

        /* ── Messages ────────────────────────────────────────── */
        message: {

            /**
             * Announce a new incoming message.
             * Hook into Supabase realtime INSERT on messages table.
             * @param {string} sender — sender name or unit ID
             */
            incoming(sender) {
                if (!sender) return;
                return debounced(`msg_${sender}`, () =>
                    AI.newMessage(sender)
                );
            },
        },

        /* ── Realtime Helper ─────────────────────────────────── */
        realtime: {

            /**
             * Attach AI alert to a Supabase broadcast channel.
             * Call this after supabase.channel() is created,
             * before .subscribe() is called.
             *
             * Usage:
             *   const ch = supabase.channel('ops')
             *   CADRE.ai.realtime.attachAlerts(ch, 'ops')
             *   ch.subscribe()
             *
             * To trigger from server: broadcast event "ai_alert"
             * with payload: { message: "Your alert text" }
             *
             * @param {object} supabaseChannel
             * @param {string} label — for console logging only
             * @param {function} [extractor] — optional fn(payload) → string
             */
            attachAlerts(supabaseChannel, label = "channel", extractor) {
                if (!supabaseChannel) return;

                supabaseChannel.on(
                    "broadcast",
                    { event: "ai_alert" },
                    (payload) => {
                        const msg = extractor
                            ? extractor(payload)
                            : payload?.payload?.message;
                        if (msg) CADRE_AI.alert(msg);
                    }
                );

                console.log(`[CADRE.ai] Realtime alerts attached to: ${label}`);
            },
        },
    };

    /* ─────────────────────────────
       EXPOSE GLOBALLY
    ───────────────────────────── */
    global.CADRE      = global.CADRE || {};
    global.CADRE.ai   = CADRE_AI;

    console.log("[CADRE.ai] Integration layer ready. All systems nominal.");

})(window);
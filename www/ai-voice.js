(function (window) {

    const AI = {};

    let voiceReady = false;
    let _audioContext = null;
    let _ambientSource = null;
    let _ambientGain = null;

    const PREFERRED_TACTICAL_VOICES = [
        /Microsoft David/i,
        /Microsoft Zira/i,
        /Google UK English Male/i,
        /Google US English/i,
        /Daniel/i,
        /Alloy/i,
        /Samantha/i,
        /Alex/i,
        /en-US/i,
        /en-GB/i,
        /English/i,
    ];

    /* ─────────────────────────────
       INIT VOICES
    ───────────────────────────── */
    function initVoices() {
        if (voiceReady) return;
        speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = function () {
            voiceReady = true;
        };
        voiceReady = true;
    }

    function selectTacticalVoice(voices) {
        const englishVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        for (const pattern of PREFERRED_TACTICAL_VOICES) {
            const candidate = englishVoices.find(v => pattern.test(v.name) || pattern.test(v.voiceURI));
            if (candidate) return candidate;
        }
        return englishVoices[0] || voices[0] || null;
    }

    function getAudioContext() {
        if (_audioContext) return _audioContext;
        const ctor = window.AudioContext || window.webkitAudioContext;
        if (!ctor) return null;
        _audioContext = new ctor();
        return _audioContext;
    }

    function startAmbientLayer() {
        const audioCtx = getAudioContext();
        if (!audioCtx || _ambientSource) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
            data[i] = (Math.random() * 2 - 1) * 0.08;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1200;
        bandpass.Q.value = 0.9;

        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 12;
        compressor.ratio.value = 3.5;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.2;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.0;

        source.connect(bandpass).connect(compressor).connect(gain).connect(audioCtx.destination);
        source.start();

        _ambientSource = source;
        _ambientGain = gain;

        gain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.2);
    }

    function stopAmbientLayer() {
        const audioCtx = getAudioContext();
        if (!audioCtx || !_ambientSource || !_ambientGain) return;
        _ambientGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.12);
        setTimeout(() => {
            if (_ambientSource) {
                try { _ambientSource.stop(); } catch (e) {}
            }
            _ambientSource = null;
            _ambientGain = null;
        }, 250);
    }

    /* ─────────────────────────────
       SPEECH QUEUE GUARD
       Prevents overlapping speech.
       All speak calls go through
       this queue automatically.
    ───────────────────────────── */
    const _queue = [];
    let _isSpeaking = false;

    function _enqueue(text, options, onEnd) {
        _queue.push({ text, options, onEnd });
        _processQueue();
    }

    function _processQueue() {
        if (_isSpeaking || _queue.length === 0) return;

        const { text, options = {}, onEnd } = _queue.shift();

        initVoices();

        const msg = new SpeechSynthesisUtterance(text);

        msg.rate   = options.rate   || 1;
        msg.pitch  = options.pitch  || 0.9;
        msg.volume = options.volume || 1;

        const voices = speechSynthesis.getVoices();
        msg.voice = selectTacticalVoice(voices);

        msg.onend = () => {
            stopAmbientLayer();
            _isSpeaking = false;
            if (typeof onEnd === "function") onEnd();
            _processQueue();
        };

        msg.onerror = () => {
            stopAmbientLayer();
            _isSpeaking = false;
            _processQueue();
        };

        _isSpeaking = true;
        startAmbientLayer();
        speechSynthesis.speak(msg);
    }

    /* ─────────────────────────────
       CORE SPEAK ENGINE
    ───────────────────────────── */
    AI.speak = function (text, options = {}) {
        if (!text) return;
        _enqueue(text, options);
    };

    /**
     * Clear all pending speech immediately.
     * Use for urgent alerts that must interrupt.
     */
    AI.interrupt = function (text, options = {}) {
        speechSynthesis.cancel();
        _queue.length = 0;
        _isSpeaking = false;
        if (text) _enqueue(text, options);
    };

    /* ─────────────────────────────
       WELCOME MESSAGE
    ───────────────────────────── */
    AI.welcome = function (user) {
        const name = user?.name || "Officer";
        const rank = user?.rank || "Unit";

        AI.speak(
            `Welcome ${rank} ${name}. CADRE systems are now active. All communication channels are online.`
        );
    };

    /* ─────────────────────────────
       SYSTEM EVENTS
    ───────────────────────────── */

    /**
     * Called once on app boot / when all systems are confirmed ready.
     */
    AI.systemReady = function () {
        AI.speak("CADRE system is online. All units on standby.");
    };

    /**
     * Called when network connection is lost.
     */
    AI.connectionLost = function () {
        AI.interrupt(
            "Warning. Network connection lost. Attempting to reconnect.",
            { rate: 1.05, pitch: 0.85 }
        );
    };

    /**
     * Called when network connection is restored.
     */
    AI.connectionRestored = function () {
        AI.speak("Connection restored. All systems nominal.", { rate: 1 });
    };

    /**
     * Called when a user is denied access (auth/permission failure).
     */
    AI.accessDenied = function () {
        AI.speak("Access denied. Insufficient clearance.", { pitch: 0.8 });
    };

    /* ─────────────────────────────
       SOS CONFIRMATION FLOW
    ───────────────────────────── */
    AI.confirmSOS = function () {
        return new Promise((resolve) => {

            const msg = new SpeechSynthesisUtterance(
                "Emergency protocol detected. Confirm SOS activation."
            );

            msg.rate  = 1;
            msg.pitch = 0.85;

            msg.onend = () => {
                const ok = confirm("CONFIRM EMERGENCY SOS ACTIVATION?");
                resolve(ok);
            };

            // SOS confirmation bypasses the queue — always plays immediately
            speechSynthesis.cancel();
            _queue.length = 0;
            _isSpeaking = false;
            speechSynthesis.speak(msg);
        });
    };

    AI.sosActivated = function () {
        AI.interrupt(
            "Emergency SOS activated. Command center has been notified.",
            { rate: 1, pitch: 0.85 }
        );
    };

    AI.sosCancelled = function () {
        AI.speak("Emergency activation cancelled.");
    };

    /* ─────────────────────────────
       CHANNEL SYSTEM
    ───────────────────────────── */
    AI.channelJoin = function (channelName) {
        AI.speak(`Connected to ${channelName} channel. Secure link established.`);
    };

    /**
     * Called when the user leaves or disconnects from a channel.
     * @param {string} channelName
     */
    AI.channelLeft = function (channelName) {
        const name = channelName || "current channel";
        AI.speak(`Disconnected from ${name} channel.`);
    };

    AI.channelMessage = function (msg) {
        AI.speak(msg);
    };

    /* ─────────────────────────────
       PRESENCE EVENTS
    ───────────────────────────── */

    /**
     * Called when another user joins the session/channel.
     * @param {string} name - Display name or unit identifier
     */
    AI.userJoined = function (name) {
        const unit = name || "Unknown unit";
        AI.speak(`${unit} has joined.`);
    };

    /**
     * Called when another user leaves the session/channel.
     * @param {string} name - Display name or unit identifier
     */
    AI.userLeft = function (name) {
        const unit = name || "Unknown unit";
        AI.speak(`${unit} has disconnected.`);
    };

    /* ─────────────────────────────
       CALL EVENTS
    ───────────────────────────── */
    AI.incomingCall = function () {
        AI.speak("Incoming communication request.");
    };

    /**
     * Called when a group call or voice session ends.
     */
    AI.callEnded = function () {
        AI.speak("Communication session terminated. Channel closed.");
    };

    /* ─────────────────────────────
       MUTE STATE
    ───────────────────────────── */

    /**
     * Called when the user mutes their microphone.
     */
    AI.muteOn = function () {
        AI.speak("Microphone muted.");
    };

    /**
     * Called when the user unmutes their microphone.
     */
    AI.muteOff = function () {
        AI.speak("Microphone active.");
    };

    /* ─────────────────────────────
       MESSAGE EVENTS
    ───────────────────────────── */

    /**
     * Called when a new message arrives from another unit.
     * @param {string} sender - Sender name or unit ID
     */
    AI.newMessage = function (sender) {
        const from = sender || "Unknown unit";
        AI.speak(`New message from ${from}.`);
    };

    /* ─────────────────────────────
       ALERT SYSTEM
    ───────────────────────────── */
    AI.alert = function (msg) {
        AI.speak(msg, { rate: 1.05 });
    };

    /* ─────────────────────────────
       EXPORT TO WINDOW
    ───────────────────────────── */
    window.AI = AI;

})(window);
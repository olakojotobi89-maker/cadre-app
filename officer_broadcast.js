/**
 * CADRE — Officer Broadcast Module (Agora RTC)
 * Pure frontend WebRTC/Agora publisher
 */

const CADRE_AGORA = {
  // REQUIRED: set via global window vars OR replace fallback values.
  // Prefer setting via <script> before this file so production builds never ship placeholders.
  APP_ID: (typeof window !== 'undefined' && window.__AGORA_APP_ID) ? window.__AGORA_APP_ID : "",
  CHANNEL: (typeof window !== 'undefined' && window.__AGORA_CHANNEL) ? window.__AGORA_CHANNEL : "cadre-surveillance",
  // TOKEN: set to a valid RTC token for production. If null/empty and token is required, join will fail.
  // For RTC broadcast: audiences may be allowed without token only if Agora Console security is configured accordingly.
  TOKEN: (typeof window !== 'undefined' && window.__AGORA_TOKEN) ? window.__AGORA_TOKEN : null,


  client: null,
  videoTrack: null,
  audioTrack: null,

  state: "idle"
};

/* =========================
   UI HELPERS
========================= */

function setStatus(text, mode = "warn") {
  const el = document.getElementById("status");
  if (!el) return;

  el.innerHTML = `<span class="live"></span> ${text}`;
}

function log(msg) {
  const el = document.getElementById("log");
  if (el) el.innerText = "STATUS: " + msg;
}

function setVideoPlaceholder(text) {
  const box = document.getElementById("videoBox");
  if (!box) return;

  box.innerHTML = `<div class="overlayText">${text}</div>`;
}

/* =========================
   START BROADCAST
========================= */

async function startBroadcast() {
  try {
    setStatus("REQUESTING PERMISSION");
    log("Initializing camera & microphone...");

    CADRE_AGORA.client = AgoraRTC.createClient({
      mode: "rtc",
      codec: "vp8"
    });

    setStatus("CONNECTING TO COMMAND CENTER");

    await CADRE_AGORA.client.join(
      CADRE_AGORA.APP_ID,
      CADRE_AGORA.CHANNEL,
      CADRE_AGORA.TOKEN,
      null
    );

    /* Create tracks */
    CADRE_AGORA.videoTrack = await AgoraRTC.createCameraVideoTrack();
    CADRE_AGORA.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    /* Render local preview */
    const box = document.getElementById("videoBox");
    box.innerHTML = "";
    CADRE_AGORA.videoTrack.play(box);

    /* Publish */
    await CADRE_AGORA.client.publish([
      CADRE_AGORA.videoTrack,
      CADRE_AGORA.audioTrack
    ]);

    CADRE_AGORA.state = "live";

    setStatus("LIVE TRANSMISSION ACTIVE");
    log("Broadcast active → surveillance system receiving feed");

  } catch (err) {
    console.error(err);
    setStatus("PERMISSION DENIED / ERROR", "off");
    log("Broadcast failed. Check camera permissions.");
  }
}

/* =========================
   STOP BROADCAST
========================= */

async function stopBroadcast() {
  try {
    setStatus("STOPPING TRANSMISSION");

    if (CADRE_AGORA.videoTrack) {
      CADRE_AGORA.videoTrack.stop();
      CADRE_AGORA.videoTrack.close();
      CADRE_AGORA.videoTrack = null;
    }

    if (CADRE_AGORA.audioTrack) {
      CADRE_AGORA.audioTrack.stop();
      CADRE_AGORA.audioTrack.close();
      CADRE_AGORA.audioTrack = null;
    }

    if (CADRE_AGORA.client) {
      await CADRE_AGORA.client.leave();
      CADRE_AGORA.client = null;
    }

    setVideoPlaceholder("CAMERA OFFLINE");

    CADRE_AGORA.state = "idle";

    setStatus("TRANSMISSION STOPPED");
    log("Broadcast terminated successfully");

  } catch (err) {
    console.error(err);
    log("Error stopping broadcast");
  }
}

/* =========================
   AUTO CLEANUP (mobile safety)
========================= */

window.addEventListener("beforeunload", async () => {
  try {
    if (CADRE_AGORA.client) await CADRE_AGORA.client.leave();
  } catch (e) {}
});
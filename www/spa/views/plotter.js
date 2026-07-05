// SPA View Module: Plotter (converted from plotter.html + plotter.js)
// Preserves Leaflet map, markers, GPS tracking, and Supabase realtime updates.
// IMPORTANT: Do not initialize a new Supabase client; use existing singleton.

import { getSupabaseClient } from '../../supabase-client.js';

let _container = null;
let _sb = null;

let _map = null;
let _myMarker = null;
let _officerMarkers = {};

let _watchId = null;

let _realtimeChannel = null;

const _leafletScriptSrc = 'https://unpkg.com/leaflet/dist/leaflet.js';
const _leafletCssHref = 'https://unpkg.com/leaflet/dist/leaflet.css';

function ensureLeafletLoaded() {
  return new Promise((resolve) => {
    // CSS
    if (!document.querySelector(`link[href="${_leafletCssHref}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = _leafletCssHref;
      document.head.appendChild(link);
    }

    if (window.L && window.L.map) return resolve();
    const existing = document.querySelector(`script[src="${_leafletScriptSrc}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const s = document.createElement('script');
    s.src = _leafletScriptSrc;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.body.appendChild(s);
  });
}

function renderHTML() {
  // Preserve existing plotter.html structure
  return `
<div class="topbar">
  <strong>CADRE GRID</strong>
  <div class="badge" id="userInfo">Loading...</div>
</div>
<div id="map"></div>
<div class="sos-alert" id="sosAlert">🚨 SOS ACTIVE</div>
<style>
body{margin:0;font-family:Arial;background:#0b0f14;color:white;}#map{height:100vh;width:100%;}
.topbar{position:absolute;top:0;left:0;right:0;height:50px;background:rgba(0,0,0,0.7);display:flex;align-items:center;padding:0 10px;z-index:999;}
.badge{background:#1f6feb;padding:5px 10px;border-radius:5px;margin-left:10px;font-size:12px;}
.sos-alert{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:red;padding:10px 20px;border-radius:10px;display:none;animation:blink 1s infinite;}
@keyframes blink{50%{opacity:0.3;}}
</style>
`;
}

async function initMap() {
  const uid = localStorage.getItem('cadre_uid');
  if (!uid) {
    if (window.router?.navigate) window.router.navigate('/login');
    else window.location.hash = '#/login';
    return false;
  }

  // Load user profile
  const { data: user, error: userErr } = await _sb.from('users').select('*').eq('id', uid).single();
  if (userErr) throw userErr;

  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.innerText = `${user.name} | ${user.rank}`;

  _map = window.L.map('map').setView([6.5244, 3.3792], 13);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'CADRE GRID'
  }).addTo(_map);

  // Start GPS tracking
  startTracking(uid);

  // Load all officers
  await loadOfficers();

  // Realtime updates
  subscribeRealtime();

  return true;
}

function startTracking(uid) {
  if (!navigator.geolocation) return;

  _watchId = navigator.geolocation.watchPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // update DB
    try {
      await _sb.from('officer_locations').upsert({
        user_id: uid,
        lat,
        lng,
        updated_at: new Date().toISOString()
      });
    } catch {}

    // update self marker
    if (!_myMarker) {
      _myMarker = window.L.marker([lat, lng]).addTo(_map).bindPopup('YOU');
    } else {
      _myMarker.setLatLng([lat, lng]);
    }

    _map.setView([lat, lng]);
  }, (err) => {
    console.log(err);
  }, { enableHighAccuracy: true });
}

async function loadOfficers() {
  const { data } = await _sb.from('officer_locations').select('*');
  if (!data) return;

  data.forEach((o) => {
    if (!_officerMarkers[o.user_id]) {
      _officerMarkers[o.user_id] = window.L.marker([o.lat, o.lng]).addTo(_map).bindPopup(o.user_id);
    } else {
      _officerMarkers[o.user_id].setLatLng([o.lat, o.lng]);
    }
  });
}

function subscribeRealtime() {
  _realtimeChannel = _sb.channel('officer_locations');

  _realtimeChannel
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'officer_locations'
    }, (payload) => {
      const o = payload.new;
      if (!o) return;

      if (!_officerMarkers[o.user_id]) {
        _officerMarkers[o.user_id] = window.L.marker([o.lat, o.lng]).addTo(_map);
      } else {
        _officerMarkers[o.user_id].setLatLng([o.lat, o.lng]);
      }
    })
    .subscribe();
}

export async function mount(container, params = {}) {
  _container = container;
  if (!container) return;

  container.innerHTML = renderHTML();

  _sb = getSupabaseClient();

  await ensureLeafletLoaded();

  // Auth + init
  await initMap();
}

export async function unmount(container) {
  if (_container !== container) _container = container;
  if (!container) return;

  // Stop GPS tracking
  if (_watchId !== null) {
    try { navigator.geolocation.clearWatch(_watchId); } catch {}
    _watchId = null;
  }

  // Unsubscribe realtime
  if (_realtimeChannel) {
    try { await _realtimeChannel.unsubscribe(); } catch {}
    _realtimeChannel = null;
  }

  // Destroy markers/layers
  _officerMarkers = {};

  // Remove my marker
  try {
    if (_myMarker) {
      _myMarker.remove();
      _myMarker = null;
    }
  } catch {}

  // Destroy map
  try {
    if (_map && _map.remove) _map.remove();
  } catch {}
  _map = null;

  // Clear DOM
  container.innerHTML = '';

  _sb = null;
  _container = null;
}


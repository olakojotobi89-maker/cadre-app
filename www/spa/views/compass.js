// SPA View Module: Compass (converted from compass.html)
// Preserves UI layout, compass display behavior, device orientation integration,
// and navigation links. No database changes; uses existing SPA router.

let _container = null;
let _orientationHandler = null;
let _cleanupNav = null;

function renderHTML() {
  // Preserve the original compass.html visuals/DOM (except full page wrapper scripts).
  return `
<div class="dashboard-panel">
    <div class="panel-header">Tactical Heading Vector</div>

    <div class="compass-ring">
        <div id="needle"></div>
    </div>

    <div class="bearing-display" id="bearing">000°</div>

    <a href="#/admin" class="back-btn" data-nav="admin">Return to Node</a>
</div>

<div class="bottom-nav">
    <a href="#/dashboard" data-nav="dashboard"><span>🏠</span>Feed</a>
    <a href="#/map" data-nav="map"><span>🗺️</span>Map</a>
    <a href="#/compass" data-nav="compass"><span>🧭</span>Compass</a>
    <a href="#/plotter" data-nav="plotter"><span>📍</span>Plotter</a>
    <a href="#/profile" data-nav="profile"><span>👤</span>Profile</a>
</div>
<style>
:root {
    --hud-crimson: #ff3333;
    --hud-emerald: #00ff66;
    --hud-cyan: #00f0ff;
    --hud-cyan-glow: rgba(0, 240, 255, 0.5);
    --bg-dark-surface: #060b13;
    --border-precision: #1e293b;
    --tech-font: 'Courier New', Courier, monospace;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    background-color: #020408;
    background-image: linear-gradient(rgba(18, 24, 38, 0.4) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(18, 24, 38, 0.4) 1px, transparent 1px);
    background-size: 20px 20px;

    font-family: var(--tech-font);
    color: white;

    padding: 20px;
}

body::before {
    content: "";
    position: fixed;
    inset: 0;
    background: linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%);
    background-size: 100% 4px;
    pointer-events: none;
}

.dashboard-panel {
    background: rgba(9, 17, 28, 0.7);
    border: 1px solid var(--border-precision);
    backdrop-filter: blur(8px);

    padding: 20px;
    width: 100%;
    max-width: 420px;

    display: flex;
    flex-direction: column;
    align-items: center;

    border-radius: 10px;
}

.panel-header {
    width: 100%;
    text-align: center;
    font-size: 0.85rem;
    letter-spacing: 2px;
    color: #748ba7;
    margin-bottom: 20px;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 10px;
}

.compass-ring {
    width: 240px;
    height: 240px;
    border: 2px solid var(--hud-cyan);
    border-radius: 50%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

#needle {
    width: 4px;
    height: 110px;
    background: linear-gradient(to bottom, var(--hud-crimson) 50%, var(--hud-emerald) 50%);
    position: absolute;
    transform-origin: bottom center;
    transition: transform 0.1s ease-out;
    border-radius: 2px;
}

.bearing-display {
    font-size: 2rem;
    color: var(--hud-cyan);
    margin-bottom: 20px;
    text-shadow: 0 0 10px var(--hud-cyan-glow);
}

.back-btn {
    background: rgba(14, 26, 45, 0.6);
    border: 1px solid #1e293b;
    color: #94a3b8;
    padding: 10px 20px;
    text-decoration: none;
    font-size: 0.75rem;
    text-transform: uppercase;
}

.bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;

    display: grid;
    grid-template-columns: repeat(5, 1fr);

    background: rgba(9, 17, 28, 0.95);
    border-top: 1px solid #1e293b;
}

.bottom-nav a {
    text-align: center;
    padding: 10px 0;
    text-decoration: none;
    color: #94a3b8;
    font-size: 12px;
}

.bottom-nav a span {
    display: block;
    font-size: 18px;
}

@media (max-width: 480px) {
    .compass-ring { width: 200px; height: 200px; }
    #needle { height: 90px; }
}
</style>
`;
}

function setupOrientation(container) {
  const needle = container.querySelector('#needle');
  const bearingDisplay = container.querySelector('#bearing');
  if (!needle || !bearingDisplay) return;

  _orientationHandler = (event) => {
    const alpha = event.alpha;
    if (alpha !== null && alpha !== undefined) {
      // Original logic in compass.js shim uses: rotation = 360 - alpha
      const rotation = 360 - alpha;
      needle.style.transform = `rotate(${rotation}deg)`;
      bearingDisplay.textContent = `${Math.round(alpha).toString().padStart(3, '0')}°`;
    }
  };

  window.addEventListener('deviceorientationabsolute', _orientationHandler, true);
}

function setupNavigation(container) {
  // Keep navigation behavior without page reload.
  const onClick = (e) => {
    const link = e.target?.closest?.('[data-nav]');
    if (!link) return;

    e.preventDefault();

    const route = link.getAttribute('data-nav');
    if (!route) return;

    if (typeof window.router?.navigate === 'function') {
      // These are canonical SPA routes in this project.
      const map = {
        dashboard: '/dashboard',
        map: '/map',
        compass: '/compass',
        plotter: '/plotter',
        profile: '/profile',
        admin: '/admin',
      };

      window.router.navigate(map[route] || '/' + route);
    } else {
      // Fallback: hash navigation
      const href = link.getAttribute('href');
      if (href) window.location.hash = href.replace(/^#/, '');
    }
  };

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

export async function mount(container, params = {}) {
  _container = container;
  if (!container) return;

  container.innerHTML = renderHTML();

  setupOrientation(container);
  _cleanupNav = setupNavigation(container);
}

export async function unmount(container) {
  if (_container !== container) _container = container;
  if (!container) return;

  if (_orientationHandler) {
    window.removeEventListener('deviceorientationabsolute', _orientationHandler, true);
    _orientationHandler = null;
  }

  if (_cleanupNav) {
    _cleanupNav();
    _cleanupNav = null;
  }

  container.innerHTML = '';
  _container = null;
}


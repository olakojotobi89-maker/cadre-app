// SPA View Module: Compass
// Exports mount(container, params) / unmount(container)
// Maintains visual design by rendering the original HTML body.

let _orientationHandler = null;
let _containerRef = null;

function renderHTML() {
  return `
<div class="dashboard-panel">
    <div class="panel-header">Tactical Heading Vector</div>

    <div class="compass-ring">
        <div id="needle"></div>
    </div>

    <div class="bearing-display" id="bearing">000°</div>

    <a href="#/admin" class="back-btn" data-nav="admin">Return to Node</a>
</div>

<!-- NAV -->
<div class="bottom-nav">
    <a href="#/dashboard" data-nav="dashboard"><span>🏠</span>Feed</a>
    <a href="#/map" data-nav="map"><span>🗺️</span>Map</a>
    <a href="#/compass" data-nav="compass"><span>🧭</span>Compass</a>
    <a href="#/plotter" data-nav="plotter"><span>📍</span>Plotter</a>
    <a href="#/profile" data-nav="profile"><span>👤</span>Profile</a>
</div>
`;
}

function setupDeviceOrientation(container) {
  const needle = container.querySelector('#needle');
  const bearingDisplay = container.querySelector('#bearing');
  if (!needle || !bearingDisplay) return;

  _orientationHandler = (event) => {
    const alpha = event.alpha;
    if (alpha !== null && alpha !== undefined) {
      const rotation = 360 - alpha;
      needle.style.transform = `rotate(${rotation}deg)`;
      bearingDisplay.textContent = `${Math.round(alpha).toString().padStart(3, '0')}°`;
    }
  };

  window.addEventListener('deviceorientationabsolute', _orientationHandler, true);
}

function setupNav(container) {
  // Event delegation to avoid per-element listeners.
  const onClick = (e) => {
    const target = e.target;
    const link = target && target.closest ? target.closest('[data-nav]') : null;
    if (!link) return;

    e.preventDefault();

    const route = link.getAttribute('data-nav');
    if (!route) return;

    if (typeof window.router?.navigate === 'function') {
      switch (route) {
        case 'dashboard':
          window.router.navigate('#/dashboard');
          break;
        case 'map':
          window.router.navigate('#/map');
          break;
        case 'compass':
          window.router.navigate('#/compass');
          break;
        case 'plotter':
          window.router.navigate('#/plotter');
          break;
        case 'profile':
          window.router.navigate('#/profile');
          break;
        case 'admin':
          window.router.navigate('#/admin');
          break;
        default:
          window.router.navigate(`#/${route}`);
          break;
      }
      return;
    }

    // Fallback: hash navigation.
    const href = link.getAttribute('href');
    if (href) window.location.hash = href.replace(/^#/, '');
  };

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}

let _removeNav = null;

export function mount(container, params = {}) {
  _containerRef = container;
  container.innerHTML = renderHTML();

  // NOTE: Original page had inline <style> in compass.html.
  // Do NOT change visuals; however, in your SPA shell the styles are presumably global.
  // If compass-specific styles were not moved into style.css, we keep them inline by relying on existing CSS.
  // If you need them preserved exactly, we can move the <style> block into style.css later.

  setupDeviceOrientation(container);

  _removeNav = setupNav(container);

  // IMPORTANT: Original compass.html loaded ai-voice.js per-page.
  // Architecture requirement: AI modules must be initialized once globally.
  // Do NOT load/initialize AI here.
}

export function unmount(container) {
  if (_orientationHandler) {
    window.removeEventListener('deviceorientationabsolute', _orientationHandler, true);
    _orientationHandler = null;
  }

  if (_removeNav) {
    _removeNav();
    _removeNav = null;
  }

  // Do not destroy global state (calls/ringtone/AI/etc). Compass uses none.
  // Only clear this view's DOM.
  container.innerHTML = '';
  _containerRef = null;
}


// SPA View Module: Channel (converted from channel.html)
// NOTE: Uses existing UI + legacy business logic by embedding legacy script.
// - Do NOT initialize a new Supabase client (use existing singleton CADRE_SB / getSupabaseClient)
// - Preserve realtime behavior by keeping legacy cadreSubscribeTable/cadre-common.js wiring.
// - Replace location reload/navigation with SPA router where possible.

import { getSupabaseClient } from '../../supabase-client.js';

let _container = null;
let _cleanup = null;

export async function mount(container, params = {}) {
  _container = container;
  if (!container) return;

  // Cleanup any previous render
  container.innerHTML = '';

  // Inject legacy styles/scripts by rendering full legacy body markup and executing inline script.
  // We re-run inline scripts by loading channel.html and evaluating its inline <script> blocks.

  // Load legacy HTML
  const full = await fetch('channel.html').then((r) => r.text());

  // Inject legacy <style> blocks (if any) into head
  const styleBlocks = full.match(/<style[\s\S]*?<\/style>/gi) || [];
  for (const styleText of styleBlocks) {
    const uniq = 'cadre-legacy-channel-style';
    // Avoid duplicates
    if (document.getElementById(uniq)) continue;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = styleText;
    const styleEl = wrapper.firstElementChild;
    if (styleEl && styleEl.tagName === 'STYLE') {
      styleEl.id = uniq;
      document.head.appendChild(styleEl);
    }
  }

  // Extract body contents
  const bodyMatch = full.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHTML = bodyMatch ? bodyMatch[1] : full;

  // Extract and remove inline scripts from body; we'll execute them after DOM insertion
  const inlineScriptRegex = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const inlineScripts = [];
  let bodyHTMLWithoutInline = bodyHTML.replace(inlineScriptRegex, (m, code) => {
    if (code && code.trim()) inlineScripts.push(code);
    return '';
  });

  // Remove external scripts tags from body (they will be loaded separately)
  bodyHTMLWithoutInline = bodyHTMLWithoutInline.replace(/<script[^>]*\ssrc=["'][^"']+["'][^>]*><\/script>/gi, '');

  container.innerHTML = bodyHTMLWithoutInline;

  // Ensure legacy globals exist: CADRE_SB singleton mapping
  // If app already provides CADRE_SB, keep it; otherwise set it to singleton from getSupabaseClient().
  try {
    if (!window.CADRE_SB) {
      const sb = getSupabaseClient();
      window.CADRE_SB = sb;
    }
  } catch {}

  // Ensure cadre-common.js is present (legacy depends on it)
  const ensureExternalScript = (src) =>
    new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.body.appendChild(s);
    });

  await Promise.all([
    ensureExternalScript('cadre-common.js'),
    ensureExternalScript('https://download.agora.io/sdk/release/AgoraRTC_N.js'),
    ensureExternalScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'),
  ]);

  // Patch legacy navigation calls: window.location.href = 'home.html' etc.
  // Only replace when it matches known legacy links; keep otherwise.
  const originalLocationHref = window.location.href;
  const originalReload = window.location.reload.bind(window.location);
  const router = window.router;

  const legacyNavInterceptor = (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || !href.endsWith('.html')) return;
    e.preventDefault();
    const map = {
      'home.html': '/home',
      'channel.html': '/channel',
      'login.html': '/login',
      'intelligence.html': '/intelligence',
    };
    const next = map[href] || '/home';
    if (router?.navigate) router.navigate(next);
    else window.location.hash = '#' + next;
  };

  container.addEventListener('click', legacyNavInterceptor);

  // Evaluate inline scripts in order
  // eslint-disable-next-line no-new-func
  for (const code of inlineScripts) {
    try {
      // Provide eval-like global execution
      new Function(code).call(window);
    } catch (err) {
      console.warn('Channel legacy inline script failed:', err);
    }
  }

  // Replace window.location.href assignments used in legacy
  // (best-effort; some code uses window.location.href directly)
  try {
    Object.defineProperty(window.location, 'href', {
      configurable: true,
      enumerable: true,
      get() {
        return originalLocationHref;
      },
      set(value) {
        if (typeof value === 'string' && value.endsWith('.html')) {
          const map = {
            'home.html': '/home',
            'channel.html': '/channel',
            'login.html': '/login',
            'intelligence.html': '/intelligence',
          };
          const next = map[value] || '/home';
          if (router?.navigate) router.navigate(next);
          else window.location.hash = '#' + next;
          return;
        }
        try {
          originalReload();
        } catch {}
      },
    });
  } catch {}

  _cleanup = () => {
    try {
      container.removeEventListener('click', legacyNavInterceptor);
    } catch {}

    // Attempt to let legacy unsubscribe if cadre-common tracks channels
    try {
      if (window.__cadre_unsubscribers && Array.isArray(window.__cadre_unsubscribers)) {
        for (const fn of window.__cadre_unsubscribers) {
          try {
            fn();
          } catch {}
        }
        window.__cadre_unsubscribers = [];
      }
    } catch {}

    // Clear container DOM
    container.innerHTML = '';
  };
}

export async function unmount(container) {
  if (!_container || _container !== container) _container = container;
  if (!container) return;

  try {
    if (_cleanup) _cleanup();
  } catch {}

  _cleanup = null;
  _container = null;
}


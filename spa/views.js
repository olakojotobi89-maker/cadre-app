// Central view registry (no lazy-load).
// Each view module must export: async mount(container, params) + unmount(container)

export const routes = new Map([
  ['/login', (await import('./views/login.js'))],
  ['/dashboard', (await import('./views/home.js'))],
  ['/home', (await import('./views/home.js'))],
  ['/profile', (await import('./views/profile.js'))],
  ['/plotter', (await import('./views/plotter.js'))],
  ['/map', (await import('./views/map.js'))],
  ['/compass', (await import('../compass.js'))],
  ['/channel', (await import('./views/channel.js'))],
  ['/admin', (await import('./views/admin.js'))],
  ['/emergency', (await import('./views/emergency.js'))],
  ['/group-call', (await import('./views/groupcall.js'))],
  ['/groupcall', (await import('./views/groupcall.js'))],
  ['/intelligence', (await import('./views/intelligence.js'))],
  ['/ebook', (await import('./views/ebook.js'))],
  ['/', (await import('./views/home.js'))],
]);


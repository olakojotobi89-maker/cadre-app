# CADRE App Auth/Session Root-Cause Fix TODO

## Step 1 — Identify root cause (SW caching)
- [x] Reviewed `sw.js` caching strategy.
- [x] Confirmed `cacheFirst()` is used for all same-origin requests including `home.html` / `index.html`.
- [ ] Modify `sw.js` so auth-sensitive pages are not served cache-first.

## Step 2 — Apply Service Worker fix
- [x] Update `cadre-app/sw.js` fetch handler to bypass cache-first for auth-sensitive HTML pages (start with `index.html` and `home.html`).

## Step 3 — Validate
- [ ] Login: remains on `home.html`.
- [ ] Refresh `home.html`: remains logged in.
- [ ] Navigate between protected pages: session preserved.
- [ ] Unstable/slow internet: no unexpected logout.
- [ ] Redirect to `index.html` only when no valid session exists.


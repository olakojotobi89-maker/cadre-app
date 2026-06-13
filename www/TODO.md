# Routing fix TODO (routing-only; no business/auth/JS/UI logic changes)

- [x] Inspect routing-related configs (found `webDir: "www"`)
- [x] Inspect `www/` contents (found missing HTML pages and possibly missing `manifest.json` / `sw.js`)
- [ ] Copy/mirror all root static web assets into `www/` (HTML, CSS, JS, images/audio, `manifest.json`, `sw.js`), preserving filenames
- [ ] If duplicates exist, overwrite to match root versions only for routing completeness (no logic changes)
- [ ] Verify that direct requests work for:
  - [ ] `/admin-register-member.html`
  - [ ] `/home.html`
  - [ ] `/profile.html`
  - [ ] `/surveillance.html`
- [ ] Verify existing navigation links still work
- [ ] (Capacitor) Run `npx cap sync` and `npx cap build android` to confirm build includes `www/` assets


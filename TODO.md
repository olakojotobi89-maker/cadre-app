- [ ] Create `www/` directory
- [ ] Move/copy all root web assets (HTML, CSS, JS, images/audio, manifest.json, sw.js, etc.) into `www/`
- [ ] Keep `android/`, `package.json`, Capacitor native files intact
- [ ] Update `capacitor.config.json` to `webDir: "www"`
- [ ] Ensure `www/index.html` exists and references assets with correct relative paths
- [ ] Run `npx cap sync` and `npx cap build android` to verify


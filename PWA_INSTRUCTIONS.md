# PWA Instructions for Race Notes

This guide covers the PWA conversion of **Race Notes**, verifying the service worker registration, web app manifest, custom icons, and providing deployment steps to host it on Netlify and install it on Android.

---

## 1. How to Deploy and Share on Netlify

### Option A: Via GitHub Integration (Recommended)
1. Push your repository to a git hosting service (GitHub, GitLab, or Bitbucket).
2. Go to [Netlify](https://www.netlify.com/) and click **Add new site** -> **Import an existing project**.
3. Select your repository. Netlify will automatically detect the build settings from [netlify.toml](file:///c:/Users/maxx/antigravity/Race-Notes/netlify.toml):
   - **Build Command**: `npm run build`
   - **Publish directory**: `dist`
4. Click **Deploy site**. Once complete, Netlify will provide an HTTPS URL (e.g. `https://your-site-name.netlify.app`).

### Option B: Manual Deploy (Netlify Drag-and-Drop)
1. Run `npm run build` on your system.
2. Log into Netlify.
3. Go to the **Sites** tab and scroll to the bottom.
4. Drag and drop the generated `dist/` directory from your file explorer into the Netlify upload zone.

---

## 2. Installing on your Android Device

1. Open your Netlify app URL inside **Google Chrome** on your Android device (ensure the address starts with `https://` — HTTP connections will not allow PWA installation).
2. Chrome will detect the PWA configuration:
   - You will see a banner prompt at the bottom: **"Add Race Notes to Home screen"**.
   - If you do not see the banner, tap the **three-dot menu** in the top right corner of Chrome and select **"Install app"** (or "Add to Home screen").
3. Tap **Install**.
4. The app will install onto your device with the custom motorsport logo, launching in native standalone mode (without browser toolbars) and supporting offline usage!

---

## 3. PWA Integration Summary
- **App Icons**: Standardized icons generated in your `public/` directory:
  - `pwa-192x192.png` (splash screens)
  - `pwa-512x512.png` (high-res display)
  - `maskable-icon.png` (safe padding for Android's adaptive shape masks)
- **Vite PWA Config**: Set up in [vite.config.ts](file:///c:/Users/maxx/antigravity/Race-Notes/vite.config.ts) using `vite-plugin-pwa` to handle service workers and automatic background updates.
- **HTML Meta tags**: Added in [index.html](file:///c:/Users/maxx/antigravity/Race-Notes/index.html) to style the address bar, enable fullscreen mode, and provide high-quality icons.
- **Redirection Rules**: Configured in [netlify.toml](file:///c:/Users/maxx/antigravity/Race-Notes/netlify.toml) to route requests cleanly.

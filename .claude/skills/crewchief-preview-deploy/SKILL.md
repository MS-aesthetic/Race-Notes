---
name: crewchief-preview-deploy
description: Deploy Crew Chief to a Netlify preview (draft) URL and verify it. Use when asked to deploy, preview, publish a draft, or share a build link. Production deploys require the owner to explicitly say "push to production".
---

# Crew Chief preview deploy

## Rules
- Site: **`crew-chief-race-notes`**, id `412f62d3-aebc-452c-b526-ac0aac3867b6`. Other Netlify sites on the team (`race-notes`, `extraordinary-sunshine-a44035`) are not this app.
- **Preview by default.** Production only when Maxx explicitly says "push to production" or equivalent in the current request. Earlier approval does not carry over.
- The site is not Git-connected. A `git push` deploys nothing.
- Never deploy a bundle built with `ALLOW_UNCONFIGURED_BUILD=1`.

## Steps
1. Run the `crewchief-verify` skill. Real `npm run build` must pass.
2. Confirm the bundle has cloud config: `grep -l swblfeayxoprodhwxqak dist/assets/*.js`.
3. Deploy a draft:
   - Preferred: Netlify CLI with no `--prod`: `npx netlify-cli deploy --dir=dist --site 412f62d3-aebc-452c-b526-ac0aac3867b6`. Needs `NETLIFY_AUTH_TOKEN` in the environment; on the owner's Windows machine the CLI is already logged in.
   - Netlify connector `mcp__Netlify__netlify-deploy-services-updater` (`deploy-site`) takes only a `siteId` and has **no draft/production switch**. Its result may be a production publish. Do not use it unless the owner asked for production, or you have confirmed from its output that it only returns CLI instructions.
4. Verify the draft URL. The PWA service worker caches hard, so use a fresh browser context. Check the auth gate renders at 390px width with zero console errors. Use Playwright with `executablePath: '/opt/pw-browsers/chromium'` if a browser check is needed.
5. Report the draft URL, the commit it was built from, and which branch direction (master or simplified) it shows.

# TaxProof — GitHub Pages edition

An evidence-led tax workpaper prototype by Krishna Chaitanya, built with AI assistance.

## Publish without installing anything

1. Create a **public** GitHub repository named `taxproof` under your account.
2. Extract this ZIP. Upload the contents of this folder into the repository, preserving the `docs` and `src` directories. Do not upload just the ZIP file.
3. In the repository open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select **main** and **/docs**, then click **Save**.
6. Wait for the Pages deployment to finish. GitHub displays the live URL on that settings page.

For the account bkc021102 and repository taxproof, the expected URL after successful deployment is:
https://bkc021102.github.io/taxproof/

This URL is not live merely because this package exists.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## What is included

- `docs/`: compiled website, ready for GitHub Pages. No build workflow required.
- `src/App.tsx`: interactive review interface.
- `src/static-api.ts`: browser-only persistence adapter.
- `src/core.mjs`: evidence checks, adjustment and approval rules.
- `src/packet.json`: unchanged fictional input packet.
- `src/style.css`: styling.
- `vite.config.ts`: relative asset paths so project-site URLs work.
- `package.json`: dependencies and development scripts.

## Browser-only behavior

GitHub Pages serves static files; this edition uses IndexedDB to store review activity and attachments in the visitor's browser. Reloading the same browser preserves work. Clearing site data removes it. Different browsers/devices do not share changes. Revision checks detect conflicting edits between tabs in the same browser.

All input data is fictional and publicly downloadable in the app bundle. Role selection, masking, approval rules and audit history demonstrate the workflow; client-side code is not a security or authorization boundary. This version does not provide server-enforced roles or multi-user shared database collaboration.

No real tax filing, legally executed signature, full tax-engine recomputation, external notifications or runtime LLM is included. Custom tax effects are estimates. Supplied what-if results stay separate from custom adjustments.

The original server-backed prototype remains available separately; this package does not change it.

## Develop

Use Node.js 22.13 or newer. Run `npm install`, then `npm run dev`.
Run `npm run build` to update `docs/`, then commit the updated source and build output. Avoid putting private or real taxpayer data into a public repository.

## Suggested demo

Open Review queue → duplicate interest → inspect ev-0492 and ev-0538 → open SchB.1.2 → record a justified correction if still needed → resolve the issue → switch demo role to reviewer → record approval → make a substantive change → show stale approval. Show missing transaction D31 page 32, version comparison, scenarios, and filing blockers.

Disclose AI assistance. Record your own screen and voice for the required video.

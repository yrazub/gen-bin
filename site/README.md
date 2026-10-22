# gen-bin catalog site

A static catalog of the gen-bin marketplace, built by [Astro](https://astro.build) from the
repository's own files. It is published at <https://yrazub.github.io/gen-bin/>.

## Prerequisites

Node.js 22 or later with npm. Nothing else: no Docker, no global packages, no environment variables.

## Commands

Run these in `site/`.

| | |
|---|---|
| install | `npm ci` |
| develop | `npm run dev` — serves <http://localhost:4321/gen-bin/> from the working tree |
| test | `npm test` (unit), `npm run test:build` (built output), `npm run test:e2e` (browser) |
| build | `npm run build` — writes `dist/` |
| preview | `npm run preview` — serves the built `dist/` at <http://localhost:4321/gen-bin/> |

The dev server, the preview and the deployed site share the base path `/gen-bin/`, so a link that
works locally works on GitHub Pages.

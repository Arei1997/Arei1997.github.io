# Portfolio

A personal portfolio with three interactive themes, each built around a hobby:

| Theme | Interest | Interactive centrepiece |
| --- | --- | --- |
| **Garage** | Cars, mechanics, aerodynamics | Particle wind tunnel with live drag / downforce / power maths, rolling road, smoke wand, and a scroll-driven rev counter you can hold to rev a synthesised V8 |
| **Arcade** | Gaming | Pixel-art runner game, XP bar, unlockable achievements and a Konami-code easter egg |
| **Studio** | Music (piano, guitar) | Playable piano (mouse or computer keyboard) and guitar (Karplus–Strong string synthesis, chord shapes, strum by sweeping), audio visualiser and a "now playing" scroll HUD |

Each theme restyles the whole site — About, Experience, Projects, Skills and Contact — and is code-split so visitors only download what they use. The chosen theme persists and can be shared with `?theme=garage|arcade|studio`.

No framework, no runtime dependencies: TypeScript, Canvas, SVG and the Web Audio API, bundled with Vite.

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

## Edit the content

Everything you'd want to change lives in [`src/content.ts`](src/content.ts): name, tagline, about text, experience, projects, skills, links and email. Fields marked `TODO` are placeholders. The page title and SEO tags are generated from the same file.

To offer a CV download, put `cv.pdf` in `public/` and set `cv: '/cv.pdf'`.

## Deploy

Pushing to `main` builds and deploys to **GitHub Pages** via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. Create a GitHub repository named `<username>.github.io` (so the site is served from the root) and push.
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. The site goes live at `https://<username>.github.io`.

### Custom domain

1. Buy a domain (e.g. from Cloudflare, Namecheap or Porkbun).
2. Add `public/CNAME` containing just the domain, e.g. `yourname.dev`.
3. At your DNS provider, add `A` records for the apex domain pointing to GitHub Pages
   (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and a `CNAME` for `www` pointing to `<username>.github.io`.
4. In **Settings → Pages**, enter the domain and tick **Enforce HTTPS**.
5. Update `siteUrl` in `src/content.ts`.

If you deploy to a sub-path instead (a repo not named `<username>.github.io`, with no custom domain), set `BASE_PATH: /repo-name/` as an environment variable on the build step.

## Structure

```
src/
  content.ts          all site copy
  main.ts             theme switching, routing, wiring
  render.ts           section markup
  themes/             theme definitions + per-theme mount code
  interactive/        wind tunnel, tachometer, runner, achievements, piano, guitar
  lib/                audio graph, scroll/section tracking, storage, DOM helpers
  styles/             base layout + one stylesheet per theme
```

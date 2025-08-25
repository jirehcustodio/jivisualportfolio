Astro + Preact Islands (pilot)

- Dev: npm run dev (port 4321)
- Build: npm run build (outputs to dist/)
- Preview: npm run preview

Notes:
- This lives alongside your existing static site; no Netlify deploy change yet.
- Netlify Functions remain in portfolio/netlify/functions and work as-is.
- When ready to switch, point netlify.toml publish to `portfolio/dist` after `npm run build`.

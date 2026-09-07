# SMC Academy — Smart Money Concepts Strategy & Video Library

A single-page, static site that teaches the **Smart Money Concepts (SMC)** trading strategy and
curates a library of free YouTube videos about every SMC topic: market structure (BOS / CHoCH / MSS),
liquidity & stop hunts, order blocks, fair value gaps, premium/discount & OTE, killzones,
Power of 3, Silver Bullet and full courses.

## What's inside

| Section        | What it does                                                          |
| -------------- | --------------------------------------------------------------------- |
| Start here     | Inline video player + a recommended 5-video watch order               |
| Learning path  | 6 modules that map to library categories                              |
| Video library  | 22 verified videos, filter by concept, live search, modal player      |
| Strategy       | The 5-step SMC trade playbook                                         |
| Concepts       | Plain-language SMC glossary (cheat sheet)                             |

Every video ID was verified live against YouTube's oEmbed API, so thumbnails and embeds resolve.

## Files

```
index.html              → page structure (no framework, no build step)
assets/css/styles.css   → theme + responsive layout
assets/js/data.js       → videos, categories, modules, playbook, glossary
assets/js/app.js        → rendering, filtering, players, annotated hero chart
```

## Run locally

Any static file server works, e.g.:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
# or
npx serve .
```

Then open http://localhost:4173

Videos are embedded through `https://www.youtube-nocookie.com/embed/...`; thumbnails load from
`i.ytimg.com`. All video content belongs to its creators on YouTube — this is an educational
video-library page, not financial advice.

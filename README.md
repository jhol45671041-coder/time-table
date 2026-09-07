# Timetable Studio

A **fully automated timetable generator** with a complete web front-end — a constraint solver that
builds a conflict-free school week from your classes, subjects, staff and rooms, wrapped in an app
with **twelve switchable visual styles**.

Zero runtime dependencies. No build step. Open `index.html` through any static server and it works.

```bash
npm start          # serves the app on http://0.0.0.0:8000
npm run verify     # engine tests + design-system audit + UI smoke test
npm run bench      # solver performance across dataset sizes
```

---

## What it does

Press **Generate** (or `G`) and the solver places every lesson in the week, then scores its own work.

| | |
|---|---|
| **Automated scheduling** | Constraint solver: MRV ordering, stochastic backtracking, restarts, then a hill-climbing polish pass |
| **Never breaks a rule** | Teacher, room and class clashes are impossible by construction — an independent auditor re-checks every result |
| **Explains itself** | If a lesson cannot be placed, you get the reason *and* the fix ("no free lab room → add one or lower the class size") |
| **Compares candidates** | Three independent solves are ranked by quality; adopt any of them with one click |
| **Reproducible** | Every result carries its seed — the same seed rebuilds the same week |
| **Human override** | Pin a lesson so the solver never moves it, or drag any lesson to a new slot (illegal drops are refused with a reason) |
| **Four views** | Class week grid · teacher grid · room grid · day-by-day agenda |
| **Twelve styles** | Aurora, Midnight, Neon Grid, Forest, Slate, Daylight, Mint, Sunset, Paper, Clay, Candy, Brutalist |
| **Live style studio** | Accent hue picker, three densities, five typefaces, toggles for animation, glass blur, film grain and ambient light |
| **Export** | CSV · JSON · ICS calendar · Markdown · plain text · print-ready A4 landscape sheet |
| **Private** | Everything lives in `localStorage` — no server, no account, no network calls at all |

---

## The solver

### Hard constraints — never violated

* a class is in exactly one place at a time
* a teacher teaches at most one lesson per slot, and never while marked unavailable
* a teacher's daily maximum is respected
* a room hosts at most one lesson per slot, has enough seats, and matches the subject's required type
* breaks and lunch are never taught in
* per-day caps per subject (e.g. at most one Maths lesson a day)
* double sessions need two consecutive free periods inside a single day
* pinned lessons stay exactly where they were pinned

### Soft constraints — scored and minimised

* subjects spread evenly across the week
* the same subject is not repeated back-to-back (unless it is a deliberate double)
* no idle holes inside a class day or a teacher day
* demanding subjects pulled towards the morning, light ones towards the afternoon
* teacher workload balanced across the week
* a class keeps the same room where possible

### Algorithm

```
for each candidate solution (3 by default, escalating if the data is tight)
  1. place every pinned lesson first
  2. repeat
       pick the Most-Constrained-Variable lesson (fewest legal slots, scanned over a
       constrainedness-ordered queue so specialty rooms and busy teachers go first)
       rank its legal slots by soft cost
       choose from the cheapest few, occasionally exploring, using a seeded PRNG
       commit, then invalidate only the cached option lists that could have changed
     until nothing is left or a dead end is reached
  3. on a dead end: undo the last placement, forbid that slot for it, retry
     (bounded backtracking, then a full restart with new random choices)
  4. polish: lift each lesson out and drop it into its cheapest legal slot, until stable
  5. audit the result independently and compute metrics
keep the best candidate: fewest unplaced → fewest conflicts → highest quality
```

The polish step can never invalidate a solution: lifting a lesson only frees resources, so its
previous slot is always still legal if the new one is worse.

### Quality score

```
quality = 100 × (0.34·completion + 0.26·spread + 0.20·gap-free days + 0.20·staff balance) − conflicts
```

*Spread* and *balance* are measured against what is **achievable**, not against an ideal that the
data cannot reach — a subject with four weekly sessions over five days is scored as perfectly spread
when it lands one per day, and a part-time teacher is not penalised for teaching less than a
full-time one.

### Performance (`npm run bench`)

| dataset | lessons | first solution | 3 candidates | quality | clashes |
|---|---:|---:|---:|---:|---:|
| demo school | 130 | 133 ms | 721 ms | 99 | 0 |
| 8 classes | 128 | 80 ms | 722 ms | 98 | 0 |
| 10 classes | 170 | 108 ms | 831 ms | 98 | 0 |
| 12 classes | 228 | 179 ms | 997 ms | 98 | 0 |

---

## Project layout

```
index.html              app shell + inline SVG icon sprite
styles/
  base.css              reset, design tokens, typography, utilities, motion primitives
  themes.css            the twelve themes (each redefines the whole token set)
  layout.css            app shell, sidebar, header, responsive breakpoints
  components.css        buttons, cards, forms, tables, modals, toasts, palette
  timetable.css         the week grid, lesson blocks, agenda
  views.css             per-view widgets: quality ring, spread matrix, availability picker
  print.css             ink-friendly A4 landscape sheet
js/
  main.js               bootstrap, router, shortcuts, command palette
  scheduler.js          the engine — pure JS, no DOM, importable from Node
  state.js              observable store + localStorage persistence
  seed.js               demo school + random-school generator
  themes.js             theme / density / typeface registry
  exporters.js          CSV · JSON · ICS · Markdown · text
  ui/                   dom helpers, toast, modal, palette, shell
  views/                dashboard, timetable, data, styles, export
tests/
  scheduler.test.mjs    16 engine tests (node:test, no dependencies)
  style-audit.mjs       74 static design-system checks
  smoke.mjs             70 UI checks driving the real app in jsdom
  bench.mjs             solver benchmark
```

---

## Testing

```bash
npm test      # engine: placement, quotas, clashes, pins, diagnostics, determinism, 8 random schools
npm run audit # design system: token coverage, theme completeness, class & icon hygiene, a11y basics
npm run smoke # UI: boots the real app in jsdom, renders every page, drags lessons, pins, exports
npm run bench # solver performance
npm run verify # all three suites
```

The suites are written to catch the bugs that matter here:

* **engine** — every generated timetable is re-audited by an independent validator; a hand-made
  clash is injected to prove the auditor actually catches things; an impossible dataset (a music
  room too small for any class) must report the reason rather than fail silently.
* **audit** — every `var(--token)` used must be defined, every theme must define the full palette,
  every class in a template must be styled, every icon referenced must exist in the sprite, and no
  dead CSS or external network dependency is allowed.
* **smoke** — the app is booted from `index.html` and driven: pages render, the grid has the right
  number of cells, pinning survives a regenerate, an illegal drag is refused *with an explanation*
  and changes nothing, a legal drag moves the lesson and keeps the week conflict-free, all twelve
  themes apply, forms validate, and every export format produces correct output.

---

## Data model

```jsonc
{
  "version": 3,
  "settings": {
    "schoolName": "Northgate Academy",
    "termName": "Autumn Term 2026",
    "days":    [{ "id": "mon", "label": "Mon", "full": "Monday", "active": true }],
    "periods": [{ "key": "p1", "label": "Period 1", "short": "1",
                  "start": "08:30", "end": "09:15", "kind": "lesson" }]
    // kind: "lesson" | "break" | "lunch" — only lessons can be taught in
  },
  "classes":  [{ "id": "c-10a", "name": "10A", "grade": "Year 10", "size": 28,
                 "homeRoomId": "r-101", "hue": 222 }],
  "subjects": [{ "id": "maths", "name": "Mathematics", "code": "MAT", "hue": 222,
                 "teacherId": "t-amara", "weeklyPeriods": 4, "maxPerDay": 1,
                 "sessionLength": 1,          // 2 = taught as doubles
                 "difficulty": 3,             // 3 = demanding → mornings
                 "roomType": "any" }],        // "lab" | "gym" | "studio" | "computer" | "music" | …
  "teachers": [{ "id": "t-amara", "name": "Amara Osei", "initials": "AO",
                 "maxPeriodsPerDay": 6,
                 "unavailable": ["wed@p7", "wed@p8"] }],   // slot key = "<dayId>@<periodKey>"
  "rooms":    [{ "id": "r-lab-a", "name": "Lab A", "capacity": 32, "type": "lab" }],
  "locks":    [{ "lessonId": "maths::c-10a::0", "slotKey": "mon@p1", "dayId": "mon" }]
}
```

Lesson identities are derived (`subjectId::classId::index`), so a pin survives a regenerate even
though the whole week is rebuilt around it. Export **JSON** to back a dataset up, and import it
again from the Export page.

---

## Styling

A theme is a complete redefinition of the design tokens, applied by one attribute on `<html>`:

```css
[data-theme="neon"] {
  color-scheme: dark;
  --bg: #06060a;
  --panel: rgba(10, 255, 190, 0.045);
  --text: #dcfff2;
  --accent-h: 158; --accent-s: 100%; --accent-l: 52%;
  --radius: 7px;
  --subj-s: 90%; --subj-l: 14%; --subj-text-l: 84%;
  /* … */
}
```

Subject colours are **derived, not hardcoded**: each subject carries a hue, and the theme decides
the saturation and lightness, so the same twelve subjects look right on cream paper, on neon black
and in neumorphic clay without a single per-theme override.

The accent is stored as H/S/L too, which is why the hue slider can recolour *any* theme while
keeping that theme's own contrast character.

**Adding a theme:** append a `[data-theme="your-id"]` block to `styles/themes.css` defining the
tokens listed in `REQUIRED_TOKENS` (the audit enforces the full set), then add an entry with a
`preview` palette to `THEMES` in `js/themes.js`. It appears in the sidebar, the style studio and the
command palette automatically.

---

## Keyboard

| | |
|---|---|
| `Ctrl`/`⌘` + `K` | command palette (every action, theme, class and teacher is searchable) |
| `Ctrl`/`⌘` + `P` | the browser's print dialog, pre-styled for the current timetable |
| `G` | generate a new timetable |
| `P` | print the current timetable without leaving the app |
| `1`–`5` | dashboard · timetable · data · styles · export |
| `?` | keyboard shortcut reference |
| `Esc` | close dialog, popover or palette |
| `Enter` on a lesson | open its detail popover |

Motion honours `prefers-reduced-motion` and can be switched off entirely in the style studio.

---

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). The app uses ES modules, CSS custom
properties, `color-scheme` and CSS Grid — and nothing else. No polyfills, no bundler, no CDN.

## License

MIT

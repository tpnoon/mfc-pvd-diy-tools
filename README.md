# MFC PVD DIY Tools

Link: https://tpnoon.github.io/mfc-pvd-diy-tools/

**Language:** **English** · [ไทย](README.th.md)

> **Plan your MFC PVD — the DIY way.**
> Pick the funds you believe in, customize the mix, and see your DIY plan come alive — broker caps built in.

An interactive, bilingual (EN / TH) single-page app for Thai provident fund (PVD) members on the MFC platform. Compare every fund, build a custom portfolio, edit allocations live, and see a four-year projection — all in the browser, no backend, no spreadsheets.

> **Disclaimer.** Rule-based analysis on historical NAV data. NOT certified financial advice. Past performance ≠ future returns. Unofficial — not affiliated with MFC Asset Management.

---

## What you get

**Reference data** (always visible, no inputs needed):
- **Policy Performance** — multi-year line chart for all 32 MPF funds, toggle any combination.
- **Technical Analysis Ranking** — composite score from MA-6/12, MACD, RSI-14, and Fibonacci Retracement on monthly data.
- **Broker Constraints (DIY Plan)** — the 12 allocation rules the engine respects automatically.
- **Policy Rankings & Recommendations** — sorted by 4-year average return, with buy/hold/sell signal per fund.

**Personalized analysis** (after you fill in two sections):
- **1. Your Current Portfolio** — total assets + YTD return + holdings table.
- **2. Strategy** — pick the funds you want; the engine builds the customized portfolio strictly from your picks.
- **3. Customized Portfolio** — snapshot strip (Total Assets / YTD / projected annual profit), editable % per fund, live-recomputed constraint compliance and expected return.
- **4. Old vs New Comparison** — current vs customized portfolio, with expected return sourced from your YTD when provided.
- **5. When to Switch Funds** — strategy-aware switch criteria.

---

## Run locally

```bash
npm install
npm start          # serves on http://localhost:4400
```

Build for production:

```bash
npm run build      # output in dist/
```

---

## Highlights

- **Polished UI** — system font stack, refined color tokens, hairline separators, pill buttons. Light + dark themes with a header toggle.
- **Bilingual** — EN / TH toggle in the header, EN default. App chrome, engine outputs, fund names, and broker rules all translate. Technical terms (RSI, MACD, Strong Buy, etc.) stay in English in both modes.
- **Auto-apply forms** — no Set / Submit buttons. Every change debounces and re-runs the analysis.
- **Strict bias-only allocation** — when you pick funds, the customized portfolio uses **only** those, capped by DIY broker rules. If caps prevent reaching 100%, the gap is surfaced — never silently filled with funds you didn't ask for.
- **Editable percentages** — the Customized Portfolio table is interactive. Edit a row's %; constraint compliance, expected return, and charts update on the fly.
- **Live charts** — Chart.js doughnut + bar + line. Hover any line for per-fund value at that point in time. Theme toggle and language toggle both trigger a chart redraw so colors and labels stay in sync.

---

## How allocations are computed (no LLM)

```
score(fund) = themeMatch × 3
            + rsiBonus × 2          (RSI 30-45 → +3, 45-55 → +1.5, >70 → -2)
            + techBonus × 0.5

themeMatch = Σ tag_weights[tag] + fund_weights[code]   // user picks add +3 per fund

allocate:
  if user has bias picks → STRICT BIAS-ONLY MODE
    equal share across picks, redistribute leftover within picks
    respect DIY broker caps (R1-R12) + theme equity cap
  else (no picks) → DEFAULT MODE
    reserve hedge minimum, then top scorers, then bond/hedge filler
```

All math lives in `src/app/services/analysis-engine.service.ts`. See `recomputeForAllocations()` for the public entry the editable % feature uses.

---

## Architecture

```
src/app/
├── app.component.{ts,html,scss}      ← shell, header, footer, language + theme toggles
├── components/
│   ├── static-overview.component.ts  ← graph + 3 reference tables (always visible)
│   ├── portfolio-input.component.ts  ← Section 1 (auto-applies)
│   ├── theme-selector.component.ts   ← Section 2 (Strategy, custom-only fund picker)
│   └── analysis-output.component.ts  ← Sections 3-5 (Customized Portfolio + Compare + Switch)
├── services/
│   ├── analysis-engine.service.ts    ← deterministic recommendation engine
│   ├── theme.service.ts              ← light/dark signal + localStorage persistence
│   └── i18n.service.ts               ← EN/TH dictionary + translation helpers
├── models/types.ts                   ← shared interfaces
└── utils/chart.util.ts               ← Chart.js registration + cssVar helper
```

State management uses Angular signals (no NgRx/RxJS-heavy patterns). HTTP is `forkJoin` once at startup. Each component has its own `OnDestroy` to clean up Chart instances and timers.

---

## Data sources

All asset bundles live in `src/assets/` and load once on app init:

| File | Purpose |
|---|---|
| `info.json` | Fund metadata (policy code, fund name, group, risk level) |
| `fund_tags.json` | Theme tags per policy code + tag legend |
| `combined_data.json` | Monthly NAV change per policy, 2019-2026 |
| `technical.json` | Pre-computed MA-6/12, MACD, RSI-14, Fibonacci per fund + composite score |
| `constraints.json` | DIY broker allocation rules (R1-R12) |
| `ranking.json` | Policy rankings + 4-year `avg_return` (drives both static rankings table and engine's `avg_4yr`) |

To refresh data: replace the JSON files. The footer "Data through" date is read from `technical.json#generated_date`.

---

## Customize

| You want to… | Where |
|---|---|
| Add a fund | `info.json` + `fund_tags.json` + monthly NAV in `combined_data.json` |
| Re-tag a fund | `fund_tags.json` — see the `tag_legend` for available tags |
| Change a broker rule | `constraints.json` — labels keyed by `R1`–`R12` are translated in `i18n.service.ts` |
| Add an English fund name | `EN_FUND_NAMES` in `i18n.service.ts` (keyed by MPF code) |
| Tweak scoring | `scoreFund()` / `buildRecommended()` in `analysis-engine.service.ts` |
| Add a strategy preset (future) | `themes.json` is still on disk; wiring is removed but the format is preserved |

---

## Security

- Content Security Policy is set in `index.html` with explicit allowlists for Google Fonts and the twemoji CDN.
- No `[innerHTML]`, no `eval`, no `bypassSecurityTrust*` anywhere in the codebase.
- `localStorage` is used only for `mfc-theme` and `mfc-lang` preferences — no PII, no portfolio data.
- All user input flows through Angular's safe interpolation; numeric inputs are clamped at the engine boundary.

---

## Tech stack

- Angular 18 (standalone components, signals, signal-based effects)
- TypeScript 5.4
- Chart.js 4.4 (doughnut + bar + line)
- SCSS with design tokens (CSS custom properties for light + dark themes)
- No external state library — Angular signals cover it
- No backend — every JSON is bundled at build time

---

## License

Released under the [MIT License](LICENSE) — free to use, modify, and host.

This repository is the **open-source core**. A separate **Pro tier** is planned for
features like engine-curated *Recommended Portfolio* (multi-signal scoring), and
will ship from a separate private repository. Bug fixes and community
contributions to the core are welcome.

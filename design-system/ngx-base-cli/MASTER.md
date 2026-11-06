# ngx-base-cli docs: design system (master)

Produced with `ui-ux-pro-max` (`--design-system`), then revised against the
`frontend-design` checklist. The raw recommendation (near-black background,
acid-green accent, JetBrains Mono + IBM Plex Sans, Swiss minimalism) is the
generic "developer tool" look, so it was **not** used as is.

## Idea

The docs are a project folder. ngx-base-cli copies files into your app, so the
interface encodes the one thing readers need to know about every file:

| State | Meaning | Marker |
|-------|---------|--------|
| created | written by ngx-base-cli, now yours | marker pink + the word "created" |
| patched | an existing file the CLI edited in place | cobalt + the word "patched" |
| yours | already in your app, untouched | muted + the word "yours" |

State is never carried by colour alone (WCAG 1.4.1): each marker has a label.

The memorable element is the **terminal at the top of the home page**: it types
`npx ngx-base-cli init` and the generated files appear line by line. Everything
else stays quiet.

## Tokens

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--paper` | `#F3F5F8` | `#0D1220` | page background |
| `--panel` | `#E9EDF3` | `#151C30` | rail, inline code |
| `--ink` | `#141B2D` | `#E7ECF5` | text |
| `--steel` | `#556075` | `#9AA6BD` | secondary text |
| `--rule` | `#D3D9E3` | `#263050` | borders |
| `--cobalt` | `#2540C8` | `#93A8FF` | links, focus, "patched" |
| `--marker` | `#B5124F` | `#FF86B7` | "created" |
| `--code-bg` | `#101729` | `#070B16` | code and terminal (dark in both themes) |

Text on `--paper` meets 4.5:1 in both themes.

## Type

- Text and headings: **Schibsted Grotesk** (400, 500, 700).
- Code, paths, flags: **Geist Mono** (400, 500).
- Body 17px / 1.65, prose width 66ch, left aligned. Headings tight (-0.02em).
- No all-caps labels, no eyebrows, no numbered markers (nothing here is a sequence except "Get started").

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ ngx-base-cli  v0.2.0        [EN|PT] [theme] [GitHub]     │
├───────────────┬──────────────────────────────────────────┤
│ folder-shaped │  page title                              │
│ nav (rail)    │  prose (66ch)                            │
│  modules/     │  code / file list (full width of column) │
│   core        │                                          │
└───────────────┴──────────────────────────────────────────┘
```

Under 56rem the rail collapses behind a "Menu" button.

## Motion

One orchestrated moment (the terminal). Everything else only responds to input
(hover, focus, copy confirmation). `prefers-reduced-motion` shows the final
terminal state immediately.

## Quality floor

Contrast 4.5:1, visible focus (2px cobalt outline), 44px touch targets on
controls, keyboard reachable, responsive from 360px, light and dark themes.

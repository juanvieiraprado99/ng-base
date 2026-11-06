# ngx-base-cli docs: design system (master)

The docs site is built with **Zard UI** (zardui.com), default `neutral` theme.
Zard components are copied into `apps/demo/src/app/shared/components/` with
`zard-cli add <name>`: the same "the code is yours" model as ngx-base-cli itself,
so the site doubles as a second example of that workflow.

An earlier version used a hand-made theme (cobalt/pink tokens, Schibsted Grotesk,
Geist Mono). It was replaced on purpose by the Zard default look.

## Stack

- Tailwind CSS 4 (`@tailwindcss/postcss`), `tailwindcss-animate`, Angular CDK,
  class-variance-authority, `@ng-icons/lucide`.
- Theme tokens (`--background`, `--primary`, `--muted`, ...) live in `src/styles.css`.
  Dark mode is the `dark` class on `<html>`, set before first paint by the
  script in `index.html` and toggled by the `Theme` service.
- `components.json` configures `zard-cli`; aliases `@/shared/...` point to `src/app/shared`.

## Components in use

button, badge, card, tabs, tooltip, sheet, table, empty, sonner. Also installed
and available: accordion, alert, kbd, separator, skeleton, toggle, toggle-group.

| Where | Component |
|-------|-----------|
| Header, language switch, theme toggle, CTAs | `button` |
| Mobile docs menu | `sheet` |
| Latest-version label | `badge` + `tooltip` |
| "What you get" cards | `card` |
| Package-manager variants of a command | `tabs` |
| File list state (created / patched / yours) | `badge` (always with the word) |
| Commands, flags and config reference | `table` |
| Copy feedback | `sonner` toast + live region |
| 404 page | `empty` |

## What stayed from the first design

- The home page terminal (CSS-only, dark in both themes, reduced motion shows the final state).
- File states carry a text label, never colour alone.
- Reading column about 48rem, left aligned (`.docs` rules in `styles.css`).

## Quality floor

Contrast 4.5:1 (Zard tokens), visible focus, keyboard reachable, responsive from 360px,
light and dark themes.

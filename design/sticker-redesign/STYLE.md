# Tasky sticker redesign: how to restyle a component

This is a **look-only** change. The app must behave exactly as before.

## Hard rules

1. Change only `className` strings, inline `style` colours, and add decorative `<Sticker />` elements.
2. Do not change behaviour: no edits to state, effects, handlers, props, data, routing, conditions, or the order and
   nesting of interactive elements. Do not add or remove features, controls, or views.
3. Do not change visible text, `aria-*`, `title`, `role`, ids, or `data-*` attributes.
4. Do not change breakpoints or responsive show/hide logic (`sm:hidden`, `hidden md:flex`, …) and do not change sizes
   that other code depends on (fixed pixel geometry, `calc()` heights, drag hit areas) unless this file tells you to.
5. No new dependencies, no new files except where stated, no renames.
6. Never add `zinc-*`, `gray-*`, `neutral-*` or raw hex colours in components. Use the classes and tokens below.

## How the palette works

`src/app/globals.css` remaps Tailwind's scales, so existing classes already have the new colours:

- `slate-*` now renders as **zinc** (light) and a zinc dark ramp (dark). Keep using `slate-*` for all neutrals.
- `indigo-*` now renders as **ink**: `indigo-600` is near-black in light and near-white in dark. There is no accent hue.
  Existing `focus:border-indigo-500`, `focus:ring-indigo-500/20`, `text-indigo-600` and similar can stay; they now read
  as ink. Do not introduce new colourful accents.
- `bg-white` is the **surface** colour: white in light, `#18181b` in dark. Use it for cards, menus and dialogs.
- `bg-page` is the page background (white / near-black). `bg-tray` is the recessed zinc surface behind lifted cards.
- Category colours come from CSS variables (`--cat-build*`, `--cat-learn*`, `--cal-*`). Build is indigo-blue, Learn is
  magenta. Keep using the variables; never hard-code them.
- Status colours (`rose`, `red`, `amber`, `emerald`) stay as they are.

## Utilities (defined in globals.css)

| Class | Use |
|---|---|
| `btn-ink` | Primary action. Ink gradient, top highlight. Sets its own text colour, border, background and shadow. |
| `btn-paper` | Secondary action. Paper gradient with a hairline border. |
| `card-lift` | Shadow for a white card sitting on a tray or the page. |
| `pop-shadow` | Shadow for floating layers: menus, popovers, dialogs. |
| `bg-tray`, `bg-page` | See above. |
| `sticker` | Applied by the `Sticker` component; do not use directly. |

Stickers (`src/components/Sticker.tsx`: `check`, `clock`, `target`, `flame`) are used **only in the stat strip**, one per
stat, on a small pastel square. Do not add stickers anywhere else: the user called stickers in empty states overuse.

## Dark mode traps

- **Never put `text-white` on a `btn-ink` element or inside it.** In dark the fill is light and the text is dark.
  `btn-ink` sets the colour; icons inherit it through `currentColor`.
- `btn-ink` and `btn-paper` never set `translate`, `scale` or `rotate`, so they are safe on elements positioned
  with `-translate-x-1/2` and similar. Keep it that way: a press state that moves a centred button loses the click.
- Do not write `dark:` variants. Dark mode works through tokens and a few class-keyed rules in globals.css.
- These class combinations are matched by dark rules and must keep working. If an element has them today and is
  **floating dark chrome** (focus bar, toast, tooltip), leave the combination in place:
  `bg-slate-900` together with `rounded-2xl`, `shadow-xl` or `shadow-lg`; `bg-slate-900/95`; scrims
  `bg-slate-900/50`, `/30`, `/20`.
- A dialog panel keeps `bg-white` on the `[role='dialog']` element (or its direct child) so it gets the raised colour.
- Replacing a *primary button* written as `bg-indigo-600 text-white hover:bg-indigo-700` or
  `bg-slate-900 text-white hover:bg-slate-800` with `btn-ink` is the right move. Remove the old background, text colour,
  hover background, border colour and `shadow-*` classes from it when you do.

## Recipes

Follow these so every screen matches. Keep whatever sizing and layout classes the element already has.

- **Primary button**: `btn-ink rounded-xl text-sm font-medium` (heights and padding as before).
- **Secondary button**: `btn-paper rounded-xl text-sm font-medium`. Replaces `border border-slate-200 bg-white
  text-slate-700 hover:bg-slate-50` style buttons.
- **Ghost / icon button**: `rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors`.
- **Destructive**: keep the existing rose/red classes, only fix the radius.
- **Text input, textarea**: `rounded-xl border border-slate-300 bg-page` plus the existing focus classes.
- **`<select>`**: globals.css draws its chevron with `background-image`, so **never put `btn-paper` or `btn-ink` on a
  select**. Use `rounded-xl border border-slate-300 bg-white font-medium text-slate-600`.
- **Radii**: controls `rounded-xl`; small chips and tags `rounded-[7px]` or `rounded-lg`; cards `rounded-2xl`;
  menus and popovers `rounded-2xl` with items `rounded-[10px]`; panels, trays, dialogs and large containers
  `rounded-3xl`. Replace `rounded-md` / `rounded-lg` on controls accordingly.
- **Menu / popover**: `rounded-2xl border border-slate-200 bg-white p-1.5 pop-shadow`.
- **Dialog panel**: `rounded-3xl border border-slate-200 bg-white pop-shadow` (bottom sheets keep their top-only radius,
  use `rounded-t-3xl`).
- **Segmented control**: container `bg-tray rounded-xl p-0.5`, active item `bg-white text-slate-900 shadow-xs
  rounded-[9px]`, inactive `text-slate-500 hover:text-slate-800`.
- **Tray with cards**: `bg-tray rounded-3xl p-3`; cards inside `bg-white border border-slate-200 rounded-2xl card-lift`.
- **Headings**: a view's main title is `font-normal tracking-tight` at a large size (around `text-[28px]`); section
  titles are `font-medium` or `font-semibold` with `tracking-tight`. Column and section headers that are
  `uppercase tracking-wider` at 13px or more become normal case `text-[15px] font-semibold tracking-tight`. Tiny labels
  (11px) may stay uppercase: `text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400`.
- **Numbers, durations, dates, clock times, timers**: add `font-mono tabular-nums`.
- **Count badge**: `rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-mono font-medium text-slate-500`.
- **Active or selected item** (tabs, nav): `bg-slate-100 text-slate-900` pill, not an underline or an indigo colour.
- **Empty state**: `border-[1.5px] border-dashed border-slate-300 rounded-2xl` around the existing grey icon and text.
  No sticker.
- **Drag and drop**: no outline or ring on the drop target column.
- **Stat strip**: white cards (`rounded-[20px] border border-slate-200 bg-white card-lift`), not full pastel tiles.

## Reference

- Already converted, copy their patterns: `src/components/Navbar.tsx`, `StatSummaryStrip.tsx`, `BoardView.tsx`,
  `TaskCard.tsx`.
- Approved mockups: `design/sticker-redesign/mockup-light.png`, `mockup-dark.png`, `calendar-light.png`,
  `calendar-dark.png`, and the HTML sources next to them.

## Before you finish

- `npx oxlint --report-unused-disable-directives` and `npx tsc --noEmit` must both pass. The linter requires a blank
  line between a multi-line statement and its neighbours.
- Do not start the dev server, run a build, run tests, touch `.env*` or any database, and do not commit.
- Report: the files you changed, anything you deliberately left alone, and anything you were unsure about.

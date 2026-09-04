# Wishlist — промпти для розробки

**Джерела істини:** [spec.md](spec.md) · [interactions.md](interactions.md) · [style-guide.md](style-guide.md) · [tech-stack.md](tech-stack.md) · [prompter-task.md](prompter-task.md)

## Як цим користуватися

Шість промптів, **виконувати строго по порядку** — кожен наступний спирається на код попереднього. Кожну стадію запускати окремою сесією Claude Code в корені репозиторію (щоб `docs/` були доступні для читання).

Промпти навмисно **не дублюють** зміст специфікації — вони посилаються на конкретні розділи документів, які Claude Code прочитає сам. У промптах прописано тільки те, що генератор схильний непомітно «спростити»: точні тексти, hard-ліміти, порядок анімацій, ізоляція винятків.

| Стадія | Що робить | Артефакт |
|---|---|---|
| 0 | Каркас проєкту, Tailwind-тема, домен, IndexedDB | `lib/`, `styles/theme.css` |
| 1 | Init-екран + гейт наявності профілю | `app/init/` |
| 2 | «Мої бажання» — хаб | `app/page.tsx`, `components/` |
| 3 | «Додати» — форма | `app/add/` |
| 4 | «Поділитися» + PNG-експорт | `app/share/`, `lib/share/` |
| 5 | Глобальна поведінка + приймання | cross-cutting |

**Приймання** — `interactions.md §7`, чекліст прогоняється вживу в браузері, а не «код скомпілювався».

---

## Stage 0 — Foundation

```
## Role
Act as a senior Next.js/TypeScript engineer setting up a new project from an empty repository.

## Task
Bootstrap the Next.js (App Router) + TypeScript + Tailwind v4 project and build the data/domain layer for the "Wishlist" app, per docs/tech-stack.md. No screens/UI yet — this stage only builds the foundation the next stages build on.

## Context
Read docs/tech-stack.md §1, §4, §5, §6 and docs/spec.md §2 (data model). Read docs/style-guide.md for design tokens — it already contains a ready `@theme` block for Tailwind v4; use it as the starting point, with the corrections below.

## Constraints — project structure & data layer
- Folder structure exactly as in tech-stack.md §5 (`app/`, `components/`, `lib/db/`, `lib/repositories/`, `lib/domain/`, `lib/share/`, `styles/`).
- Data access goes only through `WishRepository` / `ProfileRepository` interfaces (tech-stack.md §4) — implement `IndexedDbWishRepository` / `IndexedDbProfileRepository`. Components must never touch IndexedDB directly.
- `userId` is threaded through every repository call even though it's always `"local-user"` on this stage — intentional prep for stage 2 auth, don't simplify it away.
- `lib/domain/` has zero dependency on React or storage — pure functions only: name validation (trim, 3–15 chars), title validation (trim, required, ≤60 chars), Ukrainian counter pluralization (spec.md §4.1), price formatting with space thousands-separator and currency symbol, URL protocol normalization + soft URL-likeness check, filename transliteration for the share PNG.
- Seed data (spec.md test data table) is inserted only at the same time a profile is first created — not on every empty-DB read (tech-stack.md §6).
- Fonts: load Geist via `next/font` with Inter as the fallback in the stack.

## Constraints — Tailwind theme (this is the part that enforces the design system)
Build `styles/theme.css` with an `@theme` block based on style-guide.md, but make the design rules structurally impossible to violate rather than merely documented:

- Reset each namespace with `--<namespace>-*: initial;` before defining values, so Tailwind's defaults do not leak in. Apply this to colors, radius, and shadows at minimum. Re-add only the specific keys the system needs (including `transparent` / `current` / `white` / `black` if a reset removes ones the app actually uses).
- **Colors:** only Canvas `#f5f5f5`, Paper `#ffffff`, Surface Alt `#fafafa`, Ink `#0a0a0a`, Ink Soft `#171717`, Mid Gray `#737373`, Hairline `#e5e5e5`, Ember `#e7000b`, plus Confetti Amber `#f59e0b`. After the reset, no Tailwind default palette color (`red-500`, `green-400`, …) may exist as a utility.
- **Confetti Amber is not in style-guide.md** — it is a deliberate project-level exception from spec.md §8, valid only on the Share screen. Add it as its own clearly named token with a comment saying where it may and may not be used.
- **Radius:** the `@theme` block in style-guide.md lists `--radius-md: 6px` and `--radius-xl: 14px`, but the product rule allows only 18px (interactive), 24px (cards), and 10px (nested image preview). Drop 6px and 14px entirely so `rounded-md` / `rounded-xl` do not exist. Keep exactly three radius utilities.
- **Shadows:** only the card `shadow-subtle` stack survives the reset. `shadow-sm` / `shadow-md` etc. must not exist, so a shadow can never land on a button, badge, or input.
- **Spacing:** keep Tailwind's dynamic 4px-based scale — it already matches the system's 4px base unit, so no reset is needed here. Add named layout values from style-guide.md that the dynamic scale doesn't give you (page max-width 1280px, card padding 20px, section gap 48–80px).
- **Animation:** `duration-150` / `duration-200` / `duration-300` with `ease-out` come from Tailwind directly — no tokens needed. Add a custom `@keyframes` + animation token for the ~900ms new-card highlight tint (`#ffffff → #f5f5f5 → #ffffff`) described in interactions.md §2.8, since that is a multi-step animation, not a two-state transition.
- **Reduced motion:** add one global `@media (prefers-reduced-motion: reduce)` block that neutralizes transitions and animations app-wide. Per tech-stack.md §6 this belongs in CSS — do not implement it in JS, and do not rely on sprinkling `motion-reduce:` variants across components.
- Add a short comment block at the top of `styles/theme.css` stating the invariants (achromatic except Ember for destructive and Amber for the Share banner only; radius only 18/24/10px; shadows only on cards) so later work reading this file inherits the rules.

## Constraints — scope
Do not build `app/init`, `app/add`, `app/share`, or the list UI yet. `app/layout.tsx` can be a minimal server shell (fonts, theme import).

## Format
1. Init the Next.js + TS + Tailwind v4 project.
2. Build `styles/theme.css` as specified above.
3. Build `lib/domain/` pure functions.
4. Build `lib/db/` (IndexedDB schema/open/migration) and `lib/repositories/` implementations.
5. Wire seed-data-on-profile-creation.
6. Verify: `tsc --noEmit` passes; confirm via a throwaway call that repository create/list/update/remove round-trips against IndexedDB; and confirm the theme lockdown actually holds — a class like `rounded-xl`, `shadow-md`, or `bg-red-500` should produce no styles.
7. Summarize what was built, and list the exact set of allowed color/radius/shadow utilities so later stages can use them without re-reading the style guide.
```

---

## Stage 1 — Init screen

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stage.

## Task
Implement the Init screen (`app/init/page.tsx`) and the profile-existence routing gate.

## Context
Read docs/interactions.md §1 and docs/spec.md §3.0. Read docs/tech-stack.md §3 — this screen cannot be resolved with a server redirect, since profile existence is only known client-side.
Inspect `lib/repositories/ProfileRepository` and `lib/domain/` from the previous stage — reuse the existing name-validation function, don't reimplement it.

## Constraints
- Root page (`app/page.tsx`) must check on the client whether a profile exists; if not, redirect to `/init`. Init page must redirect to `/` if a profile already exists (guards direct navigation).
- Input: autofocus, hard 15-char limit (input simply stops accepting more, not an error shown after), trim before validating and before saving.
- Helper text has exactly two states (interactions.md §1.1) — no live "N/15" counter.
- "Далі" button: disabled until `trim(name).length >= 3`, recalculated on every keystroke; `Enter` triggers the same action as the button only when it's enabled, otherwise silently ignored.
- On confirm: create profile + seed test data together (reuse Stage 0 logic), then fade-transition to `/`. No loading screen — this is a synchronous local write.
- Screen has nothing else on it — no logo, no nav — and must never reappear once a profile exists.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only. The theme is deliberately locked down: if a color, radius, or shadow utility you reach for doesn't exist, that is the design system rejecting it — pick an allowed one, do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens. Hand-written CSS is acceptable only for keyframe animations and the global reduced-motion block. Reduced-motion is already handled globally — do not re-implement it per component.

## Format
Implement, then run the dev server and manually verify in the browser: sub-3-char shows the button disabled and correct hint, 3–15 chars enables it, 16th character is rejected, reload after saving lands on the list, not Init.
```

---

## Stage 2 — «Мої бажання» hub screen

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stages.

## Task
Implement the main hub screen (`app/page.tsx` client content + `components/`) — list, filter, checkmark toggle, inline delete, three empty states, name-edit modal, highlight-on-return.

## Context
Read docs/interactions.md §2 in full and docs/spec.md §3.1/§3.4. Read docs/tech-stack.md §3 for the hydration requirement.

## Constraints — the easy-to-miss parts
- **Hydration:** while IndexedDB read is in flight, render a skeleton — never the empty-state copy — or a populated list will flash "Поки що жодного бажання" for a frame.
- **Counter** always reflects the full unfiltered list, never the filtered subset.
- **Filter** resets to "Усі" on every screen entry and on reload — it is never persisted.
- **✓ and delete icons:** desktop shows them on card hover only (150ms fade); mobile shows them always. Card hover itself only lifts the shadow, no color change.
- **✓ toggle:** optimistic icon flip → 200ms opacity dim → 300ms reflow to the end of the list, ordered by `createdAt` (not by previous position) → counter updates. Reversible, same transition backwards. If the active filter is "Активні", a just-checked card fades/collapses out of view. No confirmation, no confetti, no sound.
- **Delete is inline on the card**, not a modal: card content cross-fades (150ms) to "Видалити бажання? / Скасувати / Видалити" without changing card size. Only one card's confirmation can be open at a time; opening another closes the previous. `Esc` or an outside click cancels. Deletion is final (fade + height collapse, 200ms, no layout jump) — no undo.
- **Three distinct empty states** keyed to (total count, active filter) per the table in interactions.md §2.6 — the filter stays visible in the last two so the user can tell why it's empty.
- **Name-edit modal:** same validation as Init, prefilled with current name, autofocus with cursor at the end, closes on outside click / "×" / `Esc` without saving.
- **Highlight on return from Add:** new card appears at the top of the active group, background tints `#ffffff → #f5f5f5 → #ffffff` over ~900ms (tone, not color), autoscrolls into view if offscreen. Reuse the keyframe animation token from Stage 0.
- Respect `prefers-reduced-motion`: all the above transitions become instant, end states unchanged.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only. The theme is deliberately locked down: if a color, radius, or shadow utility you reach for doesn't exist, that is the design system rejecting it — pick an allowed one, do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens. Hand-written CSS is acceptable only for keyframe animations and the global reduced-motion block. Reduced-motion is already handled globally — do not re-implement it per component.

## Format
Build in this order: static list + cards → filter → empty states → ✓ toggle → inline delete → name modal → highlight-on-return glue (the actual trigger comes from the Add screen in the next stage, so stub how a new card gets flagged for highlighting).
Verify manually in the browser against the interactions.md §7 checklist items covering this screen (add/checkmark/delete/filter/empty-states/name-edit/reload persistence).
```

---

## Stage 3 — «Додати» form screen

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stages.

## Task
Implement the Add screen (`app/add/page.tsx`).

## Context
Read docs/interactions.md §3 and docs/spec.md §3.2. Reuse validation/formatting helpers from `lib/domain/` — don't duplicate logic already built in Stage 0.

## Constraints — the easy-to-miss parts
- Field order exactly as in the docs; title field autofocused, hard 60-char limit, trim.
- Emoji row (8 fixed emoji) and image upload are **mutually exclusive** — picking one clears the other, and the inactive option is visually dimmed to make that obvious. Clicking an already-selected emoji deselects it.
- Image: 5MB limit, JPEG/PNG/WebP/GIF only, checked before reading the file; preview with an "×"; client-side compression to ~1200px on the longer side before it's handed to the repository; inline Ember-colored errors for size/format failures.
- Price: digit-only input, live thousands-space formatting as you type (`3000` → `3 000`); currency select defaults to UAH; zero is valid.
- URL: soft validation only — a non-blocking inline "Схоже, це не посилання" hint if it doesn't look like a URL; `https://` is auto-prepended on save if no protocol is present.
- Submit button disabled until `trim(title)` is non-empty, recalculated on every keystroke; `Enter` in any field submits if the button is enabled; repeated clicks during save are ignored (button locks until navigation completes).
- Cancel: empty form exits immediately with no prompt; any field filled triggers the same inline confirmation ("Скасувати додавання? Введене не збережеться" / "Продовжити редагування" / "Скасувати") on the back button, `Esc`, and hardware back. No draft is ever persisted.
- On save: create the wish via `WishRepository`, navigate to `/`, and flag the new card so the Stage 2 highlight-on-return behavior fires.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only. The theme is deliberately locked down: if a color, radius, or shadow utility you reach for doesn't exist, that is the design system rejecting it — pick an allowed one, do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens. Hand-written CSS is acceptable only for keyframe animations and the global reduced-motion block. Reduced-motion is already handled globally — do not re-implement it per component.

## Format
Implement, then verify in the browser: emoji/image mutual exclusion, 5MB/format rejection messages, price formatting while typing, submit gating, both cancel paths (empty vs dirty), and that the new wish shows up highlighted at the top of the list on return.
```

---

## Stage 4 — «Поділитися» screen

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stages.

## Task
Implement the Share screen (`app/share/page.tsx`) and `lib/share/`.

## Context
Read docs/interactions.md §4 and docs/spec.md §3.3, §8 (Confetti Amber exception — style-guide.md does NOT document this color, it's a deliberate one-off for this screen only).

## Constraints — the easy-to-miss parts
- Banner background is Confetti Amber `#f59e0b`, radius 24px, `#0a0a0a` text — this is the **only** place in the entire app this color may appear. Cards and buttons on this screen stay standard Ui components; don't let the accent bleed into them.
- Completed wishes are fully excluded — from the list and from the banner's count.
- Cards here are simplified (emoji/image, name, price only) and non-interactive — no "Подивитися", no "✓", no delete.
- Share text must match the exact template in interactions.md §4.2: emoji + name (+ " — price" only if price is set, + URL appended only if set), no header decoration beyond the "Список бажань {name}:" line.
- Web Share API primary path; fallback (typically desktop) copies the same text to the clipboard and swaps the button label to "Скопійовано ✓" for 2 seconds — no toast component anywhere.
- "Зберегти як картинку" renders banner + cards only (no app chrome/buttons) to PNG, background `#f5f5f5`, filename `wishlist-maryana.png` (transliterated, lowercase — reuse the Stage 0 transliteration helper). Button shows a pending/disabled state during generation; inline "Не вдалося створити картинку" on failure.
- **PNG export:** `html-to-image` clones the target node to rasterize it. Verify the exported PNG actually carries the banner's Amber background, the card borders, and the fonts — Tailwind-applied styles can be lost if the clone is detached from the styled tree. Check the real output file, not just that the download fired. Emoji rendering in the PNG is the riskiest part (tech-stack.md §6) — confirm the glyphs survive.
- Empty state (no active wishes): banner still renders with "0 бажань", cards replaced by the specified empty-state text, and **both** action buttons are disabled.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only. The theme is deliberately locked down: if a color, radius, or shadow utility you reach for doesn't exist, that is the design system rejecting it — pick an allowed one, do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens. Hand-written CSS is acceptable only for keyframe animations and the global reduced-motion block. Reduced-motion is already handled globally — do not re-implement it per component.

## Format
Implement, then verify in the browser: banner color is isolated to this screen only, completed wishes never appear, share text matches the template exactly for a wish with and without price/URL, clipboard fallback shows the 2s label swap, PNG downloads with the correct filename and renders correctly when opened, empty state disables both buttons.
```

---

## Stage 5 — Полірування та приймання

```
## Role
Act as a senior QA-minded engineer doing a final pass across the whole app built in the previous stages.

## Task
Close the cross-cutting gaps that don't belong to any single screen, then run the full acceptance checklist.

## Context
Read docs/interactions.md §0 (global nav/persistence/keyboard/animation rules), §7 (acceptance checklist) and §8 (do-not list), plus docs/spec.md §6 and docs/prompter-task.md §8, in full.

## Investigation
Before changing anything, walk the running app and check against §0 and §7 point by point — note which items already pass from the previous stages and which don't, rather than assuming everything is done.

## Implementation (only for what's actually missing)
- Global keyboard map: `Tab` order follows reading order everywhere, `Space`/`Enter` toggles "✓", `Esc` behavior is consistent across every modal/inline-confirmation, focus-visible ring is the hairline `#e5e5e5` ring everywhere (not just on inputs).
- Animation durations (150/200/300ms, ease-out) are centralized, not re-typed per component, and `prefers-reduced-motion: reduce` collapses all of them to instant app-wide — verify this once at a global level rather than per-component.
- Storage-unavailable path (private browsing / quota exceeded): inline "Не вдалося зберегти" at the point of the failed action, app doesn't crash, the attempted change doesn't apply.
- Back-navigation parity on Add and Share: hardware back / browser swipe behaves identically to the on-screen "←".
- Mobile: single column instead of the grid, "Додати" pinned to the bottom of the screen, card action buttons always visible (no hover available).

## Constraints
- Do not add anything from the "do not build" lists (interactions.md §8, spec.md §6, prompter-task.md §8): no 5th screen, no settings, no wish editing, no undo, no draft persistence, no search/sort/categories/tags, no stray colors beyond Ember and the Share-screen Amber exception, no shadows on buttons/badges/inputs, no radius other than 18/24px, no toasts/snackbars, no illustrations or image icons.

## Verification
Run every line of interactions.md §7 live in the browser, including a full page reload to confirm wishes and the name survive it. Report which items pass and which still need a fix, rather than declaring done without having checked each one.
```

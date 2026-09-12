# Wishlist — промпти для розробки: бронювання бажань гостями

**Завдання:** [prompter-task-reservations.md](prompter-task-reservations.md)
**База:** [stage-2.md §2, §5.3, §5.4, §7-bis, §9](stage-2.md) · [style-guide.md](style-guide.md)
**Потребує:** `/w/{token}`, MongoDB, Server Actions з етапу 2 — уже в коді.
**Попередні промпти:** [dev-prompts-stage-2.md](dev-prompts-stage-2.md) · [dev-prompts-edit-wish.md](dev-prompts-edit-wish.md)

## Як цим користуватися

Три промпти в порядку залежностей. Кожен окремою сесією Claude Code в корені репозиторію.

| Промпт | Що робить |
|---|---|
| 1 | Дані, індекси, `guestId`, каскади, ізоляція запиту власника від гостьового |
| 2 | UI бронювання на картці `/w/{token}` — чотири стани, інлайн-форма |
| 3 | Приймання, включно з перевіркою мережевої відповіді в DevTools |

---

## Що вже є в коді і що з цього випливає

**1. Ізоляція власника — не гіпотетичний ризик, а вже наявна форма коду, яку легко зіпсувати.** `lib/share/guestList.ts` — `loadGuestList(token)` — резолвить власника за токеном і повертає його бажання **однаково** для гостя і для власника, який відкрив власне посилання; `isOwner` у `app/w/[token]/page.tsx` лише додає підпис «Так твій список бачать друзі», дані ті самі. Якщо приєднати `Reservation` усередину цієї ж функції й ховати бейджі умовою `if (!isOwner)` у шаблоні — це і є той «один спільний запит», який §5 просить не робити, тільки він уже існує, а не гіпотетичний. Промпт 1 вимагає розвести це на рівні запиту, а не рендеру.

**2. `/w/{token}` зараз працює без JS — і це навмисно, не випадково.** Коментар у `components/guest/GuestWishCard.tsx` прямо каже: «Server Component з нульовою інтерактивністю... саме це дозволяє гостьовому екрану працювати з вимкненим JS». Бронювання — перша інтерактивна дія на цьому екрані. Завдання не каже явно, чи має вона й далі працювати без JS. Промпт 2 просить свідомо вирішити це, а не мовчки зламати властивість, яку решта коду вважає важливою.

**3. Право власності на мутації вже перевіряється фільтром запиту, не порівнянням постфактум.** `MongoWishRepository` (`lib/repositories/MongoWishRepository.ts`) скоупить `update`/`remove` через `{_id, userId}` у самому запиті. Каскад видалення `Reservation` додається **поруч**, на рівні `app/actions/wishes.ts`, за тим самим прийомом, що вже використаний для видалення файлу з Cloudinary в `removeWishAction` — мутація спочатку, побічний ефект після успіху.

**4. Індекси створюються одним скриптом.** `scripts/ensure-indexes.mjs` — точка, куди додаються нові unique-індекси; `npm run db:indexes` — команда, якою це перевіряти. Другий шлях створення індексів заводити не треба.

---

## Промпт 1 — Дані, каскади, ізоляція запитів

```
## Role
Act as a senior Next.js/TypeScript engineer extending an existing, working codebase. This is a scoped increment, not a rewrite.

## Task
Add the `Reservation` collection, its indexes, the `guestId` cookie issuance, the reserve/cancel Server Actions with their race-condition handling, and the cascade deletes. Also fix the query-isolation risk described below before any reservation join is added to it. No card UI in this prompt — that's the next one.

## Review — inspect before writing anything
Read docs/stage-2.md §2, §5.3, §5.4, §7-bis and docs/prompter-task-reservations.md §2, §3, §5, §6.
Then inspect: `lib/db/mongo.ts` (collection/client pattern), `scripts/ensure-indexes.mjs` (index pattern — extend this, don't create a second path), `lib/repositories/MongoWishRepository.ts` (the `{_id, userId}` filter-level scoping this feature's isolation must match in spirit), `lib/share/guestList.ts` and `app/w/[token]/page.tsx` (the function this prompt must split), `app/actions/wishes.ts` — specifically `removeWishAction` and `setWishDoneAction` (cascade hook points, and the existing "mutate first, clean up dependent state after success" pattern already used there for Cloudinary), `lib/auth/session.ts` (`requireUserId`/`currentUserId` pattern to mirror for guest identity), `lib/domain/validation.ts` (existing validator shapes — add `validateGuestName` alongside them rather than inlining an ad hoc check).

## Findings you must resolve, not just note
1. **`loadGuestList(token)` currently serves the owner's own view of `/w/{token}` and a stranger's view through the identical query.** `isOwner` in the page component only changes a caption; the wish data is the same call either way. Joining `Reservation` into this function and hiding it in the template for the owner (`if (!isOwner) …`) is exactly the fragile pattern prompter-task-reservations.md §5 warns against — a condition that a future refactor can silently drop. Restructure so the owner-viewing-their-own-link path calls the **same plain query the hub already uses** (`wishRepository.list(userId)`, no join, no `Reservation` collection touched at all), and only a distinct function — reachable exclusively when the viewer is not the owner — ever queries `Reservation`. Say which shape you chose (e.g. the page branches before calling one of two loaders, vs. one loader that internally dispatches on viewer identity) and why. The owner's own view of `/w/{token}` must end up rendering exactly as it does today — no reservation button, no badge, nothing — not merely "the same minus a hidden element."
2. **The two functions must be genuinely unreachable from each other's callers**, not just conventionally separated. Put the guest-only reservation-joining query in a module the hub (`components/WishlistScreen.tsx`, `app/actions/wishes.ts`) has no reason to ever import, so the isolation is structural, not a comment promising discipline.

## Specify — data model
`Reservation` exactly as in stage-2.md §2: `wishId`, `listOwnerId` (denormalized for the indexes), `guestId`, `guestName` (1–30 chars, trimmed), `createdAt`.

Extend `scripts/ensure-indexes.mjs` with:
- `unique(wishId)` — one reservation per wish.
- `unique(listOwnerId, guestId)` — one reservation per guest per list. This is a correctness guarantee against a double-click or a request race, not an optimization — do not skip it because the application layer also checks.

## Specify — guest identity
- `guestId`: random, unguessable (not derived from anything a client sends), issued **only inside the reserve Server Action, only on its first successful reservation** — never on page view, never speculatively.
- Cookie flags: httpOnly, `sameSite=lax`, `path=/`, 1 year.
- **Reading** the incoming `guestId` (to compute a card's state at render time) happens in the Server Component render of `/w/{token}` via a read-only `cookies()` call. **Writing** it can only happen inside a Server Action (Next.js does not allow `cookies().set()` during a Server Component render) — make sure the read path and the write path are not accidentally merged into one function that tries to do both in the wrong context.

## Specify — reserve / cancel actions
- `reserveWishAction(wishId, guestName)`: validate `guestName` server-side with the new `validateGuestName` (trim, 1–30), issue `guestId` if absent, insert the `Reservation`. Follow the existing typed-result convention already used by `updateWishAction` (`{ ok: true, ... } | { ok: false, reason: ... }`) rather than throwing — this codebase does not use thrown error identity across the Server Action boundary, and the caller needs to distinguish a validation failure from a lost race.
- **Race condition:** catch the Mongo duplicate-key error (code `11000`) from the `unique(wishId)` insert and return it as a distinct `{ ok: false, reason: 'already-reserved' }` rather than a generic failure — the card needs to tell "someone beat you to it" apart from "something broke".
- `cancelReservationAction(wishId)`: resolves the caller's `guestId` from the cookie, deletes the reservation only if `guestId` matches — no confirmation step, per §4's "symmetric to ✓" framing.

## Specify — cascades
Both hooked in at the Server Action layer (`app/actions/wishes.ts`), after the wish mutation succeeds, mirroring how Cloudinary cleanup is already sequenced there:
- `removeWishAction`: after the wish is removed, also delete any `Reservation` for that `wishId`.
- `setWishDoneAction`: only on the branch where `isDone` is being set to `true`, delete any `Reservation` for that `wishId`. Un-checking (`isDone → false`) does **not** restore it — once gone, it's gone, per stage-2.md §5.4's edge-case table.
- Editing title/price/currency/url/image (`updateWishAction`) must **not** touch `Reservation` at all — confirm this by inspection rather than assuming, since it's easy to lump into the same "wish mutation" mental bucket.

## Constraints
- The 30-wish limit and its counting are untouched — `Reservation` is a separate collection, not a wish.
- No rate limiting on reservation creation — explicitly out of scope per stage-2.md §9.
- Do not build any card UI, any new component, or touch `GuestWishCard.tsx` in this prompt.

## Format
1. Extend the index script and run `npm run db:indexes`; confirm both unique indexes exist.
2. Add the `Reservation` type, the guest-identity helpers, the two Server Actions, and the cascades.
3. Restructure the owner-vs-guest query split in `loadGuestList` / `app/w/[token]/page.tsx`.
4. Verify without going through the UI: a second insert for the same `wishId` is rejected and surfaces as `'already-reserved'`, not a 500; a second insert for the same `(listOwnerId, guestId)` on a different wish is rejected; deleting a wish deletes its reservation; setting a wish done deletes its reservation but un-setting it does not resurrect one; editing a wish's title leaves its reservation untouched; calling the owner-branch loader never issues a query against the `reservations` collection (check this directly, e.g. by temporarily logging or stepping through — don't just assume the branch is right because it compiles).
5. Report which architecture you chose for the owner/guest query split and why.
```

---

## Промпт 2 — UI бронювання на картці

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous prompt.

## Task
Build the reservation UI on `/w/{token}` cards: the four render states, the inline name form, and the interaction flow — for guests only. The owner's own view of their link must render exactly as it did before this feature.

## Review
Read docs/stage-2.md §5.4 and docs/prompter-task-reservations.md §4 in full.
Inspect `components/guest/GuestWishCard.tsx` (today's plain, non-interactive card — kept as-is for the owner branch per the previous prompt), `components/wishlist/WishCard.tsx` §2.5's inline delete-confirmation cross-fade (the interaction pattern to mirror: content swap in place, no modal, no resize), `components/wishlist/NameModal.tsx` (the autofocus-with-cursor-at-end pattern, reusable here for a simpler autofocus-on-empty-field case), `components/ui/Badge.tsx` and `components/ui/Button.tsx` (`outline` variants — reuse them, don't invent new ones).

## Finding you must decide, not silently resolve either way
**The guest card is currently a pure Server Component and the page works with JavaScript disabled — this is called out as deliberate in its own comment.** Reservation adds unavoidable interactivity: an inline name field, Enter-to-submit, an immediate optimistic "Заброньовано тобою" state, and — the part that actually forces a client boundary — **every other card's «Забронювати» button must disappear the moment one reservation succeeds**, which means the buttons need to react to shared state across cards on the same page, not just their own.

Pick one of these, and say which:
- **(a) Progressive enhancement.** Bind `reserveWishAction` / `cancelReservationAction` to real `<form action={...}>` elements. A no-JS visitor gets a full page reload after submitting, which re-renders every card from fresh server data — buttons update correctly, just without the inline cross-fade or the "immediate" feel. Layer a Client Component on top purely for the 150ms cross-fade and the optimistic same-card update; the cross-card button hiding can then either wait for the action's revalidation or be driven by lifted client state.
- **(b) Client-rendered grid.** The page keeps fetching the initial list server-side (so a first load is still fast and correct for the current cookie), but the wish grid becomes a Client Component fed that data as props, holding reservation state in memory so any card's successful reserve can immediately hide the button on its siblings. This drops no-JS support for the interactive layer specifically, while the rest of the page (banner, OG tags, not-found handling) stays server-only.

Either is acceptable; do not pick silently and do not blend them halfway (e.g. a form action that also assumes client JS ran).

## Specify — the four render outcomes (docs/stage-2.md §5.4 table)
Computed server-side per card, from `Reservation.guestId` compared against the request's `guestId` cookie:

| State | Render |
|---|---|
| Free, this guest holds no reservation anywhere on this list | Outline Button «Забронювати» |
| Reserved by someone else | Badge Soft «Заброньовано: {guestName}», no action |
| Reserved by this guest | Badge Outline «Заброньовано тобою» + Outline Button «Скасувати бронювання» |
| Free, but this guest already holds a reservation elsewhere on this list | No button, no badge — the card looks exactly like one with no reservation feature at all |

## Specify — the reserve flow
1. Click «Забронювати» → inline, on the card itself, same treatment as the existing delete confirmation: content cross-fades (150ms), no modal, no resize. Reveals a «Як тебе звати?» field (autofocus, `trim`, 1–30 chars) and «Підтвердити» (disabled while empty).
2. `Enter` in the field submits if valid.
3. On confirm: call `reserveWishAction`. Success → this card shows "reserved by you" immediately; every other card's «Забронювати» disappears. Duplicate-key race (`'already-reserved'`) → show «Хтось інший щойно забронював це» and refresh this card's state from the server rather than trusting the optimistic guess.
4. «Скасувати бронювання» → calls `cancelReservationAction` immediately, no confirmation step (symmetric to the ✓ button on the owner's own screen). Buttons return on the rest of the list.

## Constraints
- No color outside the existing system — Badge Soft/Outline already exist, no new token.
- «Забронювати» and «Скасувати бронювання» are the same Outline size/weight as each other; they must not visually compete with the page's main CTA («Створити свій список»).
- Nothing here changes `app/page.tsx`, `AddScreen`, `WishForm`, `ShareScreen`, or the owner's own `/w/{token}` render path.

## Format
Implement your chosen architecture end to end for one card first, then wire the whole grid. Verify in the browser with two different browser profiles (or one normal + one incognito) acting as two guests: the first guest's reservation shows correctly to the second; the second guest sees no button on that card and normal buttons elsewhere; cancelling returns the button; a deliberately-forced double-submit on the same wish from two tabs surfaces the race message on the loser without leaving a duplicate in the database. State explicitly whether the reservation flow still functions with JavaScript disabled, per the architecture you picked.
```

---

## Промпт 3 — Приймання

```
## Role
Act as a senior QA-minded engineer verifying the reservation feature end to end.

## Task
Run the full acceptance checklist from prompter-task-reservations.md §7, with particular weight on the owner-isolation requirement, which needs to be checked in the actual network response, not just the UI.

## Context
Read prompter-task-reservations.md §7 and stage-2.md §5.4's edge-case table.

## Investigation
Walk through every checklist line and record pass/fail with what you actually observed — do not mark anything passed without having produced the observation described.

Weight these three specifically:

1. **«Власник ... не бачить жодних слідів бронювання — перевірено і в UI, і в мережевій відповіді».** Open DevTools, go to `/` (the hub) and to the owner's own `/w/{token}` link while signed in, and inspect the actual network payload the page/action returns — not just what's rendered. Confirm no `reservation`-shaped field, count, or hint appears anywhere in it, for a list that has at least one wish reserved by a guest.
2. **The race condition.** Trigger two near-simultaneous reservation attempts on the same wish (two tabs, two profiles) and confirm exactly one `Reservation` document exists afterward, and the loser gets the "someone else just reserved this" message rather than a crash or a silent duplicate.
3. **Cascades.** Reserve a wish, then from the owner's side: delete it (reservation gone), mark it done (reservation gone, un-marking does not bring it back), and edit its title/price/image (reservation untouched). Verify each directly against the database or the guest view, not by assumption.

## Regression checks (docs/prompter-task-reservations.md §6)
- `/`, `/add`, `/edit/{id}`, the owner's `/share` — unchanged.
- Ownership enforcement on wish mutations (create/edit/toggle/delete) — unaffected by this feature; reservations are a parallel, separate check, not a replacement.
- The 30-wish limit — unaffected; confirm a reserved wish still counts as exactly one toward it, same as before.
- `guestId` cookie does not appear before a first successful reservation; is httpOnly (confirm it is not readable from `document.cookie` in the browser console).

## Constraints
Do not add anything beyond this feature's scope: no rate limiting, no reservation migration into accounts, no owner-side reservation view or count, no reservation cancellation by the owner. If you find a genuine problem outside this feature while testing, report it rather than fixing it.

## Format
Report the checklist as pass/fail with evidence for each line. For anything you could not verify directly (rather than by inspection of the code), say so explicitly instead of marking it passed.
```

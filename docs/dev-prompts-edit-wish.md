# Wishlist — промпти для розробки: редагування бажання

**Завдання:** [prompter-task-edit-wish.md](prompter-task-edit-wish.md)
**База:** [interactions.md](interactions.md) · [spec.md](spec.md) · [stage-2.md](stage-2.md) · [style-guide.md](style-guide.md)
**Попередні промпти:** [dev-prompts.md](dev-prompts.md) (етап 1) · [dev-prompts-stage-2.md](dev-prompts-stage-2.md) (етап 2)

## Як цим користуватися

Три промпти в порядку залежностей — не в порядку розділів завдання. Кожен окремою сесією Claude Code в корені репозиторію.

| Промпт | Частина завдання | Чому такий порядок |
|---|---|---|
| 1 | §5 — власність, серверний шар, `updateWishAction` | Формі потрібен екшен, який вона викличе |
| 2 | §3, §4 — `/edit/{id}`, форма у двох режимах, картинки | Маршрут має існувати до появи кнопки на нього |
| 3 | §2 — олівець на картці + §8 приймання | Точка входу остання; до неї маршрут перевіряється URL-ом |

---

## Що вже є в коді (перевірено перед написанням промптів)

Завдання місцями описує роботу, яка вже зроблена, і місцями пропонує рішення слабше за наявне. Три речі, які варто знати до старту — вони враховані в промптах.

**1. Власність уже перевіряється на сервері, включно з `toggleDone` і `delete`.** `lib/repositories/MongoWishRepository.ts` скоупить кожен запит фільтром `{_id: target, userId: owner}` — чужий власник дає нуль документів, замість «дістань і порівняй». `update` уже кидає ідентичний `not found` і для чужого, і для неіснуючого id. Усі екшени в `app/actions/wishes.ts` резолвлять власника через `requireUserId()` і не приймають `userId` від клієнта.

Тому хелпер `requireOwnedWish(id, session)` з §5 **не має замінювати** цей скоупінг — fetch-then-compare слабший, і коментар у репозиторії пояснює чому. Хелпер потрібен лише як читальний шлях для лоадера `/edit/{id}`.

**2. Тап-таргети на картці зараз 32px.** «✓» і кошик у `components/wishlist/WishCard.tsx` — `h-8 w-8`. Вимога ≥44px з §2 стосується і їх, не тільки нового олівця.

**3. Зелений колір уже порушує дизайн-систему.** `styles/theme.css` містить `--color-green`, і `WishCard.tsx` застосовує `border-green!` до здійсненого бажання. Це суперечить `spec.md §8` («приглушення через opacity, не через новий колір»), `prompter-task.md §8` («ніяких зелених "успіхів"») і §7 цього завдання. Закривається в промпті 3.

---

## Промпт 1 — Власність і серверний шар

```
## Role
Act as a senior Next.js/TypeScript engineer working in an existing, fully working codebase. This is a scoped increment, not a rewrite.

## Task
Prepare the server side for wish editing: a read path for the edit page, and an `updateWishAction` that keeps the existing security discipline intact. Audit ownership enforcement across all wish mutations.

## Review — inspect before changing anything
Read docs/prompter-task-edit-wish.md §5, §6.
Then inspect what already exists: `app/actions/wishes.ts` (the whole mutation surface, and the comment block at the top explaining why the actions take narrow arguments), `lib/repositories/MongoWishRepository.ts`, `lib/repositories/types.ts`, `lib/auth/session.ts`.

## Findings — verify each in the code, then act accordingly
1. **Ownership is already enforced on every mutation, including `toggleDone` and `delete`.** The repository scopes every query by `{_id, userId}` at the filter level, so a wrong owner matches zero documents, and `update` already throws an identical "not found" for a foreign id and a missing one. Confirm this yourself. §5 asks for a `requireOwnedWish` helper and says the existing mutations should be routed through it "if they don't already" — they do, by a stronger mechanism. **Do not replace filter-level scoping with fetch-then-compare**: that would be a regression, and the repository comment explains why. Add the helper only as the read path the edit page needs (return the owned wish or trigger a 404), and say what you did rather than silently skipping §5.
2. **The actions deliberately refuse a general patch object.** The comment in `app/actions/wishes.ts` spells out the reason: an action accepting a broad `WishPatch` would let any direct caller set `createdAt` — silently reordering someone's list — or set `imageUrl`/`imagePublicId` to an arbitrary value, orphaning the real Cloudinary file. Your new `updateWishAction` must keep that discipline: accept only the fields the edit form actually edits (title, emoji, price, currency, url, and the image as a `File` plus an explicit "image removed" signal). It must not accept `isDone`, `createdAt`, `imageUrl`, or `imagePublicId` from the caller.

## Specify
- `updateWishAction` resolves the owner via `requireUserId()`, validates `title` server-side with the existing `validateTitle` (the boundary re-checks what the form already checked), and re-checks any uploaded file with the existing `rejectImage`.
- **`createdAt` is never written** — the card's position in the list depends on it (§3.4), and a fix to a typo must not throw the card to the top.
- **`isDone` is never written** by this action — it belongs to the ✓ button.
- **Image lifecycle, per the four cases in §4. The single rule: Cloudinary is only touched after the database write succeeds.**
  - New image replacing an old one → upload the new file, write the record, and only then destroy the old `publicId`. Destroying first means a failed write leaves the wish with no image at all.
  - Image removed via "×" → clear `imageUrl`/`imagePublicId`, fall back to the selected emoji or `🎁`, then destroy the old file after the write succeeds.
  - Emoji chosen over an existing image → same as removal.
  - Edit cancelled → nothing is uploaded and nothing is destroyed. Since cancellation never reaches the server, verify that no upload happens before submit.
  - Reuse the existing `destroyImage` / `uploadImage` from `lib/images/cloudinary.ts`. Keep `destroyImage`'s existing behavior of swallowing its own failures — an orphaned file is better than a failed save.
- **The 30-wish limit is not checked here.** Editing creates no records (§7). Don't copy the limit guard from `createWishAction`.
- **A wish deleted from another tab while the form is open:** the update finds nothing and the action reports it as not-found, so the screen can show «Це бажання вже видалене» and navigate to the list (§6). Make sure that case is distinguishable by the caller from a generic failure.
- Route protection: `/edit/{id}` must require a session and redirect to `/login` like `/`, `/add` and `/share` already do. Find how those are protected and extend the same mechanism — don't add a second one.

## Maintain
Do not change the signatures or behavior of `createWishAction`, `setWishDoneAction`, `removeWishAction`, or `renameProfileAction`. This prompt adds a read path and one new action; the existing surface stays as it is.

## Format
Implement, then verify without going through the UI:
- `npm run typecheck` and `npm run build` pass.
- Calling `updateWishAction` for a wish belonging to another account is rejected, and the response is indistinguishable from calling it for an id that doesn't exist.
- Calling it with an `id` that isn't a valid ObjectId returns not-found rather than throwing a 500.
- Report what you found about the existing ownership enforcement, and exactly which fields your new action accepts.
```

---

## Промпт 2 — `/edit/{id}` і форма у двох режимах

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous prompt.

## Task
Add the `/edit/{id}` route and refactor the existing Add form to serve both modes from one component.

## Review
Read docs/prompter-task-edit-wish.md §3, §4, §6, §7.
Inspect the form as it stands: `components/AddScreen.tsx`, `components/add/EmojiPicker.tsx`, `components/add/ImageUpload.tsx`, `components/add/compressImage.ts`, `app/add/page.tsx`. Also inspect `components/WishlistScreen.tsx` to see how the existing new-card highlight is triggered on return from Add (interactions.md §2.8) — you will reuse that mechanism, not build a second one.

## Specify — one component, two modes
**Reusing the existing form is a requirement, not a preference (§3.1).** Fields, order, validation, emoji/image mutual exclusion, space-separated price formatting, automatic `https://`, the 60-character title cap — all of it already works and must behave identically in both modes. Pass the mode as a prop. A duplicated form means every future change has to be made twice, and one time it won't be.

Differences between the modes, per the table in §3.2:

| | `/add` | `/edit/{id}` |
|---|---|---|
| Heading | «Додати бажання» | «Редагувати бажання» |
| Submit label | «Додати бажання» | «Зберегти зміни» |
| Initial field values | empty | current values |
| Autofocus | «Що це?», empty | «Що це?», caret at end of text |
| Submit enabled when | title non-empty | title non-empty **and** at least one field changed |
| Cancel confirms when | any field filled | any field **changed** |

**The dirty check is the substantive part.** The form holds the initial state and compares against current. An enabled "Зберегти зміни" that saves nothing reads as broken; a «Скасувати зміни?» prompt when nothing changed is pure friction.

One wrinkle to handle deliberately: the image can't be compared by value. The initial state is a remote `imageUrl`, while a new selection is a `File` — there is nothing to diff. Treat the image as changed when a new file has been selected or the existing image was removed, and say how you modelled it.

## Specify — saving
1. The record updates; `createdAt` is untouched.
2. Navigate to «Мої бажання».
3. The card highlights **in place**, using the same tone animation as a new card (`#ffffff → #f5f5f5`, ~900ms). Reuse the existing highlight mechanism.
4. **The card's list position does not change.** Sorting is by `createdAt`, which wasn't touched.
5. A done wish stays done and stays in its group.

## Specify — edge cases (§6)
- Wish deleted from another tab while the form is open → on save, «Це бажання вже видалене», then navigate to the list.
- `/edit/{id}` for another account's wish → 404, with no hint that the record exists.
- `/edit/{id}` for a nonexistent id → the identical 404.
- `/edit/{id}` unauthenticated → redirect to `/login`.

## Maintain
- **`/add` behavior does not change at all.** It is the thing most likely to break in this prompt, since its form is the one being refactored. Re-verify it deliberately rather than assuming.
- The guest screen has no edit route and no edit affordance. Confirm `components/guest/GuestWishCard.tsx` stays untouched.
- No changes to the ✓ toggle, inline delete, filter, empty states, or the counter.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only, and reuse the `components/ui/` primitives. If a color, radius, or shadow utility you reach for doesn't exist, that is the design system rejecting it — pick an allowed one. Do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens. Reduced-motion is handled globally.

## Format
Refactor first and confirm `/add` still works, then add the edit route. Verify in the browser: the form opens prefilled; the caret sits at the end of the title; "Зберегти зміни" is disabled until something actually changes and disabled again if the title is emptied; cancelling with no changes exits immediately while cancelling with changes asks; after saving the card highlights where it already sat and did not move; editing a done wish leaves it done and in the done group; a foreign id and a garbage id both render the same 404; and `/add` creates wishes exactly as before.
```

---

## Промпт 3 — Олівець на картці, тап-таргети, приймання

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous prompts.

## Task
Add the edit affordance to the wish card, fix the touch target sizes, remove a design-system violation, then run the acceptance checklist.

## Review
Read docs/prompter-task-edit-wish.md §2, §7, §8.
Inspect `components/wishlist/WishCard.tsx` and `components/wishlist/TrashIcon.tsx`.

## Specify — the pencil button
- «✓» stays on its own as the primary action, where it is now.
- The pencil and the trash sit as a group in the opposite corner, **pencil before trash** — the destructive action goes last so it isn't hit by accident.
- Visibility follows the existing rule, unchanged: desktop reveals on card hover (150ms fade), touch keeps them visible. Reuse the exact classes the ✓ and trash already use rather than writing a new variant.
- Thin geometric icon matching the others, `#0a0a0a` / `#737373` at rest. **Not Ember** — editing isn't destructive.
- Give it a real `aria-label`, and keep it out of the tab order while the delete confirmation is open, exactly as the sibling controls do.

## Findings to fix in this prompt
1. **The existing controls are 32px, below the 44px §2 requires.** ✓ and trash are `h-8 w-8`. Bringing the card to ≥44px touch targets means resizing those two as well, not just sizing the new pencil. Verify at a mobile width that three buttons fit without squeezing the wish title — that is an explicit acceptance item, so check it rather than assuming.
2. **A green border on done wishes violates the design system.** `styles/theme.css` defines `--color-green` and `WishCard.tsx` applies `border-green!` when `wish.isDone`. This contradicts spec.md §8 («здійснене бажання — приглушення через opacity / Mid Gray, **не** через новий колір»), prompter-task.md §8 («ніяких зелених "успіхів"»), and §7 of the current task, which lists the palette rule among the things that must not break. Note that the lockdown comment in `styles/theme.css` exists specifically to make a stray green impossible, and the token was added directly below it, defeating that mechanism.
   Remove both the `border-green!` usage and the `--color-green` token, and restore the opacity-based dimming the docs specify. If the green was a deliberate product decision, it belongs in the docs first — flag it and leave it rather than guessing.

## Maintain — verify, don't assume (§7)
- `/add` works exactly as before.
- ✓ still dims the card, moves it to the end of the list, and is reversible.
- Inline delete still replaces the card content in place, with only one confirmation open at a time.
- Filter, the three empty states, and the new-card highlight all unchanged.
- The 30-wish limit is untouched by editing, which creates no records.
- Radii stay 18/24px, Ember stays destructive-only, shadows stay on cards only.

## Constraints — styling
Tailwind utilities from `styles/theme.css` only; reuse `components/ui/` primitives. Do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens — and specifically do not add a color token to solve a layout or state problem.

## Format
Implement, then run every line of the §8 acceptance checklist live in the browser and report it as pass/fail with what you actually observed:

- pencil appears under the same rules as ✓ and trash
- three buttons fit on mobile, targets ≥44px, title not squeezed
- `/edit/{id}` opens prefilled
- «Зберегти зміни» disabled with no changes
- «Зберегти зміни» disabled with an empty title
- cancel with no changes exits at once; with changes it confirms
- after saving, the card highlights in place
- the card's position doesn't change after a title edit
- a done wish stays done and in its group
- replacing an image destroys the old Cloudinary file after the save
- cancelling an edit destroys no file
- removing an image via "×" restores emoji (default `🎁`)
- a foreign `/edit/{id}` gives a 404 identical to a nonexistent one
- a direct Server Action call on a foreign wish is rejected server-side
- `toggleDone` and `delete` also verify the owner server-side
- `/w/{token}` has neither the button nor route access
- `/add` works exactly as before

For anything you couldn't verify, say so explicitly instead of marking it passed.
```

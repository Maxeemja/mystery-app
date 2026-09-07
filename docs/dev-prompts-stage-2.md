# Wishlist — промпти для розробки, етап 2

**Джерела істини:** [stage-2.md](stage-2.md) — дельта · [prompter-task-stage-2.md](prompter-task-stage-2.md) — завдання · [spec.md](spec.md) + [interactions.md](interactions.md) — база етапу 1 · [style-guide.md](style-guide.md) · [tech-stack.md](tech-stack.md)

**Промпти етапу 1:** [dev-prompts.md](dev-prompts.md)

## Як цим користуватися

Шість промптів, **виконувати строго по порядку** — кожен наступний спирається на код попереднього. Кожну стадію запускати окремою сесією Claude Code в корені репозиторію.

Етап 1 реалізований і працює. Це **надбудова**, не переписування: після кожної стадії застосунок мусить лишатися запускним, а поведінка етапу 1 — цілою.

| Стадія | Що робить |
|---|---|
| 0 | MongoDB, модель власності, server/client розділ шару даних |
| 1 | Auth.js, `/register`, `/login`, вихід, захист маршрутів |
| 2 | Cloudinary — підписане завантаження, життєвий цикл `public_id` |
| 3 | Міграція локальних даних + ліміт 30 бажань |
| 4 | Посилання на список + гостьовий екран `/w/{token}` |
| 5 | Приймання + регресія етапу 1 |

**Приймання** — `prompter-task-stage-2.md §9`, прогоняється вживу.

---

## Три речі, знайдені в коді етапу 1

Вони вже вшиті в промпти нижче, але варто знати до старту.

1. **Контракт репозиторію не має параметра для перевірки власника.** `WishRepository.update(id, patch)` і `remove(id)` не приймають `userId`, а `create(userId, data)` отримує його від клієнта. З акаунтами це означає, що Server Action не має з чим зіставити право на запис. Закривається в Stage 0.
2. **`lib/repositories/index.ts` створює сінглтони при імпорті модуля.** На сервері `indexedDB` не існує, а `/w/{token}` — серверний. Потрібен реальний server/client розділ, а не заміна двох рядків. Закривається в Stage 0.
3. **PNG-експорт зламається на cross-origin картинках Cloudinary.** `html-to-image` тейнтить canvas без CORS. Закривається в Stage 2, перевіряється в Stage 5.

---

## Stage 0 — MongoDB, модель власності, шар даних

```
## Role
Act as a senior Next.js/TypeScript engineer extending an existing, working stage-1 codebase. This is an addition to a working app, not a rewrite.

## Task
Add the MongoDB-backed data layer alongside the existing IndexedDB one, and establish the ownership model and the server/client split that the rest of stage 2 depends on. No UI, no auth screens, no Cloudinary yet.

## Review — inspect before changing anything
Read docs/stage-2.md §1–§2, docs/prompter-task-stage-2.md §1, §2, §7.1, and docs/tech-stack.md §4.
Then inspect the existing layer: `lib/repositories/` (`types.ts`, `index.ts`, both `IndexedDb*` implementations, `bootstrap.ts`), `lib/domain/types.ts`, and every consumer — `components/useWishes.ts`, `components/useProfile.ts`, `components/InitScreen.tsx`, `components/AddScreen.tsx`, `components/WishlistScreen.tsx`.

## Findings you must address (verify each in the code first, then act)
1. **The repository contract has nowhere to enforce ownership.** `WishRepository.update(id, patch)` and `remove(id)` take no owner scope, and `create(userId, data)` receives `userId` from the caller. That was safe with one local user. It is not safe with accounts: Server Actions are publicly invocable endpoints, so a caller who knows or guesses a wish `id` could mutate another account's data, and a client-supplied `userId` is an impersonation vector. Ownership must be resolved server-side from the session and enforced on every read and every mutation. Decide deliberately between adding an owner parameter to the contract or resolving the owner inside the Mongo implementation — but the client must never be the source of identity. State which you chose and why.
2. **`lib/repositories/index.ts` constructs module-level singletons at import time** (`new IndexedDbWishRepository()`). `indexedDB` does not exist on the server, and the guest screen `/w/{token}` in a later stage is fully server-rendered. The file's current comment — that stage 2 only swaps the two right-hand sides and nothing else changes — is no longer accurate. Split resolution so server code (Server Components, Server Actions) never imports the IndexedDB implementation and client code never imports the Mongo driver. Update that comment to match what you actually build.
3. **Five consumers pass `LOCAL_USER_ID` explicitly** (see the list above). Those call sites do change, contrary to the claim in prompter-task-stage-2.md §1. Don't plan on them being untouched — but don't rewrite them in this stage either; just report which ones later stages will have to update.

## Constraints
- Schemas exactly as docs/stage-2.md §2. `imagePublicId` is mandatory alongside `imageUrl` — without it, deleted wishes leave files in Cloudinary forever.
- Indexes: `User.email` unique, `User.shareToken` unique, `Wish.userId`. Create them idempotently; say whether you do it at startup or via a one-off script, and why.
- Mongo connection must be a single cached client reused across hot reloads and serverless invocations — not a new connection per request.
- Mutations go through Server Actions, not client fetches to route handlers.
- **Keep the IndexedDB implementation in the tree.** Stage 3's migration still reads from it. Do not delete it.
- **The running app must keep working on IndexedDB after this stage.** Add the Mongo implementation without making it the default — auth lands in the next stage, and until there's a session there is no real `userId` to scope by. Every stage has to leave the app runnable.
- Env vars: exactly the four names in prompter-task-stage-2.md §7.1. No `NEXT_PUBLIC_` prefix on any of them. Cloudinary is configured by the single `CLOUDINARY_URL` — do not add separate cloud-name/key/secret vars. Add `.env.example` with empty values, and verify `.env.local` / `.env*.local` are in `.gitignore` before the first commit, not after.
- Do not build `/register`, `/login`, `/w/{token}`, the limit UI, or Cloudinary upload in this stage.

## Format
1. Add dependencies — check `package.json` first for what's already there.
2. Mongo connection + index setup.
3. Mongo repository implementations behind the existing interfaces, with the ownership decision applied.
4. The server/client resolution split.
5. Env scaffolding + `.gitignore` verification.
6. Verify: `npm run typecheck` passes and `npm run build` succeeds — the build is what catches an accidental client-side import of the Mongo driver or a server-side import of IndexedDB. Confirm the indexes actually exist in the cluster.
7. Report: the ownership decision you made, and every call site later stages will need to update.
```

---

## Stage 1 — Auth, `/register`, `/login`, захист маршрутів

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stage.

## Task
Implement authentication: Auth.js with a Credentials provider, `/register`, `/login`, logout, and route protection. Switch the app's data layer over to the Mongo implementation now that a real session exists.

## Review
Read docs/stage-2.md §3 and docs/prompter-task-stage-2.md §3. Read docs/interactions.md §1 for the name-validation behavior that `/register` must match exactly.
Inspect what already exists: `lib/domain/validation.ts` (reuse the name validator — do not reimplement it), `components/InitScreen.tsx` and `app/init/page.tsx` (being replaced), `app/page.tsx` (its client-side routing gate currently redirects to `/init`), `components/wishlist/NameModal.tsx` and `components/WishlistScreen.tsx` (the name click target that now becomes a menu).

## Specify
- **Session:** Auth.js (NextAuth) Credentials provider, JWT in an httpOnly cookie.
- **Passwords:** minimum 8 characters, bcrypt cost 12. Never logged, never returned from any Server Action or API response, never stored in plaintext. Note that bcrypt silently truncates input past 72 bytes — cap or reject longer input rather than letting it pass silently.
- **Email:** `trim` + lowercase, unique. Normalize before both the uniqueness check and the write, or `A@x.com` and `a@x.com` become two accounts.
- **`shareToken`:** generated at registration, ~10 characters, from a cryptographically secure source — not `Math.random()`. It is the only thing protecting a list from enumeration.
- **`/register`** replaces the stage-1 Init screen: name (3–15, validation identical to Init — reuse the existing function), email, password (min 8). "Створити акаунт" disabled until all three are valid. Inline Ember errors with the exact strings from stage-2.md §3.1.
- **`/login`:** email, password, "Увійти", plus a "Немає акаунта? Створити" link to `/register`.
- **Login failure is always the same message** — «Невірний імейл або пароль» — regardless of which field was wrong. Do not distinguish the cases: a specific "no such email" turns the form into an oracle for checking whether an address is registered.
- **No "Забули пароль?" link.** Password reset is not implemented (no mail service in the stack) — see stage-2.md §3.4. A link that goes nowhere is worse than its absence.
- **Profile menu:** the name in the hub header currently opens the rename modal directly. It now opens a menu with two items — «Змінити імʼя» and «Вийти». Keep the existing rename modal and its validation; only the entry point changes.
- **Route protection:** `/`, `/add`, `/share` require a session and redirect to `/login` otherwise. `/w/{token}`, `/login`, `/register` stay public. The old `/init` gate in `app/page.tsx` must now point at `/login`; decide whether to delete the Init screen or leave a redirect, and say which.
- Switch `wishRepository` / `profileRepository` resolution to the Mongo implementation, with `userId` now coming from the session instead of `LOCAL_USER_ID`. Update the five consumer call sites reported at the end of the previous stage.
- **Migration is not part of this stage.** A brand-new account will legitimately show an empty list until stage 3 lands — that's expected, don't paper over it with seed data here.

## Maintain
Preserve all stage-1 list behavior — the rename modal's validation, the hub header layout, filters, empty states. This stage changes identity and routing, nothing about how the list behaves.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only. The theme is deliberately locked down: if a color, radius, or shadow utility you reach for doesn't exist, that is the design system rejecting it — pick an allowed one, do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens. Reuse the existing `components/ui/` primitives (Button, TextField, Modal, Badge) rather than building new ones. Reduced-motion is already handled globally — do not re-implement it per component.

## Format
Implement, then verify in the browser: registration creates an account and lands on the hub; a duplicate email gives the exact inline error; login works; wrong password and unknown email give the *same* message; visiting `/`, `/add`, `/share` while signed out redirects to `/login`; logout works and drops the session; the rename modal still validates as before. Then confirm no plaintext password appears in server logs or any action response, and that `npm run build` passes.
```

---

## Stage 2 — Cloudinary

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stages.

## Task
Move wish images from browser Blobs to Cloudinary, with server-side signed uploads and a correct `public_id` lifecycle.

## Review
Read docs/stage-2.md §7 and docs/prompter-task-stage-2.md §7, §7.1.
Inspect what already exists and must be reused, not rewritten: `components/add/ImageUpload.tsx` (5MB / format validation, preview, "×"), `components/add/compressImage.ts` (~1200px client-side compression), `components/wishlist/WishMedia.tsx` (renders the image — currently from a Blob), `lib/share/captureNode.ts` (the PNG export).

## Specify
- **Upload goes through a Server Action with a signed request.** Do not use an unsigned upload preset — it would let anyone upload files into the account. Secrets stay server-side; `cloudinary.config()` reads `CLOUDINARY_URL` from the environment on its own, so no config values need to reach the client.
- Keep the existing limits and client-side compression exactly as they are: 5MB, JPEG/PNG/WebP/GIF, checked before the file is read, compressed to ~1200px on the longer side before it leaves the browser. Reuse the stage-1 code for all of this.
- Store both `secure_url` and `public_id`. The `public_id` is not optional — without it a deleted wish leaves its file in Cloudinary permanently.
- **Deleting a wish deletes its Cloudinary file.** If the destroy call fails, the wish is still deleted and the failure is logged — user data matters more than cleanup.
- The client never needs `cloud_name`: uploads go through the server, and the database stores a ready `secure_url`.

## Findings you must address
1. **The PNG export will break silently.** `lib/share/captureNode.ts` uses `html-to-image`, which rasterizes via canvas. On stage 1 the images were same-origin Blob URLs, so this worked. Cloudinary URLs are cross-origin, and a cross-origin image taints the canvas — "Зберегти як картинку" will fail or produce a blank/partial PNG. Fix it deliberately (e.g. `crossOrigin="anonymous"` on the rendered images plus verified CORS response headers, or proxying the image through your own origin) and **verify by opening the exported PNG file** for a wish that has an uploaded image. Do not treat a successful download as proof.
2. If you render images through `next/image`, `next.config.ts` needs the Cloudinary host in `images.remotePatterns` — otherwise the image silently 400s in production but may appear to work in dev.

## Maintain
The Add form's behavior is unchanged from the user's point of view: emoji/image mutual exclusion, the dimmed inactive option, inline Ember errors for size and format, the preview with "×". Only where the bytes end up changes.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only; reuse `components/ui/` primitives. Do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens.

## Format
Implement, then verify: an image uploads through the server and the wish stores both `secure_url` and `public_id`; the image renders on the hub and the share screen; deleting the wish removes the file from Cloudinary; a >5MB file and an unsupported format still produce the stage-1 inline errors; **the exported PNG opens and actually shows the uploaded image**; and `npm run build` produces a client bundle containing no Cloudinary secret — grep the built output for the secret value to confirm, don't assume.
```

---

## Stage 3 — Міграція локальних даних + ліміт 30

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stages.

## Task
Implement the one-time IndexedDB → account migration, and the 30-wish account limit.

## Review
Read docs/stage-2.md §4, §6 and docs/prompter-task-stage-2.md §4, §6.
Inspect `lib/repositories/IndexedDbWishRepository.ts` and `lib/repositories/bootstrap.ts` (the stage-1 seed logic — the 3 default wishes already exist there, reuse rather than retype them), plus `components/WishlistScreen.tsx` for the header where the limit indicator goes.

## Specify — migration (runs once, on first successful register or login)
The client checks IndexedDB after authentication, then:
1. **Local wishes exist** → upload each Blob image to Cloudinary, create the records under the real `userId`, then clear IndexedDB. The 3 default wishes are **not** created in this case.
2. **No local wishes** → create the 3 defaults (📚 Книжка про дизайн ₴450 · ✈️ Вихідні у Львові ₴3 000 · 🎧 Навушники ₴2 200, done). They behave like any other wish and count toward the limit.
3. **More than 30 local wishes** → migrate the first 30 by `createdAt`, discard the rest, and show «Перенесено 30 з N бажань — це максимум для акаунта».

Show «Переносимо твої бажання…» while it runs.

**Idempotency is the hard requirement here.** If migration dies halfway, the next login must top up what's missing and never duplicate what already landed. stage-2.md §6 specifies keying this on the local `id` held in a marker field — but note that the schema in stage-2.md §2 does not include such a field. Resolve that gap explicitly: add the marker field to the Wish schema (or a separate tracking collection), say which you chose, and make sure it can't be confused with real wish data. Then actually test the half-failure path — kill the migration midway and log in again.

## Specify — 30-wish limit
- **All** wishes count, active and done alike.
- **The server-side hard lock is the requirement**, not the UI: the Server Action must reject the creation of a 31st wish. The client check is convenience only — verify the server refuses even when the client check is bypassed.
- `< 25` → show nothing, counter as usual.
- `>= 25` → muted «28 / 30» next to the counter in the header.
- `= 30` → "Додати" disabled with the caption «Ліміт 30 бажань. Видали щось, щоб додати нове». If the Add form is somehow open at 30, its submit button is disabled with the same text.
- Deleting a wish lifts the block immediately.

## Maintain
The counter's Ukrainian pluralization and its rule of always showing the full unfiltered total (interactions.md §2.2) are unchanged — the «N / 30» indicator sits beside it, it does not replace or alter it. Everything else about the hub stays as it is.

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only; reuse `components/ui/` primitives. Muted text uses the existing Mid Gray token — the limit indicator is not a warning and gets no Ember, no new color.

## Format
Implement migration first, then the limit. Verify: a fresh account with no local data gets exactly 3 wishes; an account with stage-1 local data gets those wishes (images included) and IndexedDB ends up empty; interrupting migration and logging in again produces no duplicates; more than 30 local wishes migrates exactly 30 with the message; the indicator appears at 25 and not before; at 30 both the button and the form submit are disabled; the Server Action refuses a 31st wish even when called directly; deleting one immediately re-enables adding.
```

---

## Stage 4 — Посилання на список + гостьовий екран `/w/{token}`

```
## Role
Act as a senior Next.js/TypeScript engineer working in the codebase from the previous stages.

## Task
Add the share link to the owner's Share screen, and build the server-rendered guest screen at `/w/{token}`.

## Review
Read docs/stage-2.md §5 and docs/prompter-task-stage-2.md §5, §10.
Inspect `components/ShareScreen.tsx`, `components/share/ShareWishCard.tsx`, `lib/share/shareText.ts` and `lib/share/captureNode.ts` — the banner, the simplified cards, the share text and the PNG export all already exist and should be reused rather than rebuilt.

## Specify — owner's Share screen (additive)
- A read-only input holding `https://…/w/{token}` plus a «Копіювати» button that swaps its label to «Скопійовано ✓» for 2 seconds. No toast — stage 1 has no toast component and this stage doesn't add one.
- The Web Share call now passes **both** the text and the `url`, so messengers render a clickable preview. The desktop fallback copies text and link together.
- The share text itself is unchanged from stage 1 — reuse `lib/share/shareText.ts`.
- Note that the Clipboard API requires a secure context; it works on localhost and https but not on a plain-http non-localhost host. Make sure the failure path doesn't leave the button stuck on «Скопійовано ✓».

## Specify — guest screen `/w/{token}`
- **Fully server-rendered and must work with JavaScript disabled** — this is an explicit acceptance item. Nothing required to read the list may depend on client JS.
- Amber `#f59e0b` banner with `#0a0a0a` text: «Список бажань {імʼя}» + the count.
- Cards show emoji/image, title, price, and **the «Подивитися →» link** (new tab, `rel="noopener noreferrer"`). This link is a deliberate deviation from stage 1's share screen, per stage-2.md §5.3 — the guest is looking at the list in order to buy something.
- Done wishes are excluded entirely — from the list and from the banner count.
- No action buttons. Cards are not clickable except the link.
- A CTA banner at the bottom, Neutral Card styling: «Створити свій список бажань» → `/register`. No modal, no timer, no overlay.
- There is no "view as guest" gate — the list renders immediately.
- **States:** nonexistent token → «Такого списку не існує» + «На головну», served as a proper not-found page, **not a 500** (verify with a garbage token); empty or all-done → banner + «Тут поки порожньо» + the register CTA; signed-in visitor → same read-only view but the CTA becomes «Мій список» → `/`; owner viewing their own link → same view plus the hint «Так твій список бачать друзі».
- **OG tags** via `generateMetadata`: title «Список бажань {імʼя}», description with the wish count.

## Constraints
- **Amber appears only on this screen and the owner's Share screen.** It must not reach the cards, the buttons, or the CTA banner — the accent doesn't spread.
- **The guest must not be able to mutate anything** — not through the UI, and not by invoking a Server Action directly. This is guaranteed by the server-side ownership enforcement built in Stage 0, not by the absence of buttons. Verify it by actually calling a mutation action while unauthenticated and while signed in as a different account.
- Do not add link regeneration/revocation, private lists, guest reservations, comments, or likes — all explicitly out of scope (stage-2.md §9).

## Constraints — styling
Style with Tailwind utilities from `styles/theme.css` only; reuse `components/ui/` primitives and the existing share-card component. Do not add arbitrary values, `@apply` workarounds, inline styles, or new theme tokens.

## Format
Implement the owner's link field first, then the guest screen. Verify: the link copies and the label reverts after 2s; Web Share carries text and URL; `/w/{token}` opens signed out; **it still renders with JS disabled in devtools**; done wishes never appear and aren't counted; product links open in a new tab; a bad token shows the not-found page rather than an error; the CTA switches correctly for a signed-in visitor and for the owner; OG tags are present in the served HTML; and a direct unauthenticated Server Action call is rejected.
```

---

## Stage 5 — Приймання та регресія

```
## Role
Act as a senior QA-minded engineer doing the final pass over stage 2.

## Task
Run the full acceptance checklist, and verify stage 1 didn't regress.

## Context
Read docs/prompter-task-stage-2.md §8 (what must not change) and §9 (the checklist), plus docs/stage-2.md §8–§9 and docs/interactions.md §7 (stage 1's own checklist).

## Investigation
Walk the running app and check every line of prompter-task-stage-2.md §9 point by point. Note which items already pass and which don't — do not assume the previous stages completed them.

Then re-run stage 1's checklist (interactions.md §7) against the now-cloud-backed app. Pay particular attention to the places where moving to the network plausibly changed behavior:
- **"Зберегти як картинку" with an uploaded Cloudinary image** — open the actual PNG. This is the most likely silent break in the whole stage.
- **The inline «Не вдалося зберегти» path** (interactions.md §0.2) was written for a local storage failure. Every mutation is now a network call, so this path is far more reachable — offline, latency, a rejected action. Confirm it still surfaces inline at the point of action and that optimistic updates roll back correctly.
- **Optimistic mutations** in `components/useWishes.ts` were tuned for near-instant local writes. Confirm the ✓ toggle and inline delete still behave correctly under real network latency, including a failed write.
- Counter pluralization, price formatting, filter reset, the three empty states, new-card highlight, keyboard handling, `prefers-reduced-motion`, mobile layout.

## Security items to verify concretely, not by inspection
- No plaintext password in logs or in any Server Action response.
- Wrong email and wrong password produce identical login errors.
- `npm run build`, then grep the built client output for the actual secret values — no `MONGODB_URI`, no Cloudinary secret, nothing under a `NEXT_PUBLIC_` prefix.
- `.env.local` is gitignored and `.env.example` is committed with empty values.
- A mutation Server Action invoked while unauthenticated, and while signed in as a different account, is rejected in both cases.
- `/w/{token}` with a nonexistent token returns not-found, not a 500.

## Constraints
Do not add anything from stage-2.md §9 or prompter-task-stage-2.md §8: no password reset, no social login, no link regeneration, no private lists, no guest reservations, no comments or likes, no wish editing, no offline mode. If you find a real problem outside stage 2's scope, report it rather than fixing it.

## Format
Report the checklist as a pass/fail list with the evidence for each — what you did and what you observed. Fix what's genuinely broken in stage 2's scope; for anything you couldn't verify, say so explicitly rather than marking it passed.
```

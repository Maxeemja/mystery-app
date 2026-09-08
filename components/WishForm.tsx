'use client'

/**
 * The wish form, in both of its modes — docs/interactions.md §3,
 * docs/prompter-task-edit-wish.md §3.
 *
 * One component rather than two by requirement (§3.1), and for the obvious
 * reason: fields, ordering, validation, emoji/image exclusivity, price
 * formatting, `https://` normalization and the 60-character cap all already
 * work, and a second copy means every future change has to be made twice.
 *
 * The mode changes copy, initial values, and what counts as "worth saving".
 * Everything else is shared verbatim.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { EmojiPicker } from './add/EmojiPicker'
import { ImageUpload } from './add/ImageUpload'
import { compressImage } from './add/compressImage'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { TextField } from './ui/TextField'
import { HIGHLIGHT_KEY } from './WishlistScreen'
import { useProfile } from './useProfile'
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_EMOJI,
  LIMIT_REACHED_TEXT,
  TITLE_MAX_LENGTH,
  formatPriceInput,
  isAtLimit,
  looksLikeUrl,
  normalizeUrl,
  parsePriceInput,
  validateTitle,
  type Currency,
  type Wish,
} from '../lib/domain'
import {
  countWishesAction,
  createWishAction,
  updateWishAction,
} from '../app/actions/wishes'

interface WishFormProps {
  mode: 'add' | 'edit'
  /** The wish being edited; absent in add mode. */
  wish?: Wish
}

/** Formats a stored price back into what the price input expects. */
function priceToInput(price: number | undefined): string {
  return price === undefined ? '' : formatPriceInput(String(price))
}

export function WishForm({ mode, wish }: WishFormProps) {
  const router = useRouter()
  const { status: profileStatus, profile } = useProfile()
  const isEdit = mode === 'edit'

  // Initial values come from the wish in edit mode and are empty in add mode.
  // They are also kept for the dirty comparison below, so they must be derived
  // once rather than re-read from `wish` on every render.
  const initial = useRef({
    title: wish?.title ?? '',
    emoji: wish?.imageUrl ? null : (wish?.emoji ?? null),
    price: priceToInput(wish?.price),
    currency: wish?.currency ?? DEFAULT_CURRENCY,
    url: wish?.url ?? '',
  }).current

  const [title, setTitle] = useState(initial.title)
  const [emoji, setEmoji] = useState<string | null>(initial.emoji)
  const [image, setImage] = useState<Blob | null>(null)
  const [price, setPrice] = useState(initial.price)
  const [currency, setCurrency] = useState<Currency>(initial.currency)
  const [url, setUrl] = useState(initial.url)

  /**
   * The image can't be diffed by value: the initial state is a remote URL and a
   * new pick is a `File`, so there is nothing comparable. It is modelled as two
   * booleans instead — a new file was chosen, or the existing one was cleared —
   * which is exactly the information both the dirty check and the server need.
   */
  const [imageRemoved, setImageRemoved] = useState(false)
  const existingImageUrl = imageRemoved ? null : (wish?.imageUrl ?? null)
  const imageChanged = image !== null || imageRemoved

  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [goneMessage, setGoneMessage] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profileStatus === 'ready' && !profile) router.replace('/login')
  }, [profileStatus, profile, router])

  // Autofocus «Що це?» in both modes; in edit mode the caret goes to the end of
  // the existing text rather than selecting it, since the user is amending.
  const focused = useRef(false)
  useEffect(() => {
    if (profileStatus !== 'ready' || !profile || focused.current) return
    focused.current = true
    const input = titleRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [profileStatus, profile])

  // The 30-wish limit applies to creation only: editing writes no new record
  // (§7), so the edit screen never consults it.
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    if (isEdit || profileStatus !== 'ready' || !profile) return
    countWishesAction()
      .then(setTotal)
      .catch(() => setTotal(null))
  }, [isEdit, profileStatus, profile])
  const atLimit = !isEdit && total !== null && isAtLimit(total)

  /**
   * Add mode asks "has anything been typed"; edit mode asks "has anything
   * changed". An enabled «Зберегти зміни» that would save nothing reads as
   * broken, and a «Скасувати зміни?» prompt when nothing changed is friction
   * for its own sake (§3.2).
   */
  const changed =
    title !== initial.title ||
    emoji !== initial.emoji ||
    price !== initial.price ||
    url !== initial.url ||
    // Currency only counts once there is a price for it to apply to.
    (price !== '' && currency !== initial.currency) ||
    imageChanged

  const filled =
    title !== '' || emoji !== null || image !== null || price !== '' || url !== ''

  const dirty = isEdit ? changed : filled
  const canSubmit =
    validateTitle(title).valid && !saving && !atLimit && (!isEdit || changed)

  // ---- back-navigation guard (interactions.md §3.7) ----
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const guardPushed = useRef(false)

  useEffect(() => {
    if (!dirty || guardPushed.current) return
    guardPushed.current = true
    window.history.pushState({ wishlistGuard: true }, '')
  }, [dirty])

  useEffect(() => {
    function onPopState() {
      if (!dirtyRef.current) return
      window.history.pushState({ wishlistGuard: true }, '')
      setConfirmingCancel(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (confirmingCancel) {
        setConfirmingCancel(false)
        return
      }
      requestCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  function requestCancel() {
    if (dirtyRef.current) setConfirmingCancel(true)
    else leave()
  }

  /**
   * `replace`, not `push`: it also swallows the guard history entry, so the
   * user doesn't have to press back twice to get past this screen.
   */
  function leave() {
    router.replace('/')
  }

  async function submit() {
    if (!canSubmit) return
    setSaving(true)
    setSaveFailed(false)

    try {
      // Compressed before anything leaves the browser — uploading the original
      // would spend the user's bandwidth and Cloudinary's quota on pixels that
      // get thrown away (interactions.md §3.3). Nothing is uploaded unless the
      // form is actually submitted, which is what makes a cancelled edit leave
      // storage untouched (§4).
      const compressed = image instanceof File ? await compressImage(image) : image
      const upload = compressed
        ? new File([compressed], 'wish', { type: compressed.type })
        : undefined

      const shared = {
        title: validateTitle(title).value,
        emoji: emoji ?? DEFAULT_EMOJI,
        ...(parsePriceInput(price) !== undefined
          ? { price: parsePriceInput(price), currency }
          : {}),
        ...(normalizeUrl(url) ? { url: normalizeUrl(url) } : {}),
      }

      if (isEdit && wish) {
        const result = await updateWishAction(
          wish.id,
          { ...shared, removeImage: imageRemoved },
          upload
        )
        if (!result.ok) {
          // Deleted from another tab while this form was open (§6).
          setGoneMessage(true)
          setSaving(false)
          setTimeout(leave, 1500)
          return
        }
        // Same highlight the hub already runs for a new card; the card is
        // highlighted where it already sits, because `createdAt` was untouched
        // and the ordering derives from it (§3.4).
        sessionStorage.setItem(HIGHLIGHT_KEY, result.wish.id)
      } else {
        const created = await createWishAction(shared, upload)
        sessionStorage.setItem(HIGHLIGHT_KEY, created.id)
      }
      leave()
    } catch {
      setSaveFailed(true)
      setSaving(false)
    }
  }

  if (profileStatus !== 'ready' || !profile) {
    return <main className="min-h-screen" />
  }

  const urlHint = url !== '' && !looksLikeUrl(url) ? 'Схоже, це не посилання' : null

  return (
    <main className="mx-auto max-w-page px-6 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Button variant="outline" onClick={requestCancel}>
          ← Скасувати
        </Button>

        <div className="mt-4 rounded-card border border-hairline bg-paper p-6 shadow-subtle">
          <h1 className="mb-6 text-heading-sm font-semibold sm:text-heading">
            {isEdit ? 'Редагувати бажання' : 'Додати'}
          </h1>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <div className="mb-5">
              <TextField
                id="wish-title"
                ref={titleRef}
                label="Що це?"
                value={title}
                maxLength={TITLE_MAX_LENGTH}
                placeholder="Наприклад, кава з собою"
                autoComplete="off"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="mb-5">
              <span className="mb-2 block text-body font-medium text-ink">
                Емодзі
              </span>
              <EmojiPicker
                value={emoji}
                dimmed={image !== null || existingImageUrl !== null}
                onChange={(next) => {
                  setEmoji(next)
                  if (next) {
                    // Choosing an emoji drops the image, exactly as on create —
                    // and on edit that also means the stored one is cleared (§4).
                    setImage(null)
                    if (wish?.imageUrl) setImageRemoved(true)
                  }
                }}
              />
            </div>

            <div className="mb-5">
              <span className="mb-2 block text-body font-medium text-ink">
                Або своя картинка
              </span>
              <ImageUpload
                file={image}
                existingUrl={existingImageUrl}
                dimmed={emoji !== null}
                onSelect={(file) => {
                  setImage(file)
                  setEmoji(null)
                  // Replacing counts as removing the old one; the server
                  // destroys it only after the new record is safely written.
                  if (wish?.imageUrl) setImageRemoved(false)
                }}
                onClear={() => {
                  setImage(null)
                  if (wish?.imageUrl) setImageRemoved(true)
                }}
              />
            </div>

            <div className="mb-5">
              <label
                htmlFor="wish-price"
                className="mb-2 block text-body font-medium text-ink"
              >
                Скільки коштує
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextField
                    id="wish-price"
                    inputMode="numeric"
                    value={price}
                    placeholder="0"
                    autoComplete="off"
                    onChange={(event) =>
                      setPrice(formatPriceInput(event.target.value))
                    }
                  />
                </div>
                <Select
                  aria-label="Валюта"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as Currency)}
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mb-6">
              <TextField
                id="wish-url"
                label="Посилання"
                value={url}
                placeholder="https://…"
                autoComplete="off"
                inputMode="url"
                onChange={(event) => setUrl(event.target.value)}
                helper={urlHint}
                tone="error"
              />
            </div>

            {goneMessage ? (
              <p className="mb-4 text-body text-ember">
                Це бажання вже видалене
              </p>
            ) : null}
            {saveFailed ? (
              <p className="mb-4 text-body text-ember">Не вдалося зберегти</p>
            ) : null}

            {confirmingCancel ? (
              <div>
                <p className="mb-3 text-body text-ink">
                  {isEdit
                    ? 'Скасувати зміни? Введене не збережеться'
                    : 'Скасувати додавання? Введене не збережеться'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmingCancel(false)}
                  >
                    Продовжити редагування
                  </Button>
                  <Button variant="destructive" onClick={leave}>
                    Скасувати
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  fullWidth
                  className="sm:w-auto"
                >
                  {isEdit ? 'Зберегти зміни' : 'Додати бажання'}
                </Button>
                {atLimit ? (
                  <p className="mt-2 text-body text-mid-gray">
                    {LIMIT_REACHED_TEXT}
                  </p>
                ) : null}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}

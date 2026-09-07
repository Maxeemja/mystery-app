'use client'

/**
 * «Додати» — docs/interactions.md §3, docs/spec.md §3.2.
 *
 * Short form, five fields, one required. No draft is ever persisted: opening
 * the screen again always gives a clean form.
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
  LOCAL_USER_ID,
  TITLE_MAX_LENGTH,
  formatPriceInput,
  looksLikeUrl,
  normalizeUrl,
  parsePriceInput,
  validateTitle,
  type Currency,
} from '../lib/domain'
import { createWishAction } from '../app/actions/wishes'

export function AddScreen() {
  const router = useRouter()
  const { status: profileStatus, profile } = useProfile()

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [image, setImage] = useState<Blob | null>(null)
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY)
  const [url, setUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profileStatus === 'ready' && !profile) router.replace('/login')
  }, [profileStatus, profile, router])

  useEffect(() => {
    if (profileStatus === 'ready' && profile) titleRef.current?.focus()
  }, [profileStatus, profile])

  const dirty =
    title !== '' || emoji !== null || image !== null || price !== '' || url !== ''
  const canSubmit = validateTitle(title).valid && !saving

  // ---- back-navigation guard (interactions.md §3.7) ----
  // Hardware back and the browser's swipe gesture must behave like the on-screen
  // «←». They can't be intercepted directly, so a guard history entry is pushed
  // once the form goes dirty and re-pushed whenever the user pops it.
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

  // Esc: same confirmation when dirty, immediate exit when empty.
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
      const created = await createWishAction({
        title: validateTitle(title).value,
        // Images are not carried across this stage: a Blob cannot travel to
        // Mongo, and Cloudinary is wired up in the next one. Until then a wish
        // saves with its emoji (or the default glyph). The picker, compression
        // and validation are all left in place for that stage to reconnect.
        emoji: emoji ?? DEFAULT_EMOJI,
        ...(parsePriceInput(price) !== undefined
          ? { price: parsePriceInput(price), currency }
          : {}),
        ...(normalizeUrl(url) ? { url: normalizeUrl(url) } : {}),
      })
      // Picked up and cleared by the hub screen (interactions.md §2.8).
      sessionStorage.setItem(HIGHLIGHT_KEY, created.id)
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
            Додати
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
                dimmed={image !== null}
                onChange={(next) => {
                  setEmoji(next)
                  if (next) setImage(null)
                }}
              />
            </div>

            <div className="mb-5">
              <span className="mb-2 block text-body font-medium text-ink">
                Або своя картинка
              </span>
              <ImageUpload
                file={image}
                dimmed={emoji !== null}
                onSelect={(file) => {
                  setImage(file)
                  setEmoji(null)
                }}
                onClear={() => setImage(null)}
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
                <input
                  id="wish-price"
                  inputMode="numeric"
                  value={price}
                  placeholder="0"
                  autoComplete="off"
                  onChange={(event) => setPrice(formatPriceInput(event.target.value))}
                  className="h-10 flex-1 rounded-control border border-transparent bg-canvas px-3 text-body text-ink transition-colors duration-150 ease-out placeholder:text-mid-gray focus:bg-paper"
                />
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

            {saveFailed ? (
              <p className="mb-4 text-body text-ember">Не вдалося зберегти</p>
            ) : null}

            {confirmingCancel ? (
              <div>
                <p className="mb-3 text-body text-ink">
                  Скасувати додавання? Введене не збережеться
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
              <Button type="submit" disabled={!canSubmit} fullWidth className="sm:w-auto">
                Додати бажання
              </Button>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}

'use client'

/**
 * Image upload zone — docs/interactions.md §3.3.
 *
 * Dashed hairline, 10px radius (the one nested-media radius in the system).
 * Click opens the file dialog; drag & drop works on desktop. Size and format
 * are checked before the file is read, and failures surface inline in Ember.
 */

import { useEffect, useRef, useState } from 'react'

import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_ERROR_TEXT,
  rejectImage,
  type ImageRejection,
} from '../../lib/domain'

interface ImageUploadProps {
  file: Blob | null
  onSelect: (file: File) => void
  onClear: () => void
  /** Dimmed while an emoji is chosen — the two are mutually exclusive. */
  dimmed: boolean
  /**
   * An image the wish already has, on the edit screen. It is a remote
   * Cloudinary URL rather than a Blob, so it cannot go through `file` — there
   * is nothing to create an object URL from, and downloading it just to make
   * one would be pointless. A freshly picked `file` takes precedence over it.
   */
  existingUrl?: string | null
}

export function ImageUpload({
  file,
  onSelect,
  onClear,
  dimmed,
  existingUrl = null,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<ImageRejection | null>(null)
  const [dragging, setDragging] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const previewUrl = objectUrl ?? existingUrl

  function accept(candidate: File | undefined) {
    if (!candidate) return
    const rejection = rejectImage(candidate)
    setError(rejection)
    if (!rejection) onSelect(candidate)
  }

  if (previewUrl) {
    return (
      <div className="flex items-start gap-3">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL, or
              a Cloudinary URL when editing an existing wish */}
          <img
            src={previewUrl}
            alt=""
            crossOrigin={objectUrl ? undefined : 'anonymous'}
            className="h-20 w-20 rounded-media object-cover"
          />
          <button
            type="button"
            onClick={() => {
              onClear()
              setError(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            aria-label="Прибрати картинку"
            className="absolute -top-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-control border border-hairline bg-paper text-body text-ink"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={[
        'transition-opacity duration-150 ease-out',
        dimmed ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          accept(event.dataTransfer.files[0])
        }}
        className={[
          'inline-flex items-center gap-2 rounded-media border border-dashed px-4 py-3',
          'text-body font-medium transition-colors duration-150 ease-out',
          dragging ? 'border-mid-gray text-ink' : 'border-hairline text-mid-gray',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5-5 5 5" />
          <path d="M12 5v12" />
        </svg>
        Завантажити
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={(event) => accept(event.target.files?.[0])}
      />

      {error ? (
        <p className="mt-2 text-body text-ember">{IMAGE_ERROR_TEXT[error]}</p>
      ) : null}
    </div>
  )
}

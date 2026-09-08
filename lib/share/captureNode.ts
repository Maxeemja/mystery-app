'use client'

/**
 * Rasterizes a DOM node to a PNG blob for «Зберегти як картинку»
 * (docs/interactions.md §4.3).
 *
 * html-to-image clones the node into a detached SVG `<foreignObject>` to
 * rasterize it. That clone only keeps looking right because Tailwind's
 * classes resolve against the real stylesheet already loaded on the page —
 * if the node were detached from the document before capture, or the
 * stylesheet hadn't loaded yet, the clone would lose those styles. The caller
 * is responsible for passing a node that is currently mounted and visible.
 *
 * `backgroundColor` is passed explicitly (Canvas `#f5f5f5`) so the export has
 * that background even where the node itself relies on a transparent or
 * inherited fill rather than its own opaque one.
 */

import { toBlob } from 'html-to-image'

export async function captureNodeAsPng(node: HTMLElement): Promise<Blob> {
  // Cloudinary images are cross-origin, and html-to-image inlines every image
  // it finds by fetching it first. Without `fetchRequestInit`, that fetch is
  // a default same-origin-credentialled request that Cloudinary's `ACAO: *`
  // cannot satisfy, and the image silently drops out of the PNG. Asking for
  // CORS mode without credentials is what the wildcard header allows.
  // The matching `crossOrigin="anonymous"` on the elements themselves (see
  // WishMedia) keeps the canvas untainted; both halves are required.
  const blob = await toBlob(node, {
    backgroundColor: '#f5f5f5',
    pixelRatio: 2,
    fetchRequestInit: { mode: 'cors', credentials: 'omit' },
  })
  if (!blob) throw new Error('PNG export produced no data')
  return blob
}

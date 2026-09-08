'use client';

/**
 * «Поділитися» — docs/interactions.md §4, docs/spec.md §3.3.
 *
 * Confetti Amber lives on the banner built here and nowhere else in the app
 * (docs/spec.md §8) — cards and buttons on this screen stay standard Ui
 * components on purpose, so the accent never bleeds into them.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ShareWishCard } from './share/ShareWishCard';
import { Button } from './ui/Button';
import { useProfile } from './useProfile';
import { useWishes } from './useWishes';
import {
	applyFilter,
	formatWishCount,
	shareImageFilename,
	sortWishes
} from '../lib/domain';
import { buildShareText, captureNodeAsPng } from '../lib/share';
import { getShareUrlAction } from '../app/actions/wishes';

const COPIED_LABEL_MS = 2000;

export function ShareScreen() {
	const router = useRouter();
	const { status: profileStatus, profile } = useProfile();
	const { status, wishes } = useWishes();

	const [copied, setCopied] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const captureRef = useRef<HTMLDivElement>(null);

	// The owner's own public link (docs/stage-2.md §5.1). Resolved server-side
	// from the session, so the token is never derived on the client.
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	useEffect(() => {
		getShareUrlAction()
			.then(setShareUrl)
			.catch(() => setShareUrl(null));
	}, []);

	useEffect(() => {
		if (profileStatus === 'ready' && !profile) router.replace('/login');
	}, [profileStatus, profile, router]);

	// Sequential returns (see the Stage-2 fix in WishlistScreen) so `profile`
	// narrows to non-null for the rest of the component, including the closures
	// below.
	if (profileStatus === 'loading' || status === 'loading') {
		return <main className='min-h-screen' />;
	}
	// Profile read itself failed (total storage unavailability) — say so rather
	// than a blank screen forever (same reasoning as WishlistScreen).
	if (profileStatus === 'error') {
		return (
			<main className='mx-auto max-w-page px-6 py-10'>
				<p className='text-body text-ember'>
					Не вдалося прочитати збережені дані
				</p>
			</main>
		);
	}
	if (!profile) {
		return <main className='min-h-screen' />;
	}

	// Completed wishes are excluded from both the grid and the banner's count
	// (interactions.md §4.1) — newest first, same ordering as the hub.
	const active = applyFilter(sortWishes(wishes), 'active');
	const isEmpty = active.length === 0;

	async function share() {
		// Nested function declarations don't inherit the outer narrowing above —
		// same reasoning as the equivalent guard in WishlistScreen.saveName.
		if (!profile) return;
		const text = buildShareText(profile.name, active);

		if (navigator.share) {
			try {
				// Text *and* url, so messengers render a clickable preview instead
				// of a bare paragraph (docs/stage-2.md §5.2). The text itself is
				// unchanged from stage 1.
				await navigator.share(shareUrl ? { text, url: shareUrl } : { text });
			} catch {
				// Cancelled, or genuinely failed — either way nothing happens
				// (interactions.md §4.2: "нічого не відбувається, повідомлення немає").
			}
			return;
		}

		try {
			// Desktop fallback: the link goes on the clipboard together with the
			// text, otherwise the recipient gets a list they can't open.
			await navigator.clipboard.writeText(
				shareUrl ? `${text}\n\n${shareUrl}` : text
			);
			setCopied(true);
			setTimeout(() => setCopied(false), COPIED_LABEL_MS);
		} catch {
			// No clipboard permission — no UI is specified for this case either.
		}
	}

	async function copyLink() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setLinkCopied(true);
			setTimeout(() => setLinkCopied(false), COPIED_LABEL_MS);
		} catch {
			// The Clipboard API needs a secure context — it is unavailable over
			// plain http on anything but localhost. Deliberately leaving the label
			// alone rather than flipping it: a button that says «Скопійовано ✓»
			// when nothing was copied is worse than one that appears to do
			// nothing, and the URL is selectable in the field either way.
			setLinkCopied(false);
		}
	}

	async function saveAsImage() {
		const node = captureRef.current;
		if (!node || !profile) return;

		setSaving(true);
		setSaveFailed(false);
		try {
			const blob = await captureNodeAsPng(node);
			const filename = shareImageFilename(profile.name);
			const file = new File([blob], filename, { type: 'image/png' });

			if (navigator.canShare?.({ files: [file] })) {
				// Mobile: the system save/share sheet (interactions.md §4.3).
				await navigator.share({ files: [file] });
			} else {
				// Desktop: a plain download.
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = filename;
				link.click();
				URL.revokeObjectURL(url);
			}
		} catch (error) {
			if ((error as { name?: string }).name !== 'AbortError')
				setSaveFailed(true);
		} finally {
			setSaving(false);
		}
	}

	return (
		<main className='mx-auto max-w-page px-6 py-10'>
			<Button
				variant='outline'
				onClick={() => router.replace('/')}
				aria-label='Назад до списку'
			>
				←
			</Button>

			{/* Exactly what ends up in the PNG: banner + cards, no chrome. */}
			<div
				ref={captureRef}
				className='mt-4 rounded-card bg-canvas py-2 sm:py-4'
			>
				<div className='rounded-card bg-confetti-amber p-6 text-ink sm:p-8'>
					<h1 className='text-heading-lg font-semibold sm:text-display tracking-normal'>
						Список бажань {profile.name}
					</h1>
					<p className='mt-2 text-body-lg font-medium'>
						{formatWishCount(active.length)}
					</p>
				</div>

				{isEmpty ? (
					<p className='mt-8 text-center text-subheading text-mid-gray'>
						Тут поки порожньо. Додай бажання, щоб було чим ділитися.
					</p>
				) : (
					<div className='mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
						{active.map((wish) => (
							<ShareWishCard key={wish.id} wish={wish} />
						))}
					</div>
				)}
			</div>

			{/* The live link. Read-only rather than disabled, so it stays
			    selectable and copyable by hand if the Clipboard API is
			    unavailable (docs/stage-2.md §5.2). */}
			{shareUrl ? (
				<div className='mt-6'>
					<label
						htmlFor='share-link'
						className='mb-2 block text-body font-medium text-ink'
					>
						Посилання на список
					</label>
					<div className='flex gap-2'>
						<input
							id='share-link'
							readOnly
							value={shareUrl}
							onFocus={(event) => event.target.select()}
							className='h-10 flex-1 rounded-control border border-hairline bg-canvas px-3 text-body text-ink'
						/>
						<Button variant='outline' onClick={() => void copyLink()}>
							{linkCopied ? 'Скопійовано ✓' : 'Копіювати'}
						</Button>
					</div>
				</div>
			) : null}

			{status === 'error' ? (
				<p className='mt-4 text-body text-ember'>
					Не вдалося прочитати збережені бажання
				</p>
			) : null}
			{saveFailed ? (
				<p className='mt-4 text-body text-ember'>
					Не вдалося створити картинку
				</p>
			) : null}

			<div className='mt-6 flex flex-wrap gap-2'>
				<Button onClick={() => void share()} disabled={isEmpty}>
					{copied ? 'Скопійовано ✓' : 'Поділитися'}
				</Button>
				<Button
					variant='outline'
					onClick={() => void saveAsImage()}
					disabled={isEmpty || saving}
				>
					Зберегти як картинку
				</Button>
			</div>
		</main>
	);
}

'use client';

/**
 * Wish card — docs/interactions.md §2.3, §2.5.
 *
 * Two faces on the same card, cross-faded over 150ms: the wish itself, and the
 * inline delete confirmation. The card keeps its size across the swap, so the
 * grid never reflows just because a confirmation opened. There is deliberately
 * no modal and no page dimming for delete — only the name edit gets a modal.
 */

import { useEffect, useRef } from 'react';

import { Button } from '../ui/Button';
import { TrashIcon } from './TrashIcon';
import { WishMedia } from './WishMedia';
import { formatPrice, type Wish } from '../../lib/domain';

interface WishCardProps {
	wish: Wish;
	confirmingDelete: boolean;
	removing: boolean;
	onToggleDone: () => void;
	onRequestDelete: () => void;
	onCancelDelete: () => void;
	onConfirmDelete: () => void;
	ref?: (element: HTMLElement | null) => void;
	/** Set for ~900ms after returning from Add (interactions.md §2.8). */
	highlighted?: boolean;
}

export function WishCard({
	wish,
	confirmingDelete,
	removing,
	onToggleDone,
	onRequestDelete,
	onCancelDelete,
	onConfirmDelete,
	ref,
	highlighted = false
}: WishCardProps) {
	const price = formatPrice(wish.price, wish.currency);
	const cardRef = useRef<HTMLElement>(null);

	// Outside click cancels the confirmation (interactions.md §2.5.5). Esc is
	// handled by the screen, which knows which card is open.
	useEffect(() => {
		if (!confirmingDelete) return;
		function onPointerDown(event: MouseEvent) {
			if (!cardRef.current?.contains(event.target as Node)) onCancelDelete();
		}
		document.addEventListener('mousedown', onPointerDown);
		return () => document.removeEventListener('mousedown', onPointerDown);
	}, [confirmingDelete, onCancelDelete]);

	return (
		<article
			ref={(element) => {
				cardRef.current = element;
				ref?.(element);
			}}
			className={[
				'group relative flex flex-col rounded-card border border-hairline bg-paper p-card',
				'shadow-subtle transition-[opacity,transform,box-shadow] duration-200 ease-out',
				'hover:shadow-subtle-lift',
				wish.isDone && !removing ? 'border-green!' : '',
				removing ? 'scale-95 opacity-0' : '',
				highlighted ? 'animate-highlight' : ''
			]
				.filter(Boolean)
				.join(' ')}
		>
			{/* ---- delete confirmation face ---- */}
			<div
				className={[
					'absolute inset-0 flex flex-col justify-center gap-3 p-card',
					'transition-opacity duration-150 ease-out',
					confirmingDelete ? 'opacity-100' : 'pointer-events-none opacity-0'
				].join(' ')}
				aria-hidden={!confirmingDelete}
			>
				<p className='text-body-lg font-medium text-ink text-center'>
					Видалити бажання?
				</p>
				<div className='flex gap-2 justify-center'>
					<Button
						variant='outline'
						onClick={onCancelDelete}
						tabIndex={confirmingDelete ? 0 : -1}
					>
						Скасувати
					</Button>
					<Button
						variant='destructive'
						onClick={onConfirmDelete}
						tabIndex={confirmingDelete ? 0 : -1}
					>
						Видалити
					</Button>
				</div>
			</div>

			{/* ---- wish face ---- */}
			<div
				className={[
					'flex flex-1 flex-col transition-opacity duration-150 ease-out',
					confirmingDelete ? 'pointer-events-none opacity-0' : 'opacity-100'
				].join(' ')}
			>
				<div className='mb-2 flex items-start justify-between gap-2'>
					<WishMedia wish={wish} />

					<button
						type='button'
						onClick={onToggleDone}
						aria-pressed={wish.isDone}
						aria-label={
							wish.isDone
								? 'Зняти позначку «здійснено»'
								: 'Позначити здійсненим'
						}
						tabIndex={confirmingDelete ? -1 : 0}
						className={[
							'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border',
							'text-body transition-opacity duration-150 ease-out',
							wish.isDone
								? 'border-ink-soft bg-ink-soft text-surface-alt'
								: 'border-hairline bg-transparent text-ink',
							// Desktop reveals the controls on hover; touch devices, which
							// have no hover, keep them visible (interactions.md §2.3).
							'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
						].join(' ')}
					>
						✓
					</button>
				</div>

				<h3 className='text-body-lg font-medium text-ink'>{wish.title}</h3>
				{price ? <p className='text-body text-mid-gray'>{price}</p> : null}

				{wish.url ? (
					<a
						href={wish.url}
						target='_blank'
						rel='noopener noreferrer'
						tabIndex={confirmingDelete ? -1 : 0}
						className='mt-1 self-start text-caption text-mid-gray transition-colors duration-150 ease-out hover:text-ink'
					>
						Подивитися →
					</a>
				) : null}

				<div className='mt-[auto] flex items-center pt-1'>
					<button
						type='button'
						onClick={onRequestDelete}
						aria-label='Видалити бажання'
						tabIndex={confirmingDelete ? -1 : 0}
						className={[
							'inline-flex h-8 w-8 items-center justify-center rounded-control text-ember',
							'transition-opacity duration-150 ease-out',
							'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
						].join(' ')}
					>
						<TrashIcon />
					</button>
				</div>
			</div>
		</article>
	);
}

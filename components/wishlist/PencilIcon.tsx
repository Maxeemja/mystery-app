/**
 * Edit affordance. Carries no color of its own — the parent sets it, the same
 * arrangement `TrashIcon` uses.
 *
 * Thin-stroke geometric icon at 1.75px, matching the trash and the upload
 * arrow (docs/style-guide.md §Imagery). Deliberately not Ember: editing is not
 * destructive, and Ember is reserved for actions that destroy something
 * (docs/prompter-task-edit-wish.md §2).
 */
export function PencilIcon() {
  return (
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

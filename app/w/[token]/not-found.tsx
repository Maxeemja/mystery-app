import { ButtonLink } from '../../../components/ui/Button'

/**
 * Shown for a share token nobody owns — docs/stage-2.md §5.3.
 *
 * Scoped to this route rather than the app-wide not-found so the copy can be
 * about the list specifically. It is served with a real 404: a bad token is a
 * page that isn't there, not a server failure, and returning 500 would make
 * every mistyped link look like an outage.
 */
export default function GuestListNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-page items-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm text-center">
        <h1 className="text-heading-sm font-semibold text-ink sm:text-heading">
          Такого списку не існує
        </h1>
        <p className="mt-3 text-body text-mid-gray">
          Можливо, посилання неповне або застаріле.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/">На головну</ButtonLink>
        </div>
      </div>
    </main>
  )
}

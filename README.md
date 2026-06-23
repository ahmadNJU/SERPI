# SERPI
Society for Economic and Regional Policy Interactions

Static site for the Society and its journal, *Economic and Regional Policy
Interactions*, plus a Netlify-hosted manuscript submission system backed by
Neon (Netlify DB) and Netlify Blobs.

## Pages

| Path | File | Notes |
| --- | --- | --- |
| `/` | `index.html` | Society home |
| `/journal.html` | `journal.html` | Journal home (aims, ethics, indexing) |
| `/guide-for-authors` | `guide-for-authors.html` | Author guidelines |
| `/membership.html` | `membership.html` | Society membership application (Web3Forms) |
| `/submit.html` | `submit.html` | Public manuscript submission form |
| `/track` | `track.html` | **Public** author submission tracking (reference + email) |
| `/contact` | `contact.html` | **Public** editorial contact form (no address exposed) |
| `/editor` | `editor.html` | **Protected** editorial console |

## API (Netlify Functions)

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/submit-paper` | `POST` | Public | Accept a manuscript (multipart), store file in Blobs + row in Neon, generate a stable reference, write initial status history, email the editor |
| `/api/track` | `POST` | Public | Return a submission's status + author-visible timeline, only when reference **and** email match the same record |
| `/api/contact` | `POST` | Public | Email a contact-form message to the editorial office (reply-to the sender) |
| `/api/papers` | `GET` | **Bearer** | List/read submissions (incl. corresponding-author email + reference) |
| `/api/papers` | `PATCH` | **Bearer** | Update status, with an optional note + author-visibility, recorded in history |
| `/api/download` | `GET` | **Bearer** | Stream the stored manuscript file from Blobs |

Privileged endpoints require `Authorization: Bearer ${EDITOR_TOKEN}` and return
`401` without it. The public `/api/track` and `/api/contact` expose nothing
sensitive: `/track` returns no file links, no email, and only author-visible
timeline rows, and never confirms a reference or email independently;
`/contact` never reveals the destination address.

## References

Each submission gets a stable reference **`ERPI-YYYY-NNNNN`** (e.g.
`ERPI-2026-00001`). The year is the submission year and `NNNNN` is a per-year
sequence that resets to `00001` each January. Numbers are claimed atomically
via the `reference_counters` table, stored on the row, and never recomputed.
The same reference appears on the submission success screen, in `/editor`, the
CSV export, the editor notification email, and `/track`.

## Email behaviour

On submission only the **editorial office** is emailed (reply-to the
corresponding author). **No confirmation email is sent to authors** — they are
contacted manually, and can self-serve status via `/track`.

## Environment variables

Set these in the Netlify site (**Site settings → Environment variables**):

| Variable | Required | Description |
| --- | --- | --- |
| `EDITOR_TOKEN` | Yes | Secret bearer token guarding `/api/papers` and `/api/download`. |
| `NETLIFY_DATABASE_URL` | Yes | Neon/Netlify DB connection (provisioned by the Netlify DB extension). |
| `RESEND_API_KEY` | For email | API key from [resend.com](https://resend.com). If unset, emails are skipped. |
| `MAIL_FROM` | For email | Verified sender, e.g. `ERPI Editorial Office <no-reply@your-domain>`. |
| `EDITORIAL_EMAIL` | For email | Destination for new-submission notifications **and** contact-form messages. Never exposed to clients. |

No new environment variables were added in this round. See `.env.example`.

## Editorial console

Visit `/editor`, enter the `EDITOR_TOKEN` (kept in `sessionStorage` only), and:

- review every submission — reference, date, title, authors, type,
  corresponding author + email, institution, status;
- search (title / author / reference / email), filter by status, sort by date,
  and see counts per status;
- change status with an optional note and a "show this note to the author"
  toggle (persisted to `submission_status_history`);
- export the current filtered view as CSV (metadata only, no files);
- download each manuscript (streamed from Blobs with the bearer token).

## Design system

The site uses a shared navy (`#0C1B33`) / rust (`#A8502E`) palette on a warm
"paper" background (`#F4EEE4`), with Spectral (headings) + Source Sans 3 (body).
Tokens and common chrome (utility bar, navy header, footer, buttons) live in
`assets/site.css`, which every page links **last** in its `<head>` so the
palette stays consistent. The Society homepage (`index.html`) and
`membership.html` are built directly to this system; the journal/submission
pages carry page-specific component CSS that inherits the shared tokens.

The membership form posts to [Web3Forms](https://web3forms.com) — replace the
`access_key` in `membership.html` with the Society's own key.

## Database

Drizzle ORM over Neon. Schema in `db/schema.ts`:

- `papers` — submissions (now with a unique `reference` column);
- `reference_counters` — per-year sequence for references;
- `submission_status_history` — append-only status timeline (`author_visible`
  rows power the public `/track` timeline).

Generate migrations with `npm run db:generate`. Migrations in
`netlify/database/migrations` are applied by the Netlify DB extension on deploy;
the `add_reference_and_history` migration also backfills references and seeds an
initial author-visible "submitted" history row for existing submissions.

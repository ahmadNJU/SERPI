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
| `/submit.html` | `submit.html` | Public manuscript submission form |
| `/editor` | `editor.html` | **Protected** editorial console |

## API (Netlify Functions)

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/submit-paper` | `POST` | Public | Accept a manuscript (multipart), store file in Blobs + row in Neon, email editor & author |
| `/api/papers` | `GET` | **Bearer** | List/read submissions (incl. corresponding-author email) |
| `/api/papers` | `PATCH` | **Bearer** | Update a submission's editorial status |
| `/api/download` | `GET` | **Bearer** | Stream the stored manuscript file from Blobs |

All privileged endpoints require `Authorization: Bearer ${EDITOR_TOKEN}` and
return `401` without it. No endpoint returns author names, emails,
institutions, or titles without a valid token. The corresponding-author email
is stored on submission and shown only inside `/editor`.

## Environment variables

Set these in the Netlify site (**Site settings → Environment variables**):

| Variable | Required | Description |
| --- | --- | --- |
| `EDITOR_TOKEN` | Yes | Secret bearer token guarding `/api/papers` and `/api/download`. Choose a long random string. |
| `NETLIFY_DATABASE_URL` | Yes | Neon/Netlify DB connection (provisioned by the Netlify DB extension). |
| `RESEND_API_KEY` | For email | API key from [resend.com](https://resend.com). If unset, emails are skipped (submissions still succeed). |
| `MAIL_FROM` | For email | Verified sender, e.g. `ERPI Editorial Office <no-reply@your-domain>`. |
| `EDITORIAL_EMAIL` | For email | Address that receives new-submission notifications. Defaults to `editors@serpi-journal.org`. |

See `.env.example` for a template.

## Editorial console

Visit `/editor`, enter the `EDITOR_TOKEN` when prompted (kept in
`sessionStorage` for the session only), and you can:

- review every submission — date, title, authors, type, corresponding author
  + email, institution, status;
- download each manuscript (streamed from Blobs with the bearer token);
- change a submission's status, saved straight to the Neon database.

## Database

Drizzle ORM over Neon. Schema lives in `db/schema.ts`; generate migrations with:

```bash
npm run db:generate
```

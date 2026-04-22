# Admin Route Authentication on Netlify

The `/admin/*` routes are protected by `netlify/edge-functions/admin-auth.ts`.

## Required Netlify Environment Variables

Set these in the Netlify UI or CLI. Do not commit real values to the repo.

| Variable | Purpose |
| --- | --- |
| `AAKAARA_ADMIN_PASSWORD_HASH` | Lowercase SHA-256 hex digest of the admin password |
| `AAKAARA_ADMIN_SESSION_SECRET` | Random high-entropy string used to sign the HTTP-only session cookie |

## Password Hash Generation

Generate the password hash locally, then store only the resulting hex digest in Netlify:

```sh
printf '%s' 'replace-with-admin-password' | shasum -a 256
```

## Runtime Behavior

- Unauthenticated `GET /admin/*` requests redirect to `/admin/login.html`.
- Login form submissions post to `/admin/login`.
- Successful login sets an HTTP-only, Secure, SameSite=Lax cookie scoped to `/admin`.
- Non-GET unauthorized requests return `401`.
- Admin responses are marked `no-store` and `noindex`.
- `/admin/logout` clears the session cookie.

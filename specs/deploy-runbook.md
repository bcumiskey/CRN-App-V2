# CRN v2 — Deploy & Preview Runbook

## Rollback discipline (standing policy)

Every release round = one commit + one annotated tag on `main`:
`v2.0-pre-overhaul` (anchor) → `v2.1.0` (bug overhaul) → `v2.2.0` (email/PDF/payments) → `v2.3.0` (calendar-sync integrity + worker app) → …

- **Code rollback:** `git revert <release commit>` (each round reverts independently), or redeploy the previous tag from Vercel's deployment list (instant).
- **DB rollback:** migrations are additive-only (new tables/indexes, never destructive), so rolling code back is always safe against a migrated DB. Before each `prisma migrate deploy`: export via `GET /api/backup/export` AND snapshot/branch in Neon.

## Fixing the preview "all zeros" (one-time setup)

The preview shows zeros because the new UI needs the new API + migrated DB.

1. **Neon** → create a branch from production (e.g. `staging`) — instant copy of
   real data. Copy its connection string.
2. **Apply the migration to the staging branch only** (from `crn-api/`):
   `$env:DATABASE_URL="<neon staging string>"; npx prisma migrate deploy`
3. **Vercel, crn-api project** → Settings → Environment Variables, scope **Preview**:
   - `DATABASE_URL` = Neon staging string
   - `BUSINESS_TIMEZONE` = Alex's IANA zone (defaults to `America/New_York`)
   - leave `RESEND_API_KEY` unset in Preview (Send falls back to mark-as-sent — no accidental emails)
4. **Vercel, crn-web project** → Preview-scoped API-base env var = crn-api's
   branch alias URL (`crn-app-v2-git-<branch>-….vercel.app`).
5. Redeploy both previews (Vercel → Deployments → Redeploy latest on the branch).
6. Recommended: enable **Deployment Protection** for previews on both projects
   (the API still runs the dev auth bypass; preview URLs shouldn't be public).

## Production deploy (per release)

1. Neon snapshot/branch + `GET /api/backup/export`.
2. Production env vars set: `BUSINESS_TIMEZONE`; for email `RESEND_API_KEY` +
   `EMAIL_FROM` (domain must be DNS-verified in Resend first) + optional `EMAIL_REPLY_TO`;
   from v2.3: `CRON_SECRET` (calendar-sync cron rejects everything until it exists).
3. Merge the release PR into `main` (this is the production deploy trigger).
4. **v2.3 only, before migrating:** `npx tsx prisma/dedupe-synced-jobs.ts` (dry-run →
   review → `--apply`) — the `(source, externalId)` unique-index migration fails if
   duplicate synced jobs exist. Duplicates with assignments/charges/line items are
   reported for manual cleanup, never auto-touched.
5. `npx prisma migrate deploy` against production (from `crn-api/` with prod `DATABASE_URL`).
6. One-time backfills, dry-run first, then `--apply` (from `crn-api/`):
   - `npx tsx prisma/backfill-team-paid.ts` — **must run before Alex's next pay-period close**
   - `npx tsx prisma/backfill-invoice-payments.ts` — ledger entries for legacy paid invoices
7. Smoke checks: invoice detail opens; Outstanding-by-Owner shows numbers;
   record a $0.01 payment on a test invoice and delete it; reports P&L loads;
   calendar sync-all runs clean from Settings.

Notes: Vercel Hobby limits crons to daily — v2.3 ships an hourly sync cron; change the
schedule in `crn-api/vercel.json` or upgrade the plan. Previews auto-migrate their own
(Neon-branch) database only when `PREVIEW_AUTO_MIGRATE=1` is set Preview-scoped.

## Mobile app (Expo / EAS) — first distributable build

The app has only ever run in dev mode (`expo start`); nothing is in cleaners'
hands yet. `eas.json` is configured (profiles bake `EXPO_PUBLIC_API_URL` to the
production API). To produce and hand out the first build:

1. `cd crn-app`
2. `npx eas-cli login` (browser OAuth — Bryan's Expo account; create one free at expo.dev if needed)
3. `npx eas-cli build:configure` — links the project (writes `extra.eas.projectId`
   into app.json; commit that change)
4. `npx eas-cli build --platform android --profile preview` — builds an
   installable APK on Expo's servers (~10-20 min); the output is a link/QR
   cleaners open on their phones to install. Re-run per release.
5. iOS later: requires an Apple Developer account ($99/yr); then
   `--platform ios` with internal distribution via TestFlight.

Notes: `assets/` doesn't exist yet — internal builds use Expo's default icon;
add real icon/splash assets before any store submission. OTA updates
(expo-updates) are not configured; each release is a new APK until that's set up.

## Auth activation order (v2.4)

1. Mobile build distributed FIRST (above) — the old dev-mode app has no unlock
   screen and would break the moment the secret is enforced.
2. Generate a strong passphrase locally (e.g.
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`).
3. Set `API_SHARED_SECRET` on the **crn-api** Vercel project (Production) → redeploy.
4. Web + mobile prompt on next use; give Alex and the cleaners the passphrase
   (entered once per device; "Lock this device" clears it).
5. Rollback: remove the env var and redeploy — instantly back to open mode.

## Rollback, per layer

| Layer | How |
|---|---|
| Web/API code | Vercel → previous deployment → "Promote to Production" (or `git revert` + push) |
| DB schema | Additive-only; leave in place (harmless to old code) or restore Neon snapshot |
| Data (backfills) | Both scripts log exactly what they stamped; Neon snapshot is the hard undo |

# EduFeed — Student Feedback Web App

A web application for collecting and analyzing student feedback on classes and teachers.
Admins build forms and analyze results; students submit feedback; a hidden super-admin sits
at the top of the trust chain. Teachers do **not** have accounts — they are records selected
from dropdowns during feedback.

> Feedback is **identified to admins** (to find non-submitters and review language) but
> **anonymous to teachers** (all reports are aggregate-only and never name students).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `output: "standalone"`) + React 19 |
| Language | TypeScript |
| ORM / DB | Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 15 |
| Auth | `jose` (JWT, HS256) + `argon2` (argon2id password hashing) |
| Validation | Zod 4 |
| Reports / export | `pdfkit` / `jspdf` (PDF), CSV export |
| Email | `nodemailer` (SMTP) |
| Charts | `recharts` |
| Styling | Tailwind CSS 4 |
| Runtime | Node 24 (alpine) |
| Deployment | Docker + Docker Compose, behind Nginx |

---

## Architecture at a glance

```
                    ┌──────────────────────────── Docker host (VPS) ────────────────────────────┐
   Internet ──443── │  nginx  ──http:3000──▶  app  ───────────────▶  postgres (5432, internal)   │
                    │ (proxy) (rate-limit,    (Next.js standalone      ▲                          │
                    │  headers, TLS)           + background worker)     │ pg_dump                 │
                    │                                                   │                          │
                    │                                          backup-cron (nightly dump)          │
                    └────────────────────────────────────────────────────────────────────────────┘
   Volumes:  pgdata (database)   ·   backups (nightly SQL dumps)
```

- **nginx** — reverse proxy. Terminates TLS, adds security headers, rate-limits `/api/`,
  and forwards to the app on port 3000. (Ports 80/443 are the only ports exposed to the host.)
- **app** — the Next.js server **and** a background worker run in the same container
  (`node scripts/worker.js & node server.js`). The worker polls the `Job` table every 5s and
  processes `REPORT` (PDF generation) and `EMAIL` jobs.
- **postgres** — database. **Not** published to the host (internal network only).
- **backup-cron** — a scheduled `pg_dump` to the `backups` volume at 02:00 daily.

Data volumes: `pgdata` (Postgres data) and `backups` (dump files).

### Key domain rules (see `student-feedback-app-spec.md` for the full contract)
- **Roles:** `SUPERADMIN` (hidden, one bootstrap account) → `ADMIN` → `STUDENT`.
- **Scoring:** every scored answer is normalized to **0–100** so scales are comparable.
- **Form versioning:** a form locks once it has ≥1 submission; edits require duplicating a version.
- **Deletion:** hard-delete when no feedback exists, otherwise archive (with a gated "purge" option).
- **Time zone:** timestamps stored in UTC; submission windows evaluated in **Asia/Kolkata**.

---

## Authentication & security model

- **Passwords:** hashed with **argon2id**. Login lockout after 5 failed attempts for 15 minutes.
- **Sessions:** short-lived **access JWT (15m)** + **refresh JWT (7d)**, both `httpOnly`,
  `sameSite=strict`, and `secure` in production. Every request re-reads `token_version` from the
  DB, so bumping it (password reset, recovery) instantly revokes all sessions.
- **Post-restore safety:** a `session-epoch.txt` file invalidates every token issued before a
  database restore.
- **Backups:** in-app backups are encrypted with **AES-256-GCM** (`BACKUP_ENCRYPTION_KEY`).
- **Mandatory secrets:** the app **refuses to run** if `JWT_SECRET` or `BACKUP_ENCRYPTION_KEY`
  are unset — there are no insecure fallbacks.

> ⚠️ **Known hardening item:** generated teacher report PDFs are currently written to
> `app/public/reports/` and served as **unauthenticated static files**. Anyone with the URL can
> download them. Put this behind an authenticated route before exposing the app publicly, or
> restrict `/reports/` at the proxy.

---

## Environment variables

Create a `.env` file in the repo root (next to `docker-compose.yml`). It is consumed by
Docker Compose at `up` time.

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `POSTGRES_PASSWORD` | ✅ | Postgres password; also injected into the app's `DATABASE_URL`. |
| `JWT_SECRET` | ✅ | Signs session/refresh JWTs. App throws if unset. Use ≥ 32 random bytes. |
| `BACKUP_ENCRYPTION_KEY` | ✅ | AES-256 key for encrypted backups. App throws if unset. |
| `NEXT_PUBLIC_APP_URL` | ✅ (prod) | Public base URL used to build password-reset links. |
| `SUPERADMIN_EMAIL` | ✅ (seeding) | Email for the bootstrap super-admin (used by the seed script). |
| `SMTP_HOST` / `SMTP_PORT` | ⭘ | SMTP relay for report + password-reset emails. |
| `SMTP_USER` / `SMTP_PASS` | ⭘ | SMTP auth (omit for an unauthenticated relay). |
| `SMTP_FROM` | ⭘ | From-address on outgoing mail. |

Generate strong secrets:
```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # BACKUP_ENCRYPTION_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
```

---

## Quick start (local, Docker)

```bash
# 1. Create .env (see the table above) with strong secrets
# 2. Build & start
docker compose up -d --build
# 3. Create the database schema (this project uses db push, NOT migrate)
docker compose exec app npx prisma db push
# 4. Seed the hidden super-admin (prints a one-time temp password)
docker compose exec -e SUPERADMIN_EMAIL=you@example.com app npx tsx scripts/super-admin.ts seed
# 5. Seed the department list
docker compose exec app npx tsx scripts/seed_departments.ts
```

Log in with the printed super-admin credentials, change the password immediately, then create
Admin accounts from the UI.

For full production instructions see:
- **[DEPLOYMENT_FULL_STACK.md](DEPLOYMENT_FULL_STACK.md)** — fresh Ubuntu VPS, using the bundled Nginx container.
- **[DEPLOYMENT_EXISTING_NGINX.md](DEPLOYMENT_EXISTING_NGINX.md)** — VPS that already runs Nginx as a Docker reverse proxy.

---

## Local development (without Docker)

Requires Node 24 and a reachable PostgreSQL.

```bash
cd app
npm ci
# set DATABASE_URL, JWT_SECRET, BACKUP_ENCRYPTION_KEY in app/.env
npx prisma db push
npm run dev        # runs prisma dev + the worker + next dev concurrently
```

---

## Useful operational commands

| Task | Command |
|------|---------|
| Apply schema changes | `docker compose exec app npx prisma db push` |
| Seed super-admin | `docker compose exec -e SUPERADMIN_EMAIL=… app npx tsx scripts/super-admin.ts seed` |
| Recover super-admin password | `docker compose exec app npx tsx scripts/recover-superadmin.ts "NewStrongPass"` |
| Seed a default admin (dev only) | `docker compose exec app npx tsx scripts/seed_admin.ts` |
| View app logs | `docker compose logs -f app` |
| Stop everything | `docker compose down` |

---

## Repository layout

```
.
├── app/                     # Next.js application
│   ├── src/app/api/         # Route handlers (auth, forms, submissions, reports, backups, …)
│   ├── src/app/dashboard/   # Admin & student dashboards
│   ├── src/lib/             # auth, prisma, pdf, backup-utils, analytics, validations
│   ├── scripts/             # worker + seed/recovery scripts
│   ├── prisma/schema.prisma # data model (no migrations dir — uses db push)
│   └── Dockerfile
├── nginx/                   # bundled reverse-proxy image (nginx.conf + Dockerfile)
├── csv templates/           # sample import templates
├── docker-compose.yml
└── student-feedback-app-spec.md   # authoritative product/engineering spec
```

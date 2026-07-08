# Deployment Guide — Full Stack on a Fresh Ubuntu VPS

Use this guide when you have a **blank Ubuntu VPS/VM** and want EduFeed to run its **own**
Nginx container as the public entry point. Everything (proxy + app + database + backups) runs
from this repository's `docker-compose.yml`.

> If your server **already runs Nginx as a Docker reverse proxy** (e.g. Nginx Proxy Manager,
> Traefik, or a shared proxy for several sites), use **[DEPLOYMENT_EXISTING_NGINX.md](DEPLOYMENT_EXISTING_NGINX.md)** instead.

---

## 1. Architecture you are deploying

```
                       ┌──────────────────────── Ubuntu VPS ────────────────────────┐
  Browser ── 80/443 ─▶ │  nginx container                                            │
                       │    · TLS termination (you add certs)                        │
                       │    · security headers + /api/ rate-limit                    │
                       │    · proxy_pass ──▶ app:3000                                 │
                       │                                                             │
                       │  app container   (Next.js standalone + background worker)   │
                       │    · serves the site, exposes :3000 on the internal net     │
                       │    · worker polls Job table → PDF reports + email           │
                       │                                                             │
                       │  postgres container  (:5432, internal only — NOT published) │
                       │  backup-cron container  (nightly pg_dump → backups volume)  │
                       └─────────────────────────────────────────────────────────────┘
     Networks:  internal_network (bridge)
     Volumes:   pgdata  (database)   ·   backups  (nightly dumps)
```

Only ports **80** and **443** are published to the host. Postgres is never exposed.

**Request flow:** Browser → nginx (`:443`) → `app:3000` → Prisma → `postgres:5432`.
Long tasks (report PDFs, emails) are queued in the `Job` table and handled asynchronously by
the worker that runs inside the app container.

---

## 2. Prerequisites (run once on the VPS)

```bash
# Update and install Docker Engine + Compose plugin
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER      # log out/in after this so `docker` works without sudo

# Basic firewall: allow SSH + HTTP/HTTPS only
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Verify: `docker --version` and `docker compose version`.

---

## 3. Get the code

```bash
cd /opt
sudo git clone <your-repo-url> edufeed
sudo chown -R $USER:$USER /opt/edufeed
cd /opt/edufeed
```

---

## 4. ⭐ Create the `.env` file — **do this BEFORE building**

This is the **first place you provide secrets.** Docker Compose reads `.env` at `up` time and
substitutes `${...}` values into `docker-compose.yml`. The app **will not start** without
`JWT_SECRET` and `BACKUP_ENCRYPTION_KEY`.

Generate strong values:
```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 48)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

Create `/opt/edufeed/.env`:
```env
# --- Database ---
POSTGRES_PASSWORD=<paste-generated-value>

# --- Security (MANDATORY — app throws if missing) ---
JWT_SECRET=<paste-generated-value>
BACKUP_ENCRYPTION_KEY=<paste-generated-value>

# --- Public URL (used to build password-reset links) ---
NEXT_PUBLIC_APP_URL=https://feedback.yourdomain.edu

# --- Bootstrap super-admin email (used only by the seed script) ---
SUPERADMIN_EMAIL=superadmin@yourdomain.edu

# --- SMTP (optional; needed for report + reset emails) ---
SMTP_HOST=smtp-relay.yourprovider.com
SMTP_PORT=587
SMTP_USER=feedback@yourdomain.edu
SMTP_PASS=your-smtp-app-password
SMTP_FROM=EduFeed <feedback@yourdomain.edu>
```

Lock down the file:
```bash
chmod 600 .env
```

> **When to give env details:** now, before the first `docker compose up`. If you change `.env`
> later you must run `docker compose up -d` again to re-inject the values.

---

## 5. Build and start the stack

```bash
docker compose up -d --build
```

This launches four containers: `nginx`, `app`, `postgres`, `backup-cron`.
Check status and logs:
```bash
docker compose ps
docker compose logs -f app     # Ctrl-C to stop following
```
If the app logs show a `JWT_SECRET is not set` error, your `.env` is missing/incorrect — fix it
and re-run `docker compose up -d`.

---

## 6. Create the database schema

This project ships **without a `prisma/migrations` folder**, so use `db push` (not
`migrate deploy`):

```bash
docker compose exec app npx prisma db push
```

This creates all tables directly from `prisma/schema.prisma`.

---

## 7. ⭐ Seed the super-admin and departments — **passwords are issued here**

The super-admin is **hidden** and created from an env value on first deploy. The seed script
generates a **random one-time password** and prints it to the console.

```bash
docker compose exec app npx tsx scripts/super-admin.ts seed
docker compose exec app npx tsx scripts/seed_departments.ts
```

Expected output (example):
```
Super-admin created successfully.
Email: superadmin@yourdomain.edu
Temporary Password: 9f3c1a7e5b2d0c48 a1b2...
Please login and change your password immediately.
```

> **When super-admin credentials appear:** only at this step, only once, in the terminal output.
> **Copy the temporary password now.** It is not stored in plaintext anywhere and cannot be
> retrieved later. The account is flagged `must_change_password`, so you'll be forced to set a
> new one at first login.

**If you ever lose the super-admin password**, reset it from the CLI (this revokes all its
sessions):
```bash
docker compose exec app npx tsx scripts/recover-superadmin.ts "AStrongNewPassword123"
```

### Admin accounts
Do **not** hand out the super-admin. Create day-to-day **Admin** accounts from the UI:
**log in as super-admin → Admins → create admin.** Each new admin is given a temporary password
(shown once) and forced to change it on first login.

> A `scripts/seed_admin.ts` exists that creates `admin@edufeed.com / admin123`. This is a
> **development convenience only** — never use it in production, or change the password
> immediately if you do.

---

## 8. Enable HTTPS (TLS)

The bundled `nginx/nginx.conf` listens on **port 80 only** by default and the `443` block is
commented out. Session cookies are marked `secure` in production, so **the app effectively
requires HTTPS** to log in. Choose one:

**Option A — terminate TLS at the bundled Nginx.** Obtain a certificate (e.g. Certbot on the
host or a DNS provider), mount the certs into the nginx container, and add a `listen 443 ssl;`
server block plus an `80 → 443` redirect in `nginx/nginx.conf`. Then rebuild:
```bash
docker compose up -d --build nginx
```

**Option B — put a host-level TLS terminator in front** (host Nginx/Caddy) that proxies to the
container's port 80. In that case publish the app or the nginx container appropriately.

> For a single-site VPS, Option A keeps everything in Compose. Certificates typically live on the
> host and are mounted read-only into the nginx container via a `volumes:` entry.

---

## 9. Point your domain and verify

1. Add a DNS `A` record for `feedback.yourdomain.edu` → your VPS IP.
2. Ensure `NEXT_PUBLIC_APP_URL` in `.env` matches that URL exactly (re-run `docker compose up -d`
   if you changed it).
3. Browse to the URL, log in as super-admin, change the password, create an Admin, and confirm:
   - form creation + assignment works,
   - a student submission is recorded,
   - a report PDF generates (Reports → generate),
   - CSV export downloads.

---

## 10. Backups & restore

- **Automatic:** `backup-cron` writes a nightly `pg_dump` gzip to the `backups` volume at 02:00.
- **In-app:** the super-admin's Backups screen creates **AES-256-GCM encrypted** backups
  (`BACKUP_ENCRYPTION_KEY`) that can be downloaded and restored from the UI. **Keep
  `BACKUP_ENCRYPTION_KEY` safe and unchanged — without it, encrypted backups cannot be restored.**
- A restore bumps the session epoch, invalidating all existing logins for safety.

Manual copy of the nightly dumps off the box:
```bash
docker compose cp backup-cron:/storage/backups ./backups-download
```

---

## 11. Day-2 operations

| Task | Command |
|------|---------|
| Update to a new release | `git pull && docker compose up -d --build` |
| Apply schema changes | `docker compose exec app npx prisma db push` |
| Tail logs | `docker compose logs -f app` |
| Restart just the app | `docker compose restart app` |
| Stop everything | `docker compose down` (add `-v` to also wipe volumes — **destroys data**) |

---

## 12. Production hardening checklist

- [ ] `.env` has strong, unique `JWT_SECRET`, `BACKUP_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`; file is `chmod 600`.
- [ ] HTTPS is enabled and HTTP redirects to HTTPS.
- [ ] Super-admin temporary password was changed at first login; it is not shared.
- [ ] Firewall (ufw) allows only 22/80/443; Postgres stays internal.
- [ ] `/reports/` static PDFs are protected (see the known hardening item in the README) before public exposure.
- [ ] Off-box copies of backups are scheduled, and `BACKUP_ENCRYPTION_KEY` is stored in a separate secret vault.

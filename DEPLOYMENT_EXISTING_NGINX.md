# Deployment Guide — VPS with an Existing Dockerized Nginx

Use this guide when your server **already runs Nginx as a Docker container** acting as a reverse
proxy for one or more sites (e.g. **Nginx Proxy Manager**, a shared custom Nginx container, or
Traefik). Here EduFeed does **not** run its own proxy — your existing proxy terminates TLS and
forwards traffic to the EduFeed **app** container.

> Deploying to a blank server where EduFeed should run its own proxy? Use
> **[DEPLOYMENT_FULL_STACK.md](DEPLOYMENT_FULL_STACK.md)** instead.

---

## 1. Architecture you are deploying

```
                    ┌──────────────────────────── Ubuntu VPS ────────────────────────────┐
 Browser ─ 443 ───▶ │  EXISTING nginx proxy (your container, already running)             │
                    │      · TLS + domain routing (you add a proxy host)                   │
                    │      · proxy_pass ──▶ edufeed app:3000                               │
                    │                                                                     │
                    │  app container   (Next.js standalone + background worker)            │
                    │  postgres container  (:5432, internal only)                          │
                    │  backup-cron container  (nightly pg_dump → backups volume)           │
                    └──────────────────────────────────────────────────────────────────────┘
     The EduFeed `nginx` service from docker-compose.yml is DISABLED here.
     The proxy reaches the app either over a shared Docker network or via a host port.
```

**The one thing that changes vs. the full-stack guide:** you skip EduFeed's bundled `nginx`
service and instead let your existing proxy reach the `app` container. There are two clean ways
to wire that up (Section 5).

---

## 2. Prerequisites

You already have Docker, Compose, and a working dockerized Nginx proxy. You only need `git` and
the ability to run `docker compose` in this repo. Confirm the **name of the Docker network** your
proxy is attached to — you'll need it:

```bash
docker network ls
docker inspect <your-proxy-container> --format '{{json .NetworkSettings.Networks}}'
```

Note that network name (e.g. `proxy` or `npm_default`); it's referenced in Section 5, Option A.

---

## 3. Get the code

```bash
cd /opt
sudo git clone <your-repo-url> edufeed
sudo chown -R $USER:$USER /opt/edufeed
cd /opt/edufeed
```

---

## 4. ⭐ Create the `.env` file — **before building**

Same secrets as the full-stack guide. The app **refuses to start** without `JWT_SECRET` and
`BACKUP_ENCRYPTION_KEY`. Generate values:

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 48)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

Create `/opt/edufeed/.env`:
```env
POSTGRES_PASSWORD=<generated>
JWT_SECRET=<generated>
BACKUP_ENCRYPTION_KEY=<generated>

# MUST be the public HTTPS URL your proxy serves (used for password-reset links)
NEXT_PUBLIC_APP_URL=https://feedback.yourdomain.edu

# Bootstrap super-admin email (used only by the seed script)
SUPERADMIN_EMAIL=superadmin@yourdomain.edu

# SMTP (optional)
SMTP_HOST=smtp-relay.yourprovider.com
SMTP_PORT=587
SMTP_USER=feedback@yourdomain.edu
SMTP_PASS=your-smtp-app-password
SMTP_FROM=EduFeed <feedback@yourdomain.edu>
```
```bash
chmod 600 .env
```

> **When to give env details:** now, before `docker compose up`. `NEXT_PUBLIC_APP_URL` must be the
> **HTTPS** address your proxy exposes, since TLS is terminated at the proxy, not in this stack.

---

## 5. Wire the app to your existing proxy (choose ONE)

Create a Compose **override** so you don't edit the base `docker-compose.yml`. Compose
automatically merges `docker-compose.override.yml`.

### Option A — share the proxy's Docker network (recommended, no host ports)
Your proxy reaches the app by container name over a shared network. Replace `proxy` with the
network you found in Section 2.

Create `/opt/edufeed/docker-compose.override.yml`:
```yaml
services:
  # Disable the bundled proxy — your existing Nginx does this job
  nginx:
    deploy:
      replicas: 0
    entrypoint: ["true"]      # no-op so the container never serves
    ports: []                 # release 80/443 so they don't clash with your proxy

  # Attach the app to your proxy's network in addition to the internal one
  app:
    networks:
      - internal_network
      - proxy

networks:
  proxy:
    external: true
    name: proxy               # <-- your proxy's actual network name
```

Then in your proxy, add a proxy host pointing to **`app:3000`** (the container name and internal
port). In Nginx Proxy Manager: *Add Proxy Host → Forward Hostname* `app`, *Forward Port* `3000`,
scheme `http`, and enable your SSL certificate + "Websockets Support".

> If your proxy config uses a hardcoded upstream, ensure it sets these headers so links,
> redirects, and rate-limit logging work correctly:
> `Host $host`, `X-Real-IP $remote_addr`, `X-Forwarded-For $proxy_add_x_forwarded_for`,
> `X-Forwarded-Proto $scheme`, and `Upgrade`/`Connection` for websockets.

### Option B — publish the app on a host loopback port
If sharing a network is inconvenient, expose the app only on localhost and have the proxy forward
to the host.

`/opt/edufeed/docker-compose.override.yml`:
```yaml
services:
  nginx:
    deploy:
      replicas: 0
    entrypoint: ["true"]
    ports: []

  app:
    ports:
      - "127.0.0.1:3000:3000"   # reachable only from the host, not the internet
```

Then point your proxy host at `http://127.0.0.1:3000` (or the host's Docker bridge gateway,
commonly `172.17.0.1:3000`, if the proxy container can't reach host loopback).

> **Never** publish Postgres to the host. Only the app port is exposed, and only on loopback.

---

## 6. Build and start (without the bundled proxy)

```bash
docker compose up -d --build
docker compose ps        # `nginx` should be absent/stopped; app, postgres, backup-cron running
docker compose logs -f app
```

---

## 7. Create the schema

This project has **no `prisma/migrations` folder** — use `db push`:
```bash
docker compose exec app npx prisma db push
```

---

## 8. ⭐ Seed the super-admin and departments — **passwords are issued here**

```bash
docker compose exec app npx tsx scripts/super-admin.ts seed
docker compose exec app npx tsx scripts/seed_departments.ts
```

The seed prints a **one-time random temporary password** for the hidden super-admin:
```
Super-admin created successfully.
Email: superadmin@yourdomain.edu
Temporary Password: <random 24-hex>
Please login and change your password immediately.
```

> **When super-admin credentials appear:** only here, once, in the terminal. Copy it now — it is
> never stored in plaintext and cannot be recovered, only reset. The account is forced to change
> its password at first login.

Lost it later? Reset from the CLI (revokes all its sessions):
```bash
docker compose exec app npx tsx scripts/recover-superadmin.ts "AStrongNewPassword123"
```

**Admin accounts:** create them in the UI as super-admin (**Admins → create admin**); each gets a
one-time temporary password and must change it on first login. The `scripts/seed_admin.ts`
(`admin@edufeed.com / admin123`) is a **dev-only** shortcut — avoid it in production.

---

## 9. TLS and domain (handled by your existing proxy)

- Add/verify the DNS `A` record for `feedback.yourdomain.edu` → VPS IP.
- Issue/attach the certificate **in your existing proxy** (e.g. Let's Encrypt in NPM). This stack
  serves plain HTTP internally; your proxy provides HTTPS to the world.
- Confirm `NEXT_PUBLIC_APP_URL` matches the public HTTPS URL. If you change it, re-run
  `docker compose up -d`.

---

## 10. Verify end-to-end

Browse to `https://feedback.yourdomain.edu` and confirm:
- super-admin login works over HTTPS (cookies are `secure`, so HTTP will not log you in),
- creating a form, assigning it, and a student submission all work,
- report PDF generation and CSV export succeed.

---

## 11. Backups, updates, operations

Identical to the full-stack guide:

| Task | Command |
|------|---------|
| Update | `git pull && docker compose up -d --build` |
| Schema change | `docker compose exec app npx prisma db push` |
| Logs | `docker compose logs -f app` |
| Copy nightly dumps off-box | `docker compose cp backup-cron:/storage/backups ./backups-download` |
| Stop | `docker compose down` |

- Nightly `pg_dump` runs in `backup-cron`; in-app backups are AES-256-GCM encrypted with
  `BACKUP_ENCRYPTION_KEY` — **store that key separately and never rotate it without keeping the
  old value, or existing backups become unrecoverable.**

---

## 12. Hardening checklist

- [ ] Bundled `nginx` service is disabled; only your existing proxy is public.
- [ ] App is reachable **only** via the shared Docker network or a `127.0.0.1` host port — never a public port.
- [ ] Postgres is not published to the host.
- [ ] Proxy forwards `X-Forwarded-Proto=https` and `Host`; certificate is valid.
- [ ] `.env` secrets are strong and `chmod 600`; super-admin temp password was changed at first login.
- [ ] `/reports/` static PDFs are access-controlled before public exposure (see README known-item).
- [ ] Off-box backup copies scheduled; `BACKUP_ENCRYPTION_KEY` backed up to a separate vault.
```

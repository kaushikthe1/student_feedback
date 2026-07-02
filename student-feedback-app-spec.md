# Student Feedback Web App — Build Specification

A web application for collecting and analyzing student feedback on classes and
teachers. Two account types: **Admin** and **Student**, plus a hidden
**Super-admin**. Teachers do **not** have accounts — they are records selected
from dropdowns during feedback.

This document is the build brief. Implement it as written. All product decisions
are **resolved** (see §2). §11–§17 add the engineering contract (enums, API surface,
indexes/constraints, conventions, audit events, jobs, testing).

**Stack:** Next.js (App Router) + Prisma ORM + PostgreSQL, Dockerized behind Nginx.

---

## 1. Goals & scope

- Admins build feedback forms (rating / MCQ / dropdown / open-ended) and assign
  them to student batches with time-and-weekday submission windows.
- Students log in, pick an assigned form, identify the class/teacher, fill it in,
  and submit. Submissions are timestamped automatically.
- Admins analyze results (teacher-wise, department-wise, institute-wise), review
  individual feedback, monitor non-submitters and inappropriate language, generate
  per-teacher reports for download, and export filtered CSV.
- Deployed as Docker containers (Nginx + PostgreSQL + app) on a VPS, with strong
  security and automated encrypted backups.

**Out of scope (v1):** class scheduling/timetabling, teacher self-service portal,
mobile native apps, multi-institute tenancy.

---

## 2. Resolved product decisions (read first)

These govern the data model and behavior. All are final unless marked `[CONFIRM]`.

1. **Identity model** — Feedback is **identified to admins** (admins can see which
   student submitted what, to find non-submitters and review language) but
   **anonymous to teachers** (reports and anything a teacher receives are
   aggregate-only, never naming students). Students must see a clear privacy notice
   before their first submission stating who can view their responses. Every admin
   view of **raw identified feedback** — including the analytics teacher drill-down
   **and** the student-tab "what a student submitted" / language-review screens —
   emits a `RAW_FEEDBACK_VIEWED` audit event.

2. **Multiple submissions — KEEP ALL** — A student **may submit the same form for
   the same teacher multiple times**; each submission is a distinct, timestamped
   **session** and all are retained (no uniqueness constraint, no overwrite). The
   timestamp is the differentiator between sessions. See §6 for how repeats are
   counted in analytics.

3. **Scoring — per-question scales, normalized to 0–100** — Each rating question
   defines its **own** scale (`scale_min`..`scale_max`). Scored MCQ/dropdown
   questions instead derive their range from their option weights. Because scales
   vary, every scored answer is stored as a **normalized 0–100 value**, making scores
   comparable across questions and forms (formula in §6). Only `is_scored` questions
   count; rating questions are always scored; MCQ/dropdown are scored **only if their
   options carry numeric weights** (otherwise reported as counts/distributions);
   open-ended is never scored.

4. **Form versioning** — A form's questions lock once it has at least one
   submission. To change a locked form, **duplicate it as a new version**; old
   submissions stay attached to the version they were answered under. Assignment
   windows remain editable after lock.

5. **Deletion** — Admins can delete teachers and students, **individually or in
   bulk** (students by batch selection; teachers by multi-select / department).
   The **super-admin can never be deleted**. To protect analytics integrity, the
   delete behaves by feedback state:
   - **No feedback attached** → permanent hard delete (clean removal of mistaken
     or never-active records).
   - **Feedback exists** → delete **archives** the record (hidden from all new
     dropdowns and lists, but retained in analytics/history so past scores stay
     valid). A separate **"permanently purge (incl. feedback)"** action is available
     for true erasure (e.g. a wrong entry or a deletion request), gated behind a
     typed confirmation and written to the audit log. (Confirmed behavior.)
   - Bulk deletes show a summary (how many will hard-delete vs archive) and require
     explicit confirmation; all deletions are audit-logged.

6. **Time zone — Asia/Kolkata (India)** — All timestamps stored in **UTC**. The
   **server** is the trusted source of the current instant (containers may run UTC);
   submission-window rules (daily start/end time, allowed weekdays) are always
   **computed in Asia/Kolkata** regardless of container TZ, never from the browser
   clock.

7. **Super-admin — HIDDEN, top of the trust chain** —
   - Exactly one bootstrap super-admin exists; created by a **seed/env value on
     first deploy**.
   - **Hidden:** never shown in any admin-facing list; regular admins cannot see,
     edit, demote, reset, or delete it, and cannot tell it exists.
   - **Exclusive powers:** the only role that can **view audit logs**, perform
     **database restore**, and **override any admin's access**.
   - Retains **all normal admin powers**.
   - **Recovery (deliberately CLI-only):** if the super-admin password is lost, it
     is reset by a **server-side CLI command** run on the VPS (e.g. `docker exec`
     into the app container). The hidden super-admin is **never** emailed a reset
     link even though email exists (§2.8) — its address is private and an email path
     would weaken the "cannot tell it exists" property.
   - **No leak via errors:** duplicate-email failures (including a collision with the
     hidden super-admin's address) return a **generic** "this email can't be used"
     message — never one that confirms the super-admin exists. Its email is private
     and unguessable.

8. **Email — via the institution's Google Workspace SMTP relay** — Outbound mail is
   sent through `smtp-relay.gmail.com` (port 587, TLS), so mail comes from the real
   institutional domain. This enables: **auto-emailed teacher reports**,
   **self-service email password reset** (time-limited single-use link), **account-
   creation emails**, and **form-open + closing-reminder notifications** to students.
   The earlier no-email fallbacks remain supported (report **download**, admin-set
   temporary passwords, dashboard form discovery) so the app degrades gracefully if
   the relay is unavailable. All sends go through the async `EMAIL` job (§16) — one
   message per recipient, with retry + bounce handling — and respect the relay's
   limits (10,000 recipients/24h; ≤100 per transaction). Config + auth live in
   env/Docker secrets; SPF/DKIM/DMARC on the sending domain are required (§7/§8).

9. **Inappropriate-language monitoring — manual only** — No automated flagging, no
   LLM, no wordlist filter. Admins review feedback via the student-tab language
   filter (§5.8). May be revisited later.

10. **Data retention — keep indefinitely** — No automatic purge. A manual,
    super-admin-only purge tool may be added later. Privacy posture aligns with
    India's **DPDP Act 2023** (privacy notice + consent; retention is a conscious
    "keep" choice, not negligence).

11. **Batch snapshot on submission (validated by review)** — When a student moves
    batches, their past feedback is attributed to the batch they were in **at
    submission time** (accurate history). Batchwise filters use this snapshot.
    Treat as final unless you object.

12. **Admin self-service powers (confirmed — original design)** — Regular admins
    can create/edit other admins and reset admin/student passwords, per the original
    requirements. **Deleting or suspending an admin, however, is super-admin only**
    (resolves the §3/§12/§15 mismatch and limits privilege-escalation). Mitigation
    retained: all admin actions are **audit-logged and visible to the super-admin**,
    who can override, suspend, or delete any admin.

---

## 3. Roles & permissions (RBAC)

Enforce **server-side on every endpoint** — never rely on hiding UI alone.

| Capability | Super-admin (hidden) | Admin | Student |
|---|:--:|:--:|:--:|
| View audit logs | ✅ (exclusive) | ❌ | — |
| Override / suspend / delete any admin | ✅ (exclusive) | ❌ | — |
| Create / edit admins | ✅ | ✅ (cannot see/affect super-admin) | — |
| Reset any admin/student password | ✅ | ✅ | — |
| Manage teachers, departments, batches (incl. delete) | ✅ | ✅ | — |
| Create / import / edit / move / delete students | ✅ | ✅ | — |
| Build / version / assign forms | ✅ | ✅ | — |
| View analytics & raw (identified) feedback | ✅ | ✅ | — |
| Generate & download teacher reports | ✅ | ✅ | — |
| Export CSV | ✅ | ✅ | — |
| Trigger a DB backup | ✅ | ✅ | — |
| Download / restore the DB backup | ✅ (exclusive) | ❌ | — |
| Submit feedback (assigned forms) | — | — | ✅ |
| View own submission history (metadata only) | — | — | ✅ |
| Change own password | ✅ | ✅ | ✅ |

---

## 4. Data model

Single `users` table holds auth for super-admin + admins + students; teachers are
**not** users. Add `id`, `created_at`, `updated_at` to all. **Enum values are stored
in the §11 canonical UPPERCASE form** (lowercase inline below is illustrative only).
**Lifecycle flags — related by a deliberate cascade:** `is_active` (on **users**) is
the *mechanism* — it gates **both authentication and email uniqueness**; `archived`
(+`archived_at`, `archived_by`, on teachers/students/forms) is the *reason* a record
was retired. **Archiving a student sets that user's `is_active = false`** (and
re-activating re-checks email uniqueness), so the login gate and the `users.email`
index are both single-column checks on `users.is_active`. (Teachers/forms aren't
users, so their `archived` flag keys their own partial indexes directly.) Indexes
and constraints are listed in §13.

- **users** — `role` (`superadmin`|`admin`|`student`), `email` (unique),
  `password_hash`, `name`, `must_change_password` (bool), `is_hidden` (bool; true
  for super-admin), `is_active` (bool), `token_version` (int; bumped to revoke all
  sessions — see §14), `last_login_at`, `failed_login_count`, `locked_until`.
- **student_profiles** — `user_id` (FK), `roll_number` (unique among non-archived),
  `batch_id` (FK→batches), `contact`, `privacy_accepted_at` (nullable),
  `privacy_notice_version` (nullable; evidences DPDP consent).
- **batch_history** — `student_profile_id`, `from_batch_id`, `to_batch_id`,
  `moved_by`, `moved_at`.
- **departments** — `name`, `code`.
- **teachers** — `name`, `email`, `phone`, `designation` (`faculty`|`resident` —
  designation and category are the same field), `department_id` (FK). *No login.*
- **batches** — `name` (e.g. "MBBS 2019"), `program`, `year`.
- **forms** — `title`, `description`, `status` (`draft`|`published`|`archived`),
  `version`, `parent_form_id`, `locked` (bool), `is_template` (bool — templates are
  reusable, not assignable, and collect no submissions), `created_by`.
- **questions** — `form_id`, `order`, `text`, `type`
  (`rating`|`mcq`|`dropdown`|`open_ended`), `required` (bool), `is_scored` (bool),
  `scale_min`, `scale_max` (per-question, rating only).
- **question_options** — `question_id`, `order` (int, for deterministic rendering),
  `label`, `weight` (numeric, nullable; only when the MCQ/dropdown question is
  scored).
- **form_assignments** — `form_id`, `batch_id`, `start_date`, `end_date`,
  `daily_start_time`, `daily_end_time`, `allowed_weekdays` (set),
  `timezone` (kept only as future-proofing; must equal the institute TZ
  `Asia/Kolkata` for v1).
- **submissions** — `form_id` (points at the **specific version row** — see note),
  `student_id`, `teacher_id`, `department_id`, `designation_snapshot`,
  `batch_id_snapshot` (batch at submission time), `subject_topic` (optional),
  `submitted_at`, `is_flagged` (bool, manual review). **No uniqueness constraint** —
  multiple sessions allowed. *(Each form version is its own `forms` row with its own
  `id` and a `parent_form_id` linking the lineage; `forms.version` is the label.
  Since `form_id` already identifies the exact version, no separate `form_version`
  field is needed.)*
- **answers** — `submission_id`, `question_id`, `numeric_value` (rating),
  `option_id` (mcq/dropdown), `text_value` (open-ended), `normalized_score`
  (0–100, null if not scored).
- **reports** — `teacher_id`, `form_id`, `period_from`, `period_to`,
  `generated_at`, `generated_by`, `file_path`, `job_id` (FK→jobs).
- **jobs** — generic async-work record: `id`, `type` (`JobType`), `status`
  (`JobStatus`), `payload` (json), `result_path` (nullable), `error` (nullable),
  `created_by`, `created_at`, `started_at`, `completed_at`. Request-triggered async
  work (report generation, **email sends**, CSV export / restore later) runs through
  this table.
- **email_messages** — outbox/log for every send: `id`, `to`, `type`
  (`report`|`password_reset`|`account_setup`|`form_open`|`form_reminder`), `subject`,
  `status` (`QUEUED`|`SENT`|`FAILED`|`BOUNCED`), `job_id` (FK→jobs), `sent_at`,
  `error` (nullable), `created_at`. Enables retry, bounce handling, and "don't
  re-send" idempotency.
- **password_reset_tokens** — `id`, `user_id` (FK), `token_hash` (store only a hash),
  `expires_at` (short TTL), `used_at` (nullable; single-use), `created_at`.
- **audit_logs** — `actor_user_id`, `action`, `entity`, `entity_id`, `metadata`,
  `ip_address`, `created_at`. *(Visible to super-admin only.)*
- **backups** — `filename`, `created_by`, `created_at`, `size_bytes`,
  `is_encrypted` (always true).

---

## 5. Feature requirements

### 5.1 Authentication & accounts
- Email + password login. **Argon2id** hashing (chosen over bcrypt to avoid its
  72-byte truncation with no password max). Generic error on failure. Login is gated
  by a **single `is_active = true` check** — archiving a student cascades to
  `is_active = false` (§4), so suspended and archived accounts are both rejected
  without a separate profile join.
- Login **rate-limiting + temporary lockout** after repeated failures.
- **Forced password change on first login** for any admin-created or CSV-imported
  account. New accounts can optionally be **emailed their login + first-time setup
  link** (§2.8).
- **Password reset — two paths:** (a) **self-service** — the user requests a reset
  and receives a **time-limited, single-use email link** (via the Workspace relay);
  (b) **admin-set temporary password + forced change** (the fallback, and the only
  path for any account without a usable mailbox). Either way the reset **bumps the
  user's `token_version`**, checked on every request — so all existing access *and*
  refresh tokens are rejected immediately (see §14), killing any compromised session.
  Reset-request responses are generic (never reveal whether an email exists).
- **Super-admin recovery** via server-side CLI command only — never emailed (§2.7).
- Sessions: short-lived access token + refresh, or secure server sessions. Cookies
  `HttpOnly`, `Secure`, `SameSite=Strict`. CSRF protection on all mutations.

### 5.2 Admin — masters
- **Departments:** full CRUD (soft delete). *(Designation is a built-in
  `faculty`/`resident` classification — same field as category — so it needs no
  separate master.)*
- **Teachers:** CRUD with name, email, phone, department, and designation
  (`faculty`/`resident`). Searchable, paginated. **Delete individually or in bulk**
  (multi-select / by department), per the §2.5 feedback-safe rule. **Bulk import via
  CSV** (`name, email, phone, designation, department`) with the same strict dry-run
  validation as students: required headers, valid email, `designation` is `faculty`
  or `resident`, department exists, and no duplicate emails. A **"Download template
  CSV"** button provides the correct headers + one dummy row.
- **Batches:** CRUD (e.g. "MBBS 2019", "Nursing 2020").

### 5.3 Admin — students
- Create individually, or **bulk import via CSV**:
  `name, roll_number, batch, login_email, password, contact`.
  - CSV import runs a **strict validation/dry-run pass first**, checking:
    required headers present and correctly named; no extra/missing columns; each
    required field non-empty; **data types** valid (well-formed email, plausible
    contact number); batch exists; and **no duplicate roll numbers or emails**
    (within the file and against existing records). Report all errors per-row;
    allow fix + re-upload; commit only when clean. Passwords hashed on import;
    plaintext CSV never stored.
  - A **"Download template CSV"** button on the upload page provides the exact
    headers plus one dummy row, so admins always start from a valid file.
- Edit profile; **move between batches** (writes `batch_history`).
- Reset a student's password. Searchable, paginated, batch-filterable list.
- **Delete students individually or in bulk** — select a whole **batch** (e.g. to
  clear a graduated batch) or multi-select rows — per the §2.5 feedback-safe rule
  (hard delete if no feedback, archive if feedback exists, with an optional guarded
  permanent purge). Bulk delete requires confirmation and is audit-logged.

### 5.4 Admin — forms & assignments
- Form builder: rating / MCQ / dropdown / open-ended, reorderable, each markable
  `required` and (where applicable) `is_scored` with **per-question** scale or
  option weights.
- **Preview** before publishing.
- **Templates & duplication:** "Duplicate any form" copies a form (with its
  questions/options) into a new editable draft. "Save as template" marks a form as
  a reusable template (`is_template`, excluded from assignment). "Create from
  template" duplicates a template into a new draft. Reuses the same copy mechanics
  as versioning — lets admins avoid rebuilding common evaluations each term.
- Assign to one or more batches; per assignment: `start_date`, `end_date`,
  `daily_start_time`, `daily_end_time`, `allowed_weekdays` — evaluated in
  Asia/Kolkata. (E.g. "no submissions after 17:00, none on Sundays.")
- **Optional notifications (§2.8):** on assignment, email the batch's students that a
  form is open; send a **closing reminder** to those who haven't submitted before
  `end_date`. Per-assignment toggle; queued as `EMAIL` jobs and rate-paced to the
  relay limits.
- Versioning per §2.4.

### 5.5 Student — submit flow (two pages)
- Dashboard lists forms **currently assigned and open** to the student's batch
  (respecting the window). Closed/expired forms are not submittable. The dashboard is
  the source of truth; email notifications (§5.4) are supplementary.
- **Page 1 — class & teacher details:** designation (`faculty`/`resident`) →
  department → **teacher** (teacher dropdown loads only **after** department is
  chosen, filtered to that department), optional subject/topic.
- **Page 2 — questions.** Validate required answers.
- Submit → auto timestamp, new session row, confirmation. Repeats allowed (§2.2).
- Privacy notice before first submission (§2.1).

### 5.6 Student — profile & history
- Change own password.
- View **own submissions**: date + class details (form, department, teacher) —
  **never the answers/content**.

### 5.7 Management tab (admin / super-admin)
- Create/edit other admins; reset passwords (self, admins, students). **Deleting or
  suspending an admin is super-admin only** (§3).
- **Backup:** admins can **trigger** a full **encrypted** DB backup; scheduled
  automated encrypted backups (cron) run with rolling retention and a recommended
  off-site copy. **Downloading the dump is super-admin only** (it contains every
  password hash + all PII); each download emits `BACKUP_DOWNLOADED`.
- **Restore (super-admin only):** explicit confirmation + a **pre-restore safety
  snapshot**. During restore the app enters **maintenance mode implemented outside
  the database** (an env var / sentinel file at the app or Nginx layer, so the
  restore can't overwrite the flag): writes blocked, non-super-admin sessions
  invalidated. **On completion, force a global re-login** by bumping a **session
  epoch kept outside the restored DB** (alongside the maintenance sentinel) that is
  part of token validation — otherwise restoring an older snapshot would roll every
  `token_version` back to its backup-time value and **resurrect sessions revoked
  after the backup** (refresh tokens live up to ~30 days). An audit entry is written
  **before** (`RESTORE_STARTED`) and **after** (`RESTORE_COMPLETED`); in-memory cache
  is cleared on completion.

### 5.8 Analytics dashboard (admin)
**Teacher tab** — Average normalized score (0–100) for a chosen form, filterable
**teacher-wise / department-wise / institute-wise**. Drill into a teacher to view
**all detailed feedback** (audit-logged). Charts for trends/comparisons.

**Student tab** — Filter by **batch (snapshot), department, teacher** to see what a
student submitted; surface **non-submitters** for an assignment and **manually
review language** (sets/reads `is_flagged`). Both the "what a student submitted" view
and language review surface identified content, so each emits `RAW_FEEDBACK_VIEWED`
(§2.1).

### 5.9 Teacher reports (email and/or download)
- Per-teacher **PDF**, question-wise: the teacher's own mean, the **department
  average**, and the **institute average** — aggregate only, no student names.
- **Generate individually or in bulk.** Delivery options: **email each teacher their
  own report** directly via the Workspace relay (§2.8) — individually or bulk, queued
  as `EMAIL` jobs with retry/bounce handling — **and/or** download (single PDF, or a
  ZIP for bulk) as the fallback. Each report is logged in `reports`; emailed sends
  also record status in `email_messages`.

### 5.10 CSV export (admin)
- Filters: **Form (mandatory)**, **Date from/to (mandatory, max 1-year span)**,
  Department, Batch, Teacher.
- **Stream** the export. Clear header row. Admin-only, audit-logged.

---

## 6. Scoring & analytics rules

- **Normalization (per scored answer → 0–100):**
  - *Rating:* `(value − scale_min) / (scale_max − scale_min) × 100`.
  - *MCQ/dropdown:* `(weight − minWeight) / (maxWeight − minWeight) × 100`, where
    min/max are taken over **that question's option set**.
  - *Edge case:* if a scored choice question has only one option or all weights are
    equal (`maxWeight == minWeight`), it carries no discriminating signal — treat it
    as **not scored** (exclude from aggregates) rather than dividing by zero.
  - Open-ended is always excluded.
- **Multiple submissions (KEEP ALL):** when aggregating a teacher's score,
  **average per student first** — each student contributes **one** averaged value,
  then those per-student values are averaged. This prevents a student who submits
  many times from outweighing others. The same per-student-first rule applies to
  department and institute aggregates.
- A teacher/department/institute score is the mean of those per-student values
  across scored questions. Mixed-scale forms compare cleanly via normalization.

---

## 7. Non-functional requirements

### Security (concrete — all free / open-source; cost is setup time, not money)
- **TLS everywhere** — Let's Encrypt at Nginx, HTTP→HTTPS redirect, HSTS.
- Password hashing **Argon2id** (see §14 rationale); forced first-login change.
- **RBAC enforced server-side** on every route; super-admin checks for hidden powers.
- Login **rate-limiting + lockout**; rate-limit sensitive endpoints at Nginx too.
- **Parameterized queries via Prisma** (no string-built SQL) — prevents SQLi.
- **React auto-escaping / output encoding** — prevents XSS.
- **CSRF protection** on all mutations; secure cookie flags.
- **Server-side input validation** (e.g. zod) on every field; validate CSV
  type/size/row count.
- **Least-privilege DB user** — app's Postgres user is **not** a superuser and
  cannot drop the database. **Postgres is not published to the host** — reachable
  only on the internal Docker network from the app.
- **Secrets** via environment / Docker secrets, never committed.
- **Encrypted backups** (openssl/gpg) — they contain PII + hashed passwords.
- **Audit logging** of sensitive actions (e.g. password resets, raw-feedback views,
  exports, admin create/delete/suspend, backup download, restores — **full list in
  §15**) — visible to super-admin only.
- **Security headers** (CSP, X-Content-Type-Options, Referrer-Policy, etc.).
- **Dependency scanning** (`npm audit` / Dependabot) in CI; pinned versions.
- **Containers run non-root**, minimal base images, read-only FS where feasible.
- **SSH hardening** — move SSH off port 22 to a high random port; key-only auth
  (disable passwords); firewall (ufw) allowing only 80/443 + the SSH port;
  fail2ban.
- **Email (Workspace relay)** — credentials in env/Docker secrets; relay scoped to
  the server's IP (allowlist) with SMTP AUTH + TLS; **SPF, DKIM, DMARC** on the
  sending domain; password-reset tokens stored hashed, short-TTL, single-use;
  reset-request and email-exists responses kept generic.

### Privacy & compliance
- **DPDP Act 2023 (India):** privacy notice + consent at first submission; record
  who can view feedback. Retention is "keep indefinitely" by deliberate choice; an
  optional manual purge tool may be added later.

### Performance, UX, ops
- **Mobile-first responsive** UI — students mostly use phones.
- Pagination + search on all large lists.
- Connection pooling; handle batch-open submission spikes.
- Health-check endpoints per container; centralized logs + error tracking
  (free tier or self-hosted).
- Basic accessibility (labels, keyboard nav, contrast).

---

## 8. Architecture & deployment

**Three primary containers on one internal Docker network:**

1. **Nginx** — reverse proxy + TLS termination (Let's Encrypt), security headers,
   rate limiting, static assets. The **only** container exposing ports to the host:
   **80 (redirect) and 443**. Built to also front other apps later.
2. **App (Next.js)** — UI + API. Talks to Postgres over the internal network only.
   Runs non-root. Its container port is **not** published to the host.
3. **PostgreSQL** — persistent volume; **not** port-mapped to the host.

**Plus** a **scheduled backup job** (cron container) running `pg_dump`, encrypting
output, retaining a rolling window, recommended off-site copy. Named volume for
backups.

**Outbound email** goes to the institution's **Google Workspace SMTP relay**
(`smtp-relay.gmail.com:587`, STARTTLS), an external dependency — no mail server is
self-hosted. Configure the relay in the Workspace Admin console (Apps → Gmail →
Routing → SMTP relay), allowlist the app/VPS IP, require SMTP AUTH + TLS, and send
from a dedicated identity (e.g. `noreply@institute`). Credentials live in
env/Docker secrets.

```
Internet ──80/443──► Nginx ──► App (Next.js) ──► PostgreSQL (internal only)
                                   │
                                   └──► smtp-relay.gmail.com:587 (TLS, IP-allowlisted)
SSH ──(uncommon port, key-only, fail2ban)──► host
backup-cron ──► pg_dump ──► encrypted backups volume / off-site
```

Deliverables: `docker-compose.yml`, per-service `Dockerfile`s, `.env.example`
(no real secrets; includes SMTP relay host/port/auth placeholders), and a README
covering setup, TLS, SSH hardening, backups, the super-admin seed + CLI password
recovery, and the Workspace relay + SPF/DKIM/DMARC setup.

**Port policy:** public web stays on **443** (clean URLs; TLS already protects it).
Obscurity is applied where it actually reduces attack noise — **SSH** — not to the
web port. Postgres/app are protected by **non-exposure**, not by port choice.

**Deferred (designed-for, not built in v1):** a **Redis** container for shared
rate-limiting/session state and dropdown caching is **not needed** at single-app-
instance, institute scale — Nginx rate-limiting, DB-backed login lockout, and
in-memory caching of the small teacher/batch lists cover it. Keep rate-limit and
cache logic behind a thin interface so Redis can be slotted in later **if** the app
is scaled to multiple instances. Don't add it now.

---

## 9. Tech stack

- **Frontend + backend:** Next.js (App Router).
- **ORM:** Prisma. **DB:** PostgreSQL.
- **Auth:** NextAuth or custom JWT/session (with per-user `token_version`);
  **Argon2id** hashing.
- **Validation:** zod. **Charts:** a React chart library.
- **PDF:** server-side PDF generation for teacher reports.
- **CSV:** streaming export.
- **Email:** an SMTP client (e.g. Nodemailer) pointed at the Workspace relay; sends
  routed through the `EMAIL` job worker.
- **Containers:** Docker + docker-compose; Nginx reverse proxy.

---

## 10. Acceptance criteria (milestones)

1. Auth + RBAC + **hidden super-admin** (seed + CLI recovery) + forced password
   change.
2. Masters: departments, teachers (with faculty/resident designation), batches,
   incl. individual + bulk delete (feedback-safe per §2.5).
3. Students: individual create, **CSV import with dry-run validation**, edit,
   batch-move (with snapshot), password reset.
4. Form builder (4 types, per-question scoring, preview, **duplicate / save-as-
   template / create-from-template**) + versioning + batch assignment with
   time/weekday windows in Asia/Kolkata.
5. Student submit flow (2 pages, dept→teacher dependent dropdown, **multiple
   sessions kept**, privacy notice) + history (metadata only) + profile.
6. Analytics: teacher tab (normalized scores, **per-student-first averaging**,
   filters, drill-down) + student tab (non-submitters, manual language review).
7. Teacher PDF reports — generate individually + bulk; **email via Workspace relay
   and/or download** (ZIP for bulk).
8. CSV export with mandatory filters + 1-year cap (streamed).
9. Management: admin create/edit + password reset (delete/suspend super-admin only);
   admins trigger encrypted backups, **super-admin-only download + restore** with
   pre-restore snapshot and post-restore global re-login.
10. Automated encrypted scheduled backups + super-admin-only audit log + full §7
    security checklist + SSH hardening. Dockerized per §8.

---

## 11. Enums & constants

Define as enums (Prisma + app), never free strings:
- `UserRole`: `SUPERADMIN` | `ADMIN` | `STUDENT`
- `Designation`: `FACULTY` | `RESIDENT` (teacher classification = category)
- `QuestionType`: `RATING` | `MCQ` | `DROPDOWN` | `OPEN_ENDED`
- `FormStatus`: `DRAFT` | `PUBLISHED` | `ARCHIVED` (plus a separate `locked` bool,
  set true once a response exists)
- `AssignmentState` (derived, not stored): `UPCOMING` | `OPEN` | `CLOSED`
  (computed from dates + window in Asia/Kolkata)
- `JobType`: `REPORT` | `EMAIL` (later: `EXPORT` | `RESTORE`)
- `JobStatus`: `PENDING` | `RUNNING` | `COMPLETED` | `FAILED`
- `BackupStatus`: `PENDING` | `COMPLETED` | `FAILED`
- `DeletionMode`: `HARD_DELETE` | `ARCHIVE` | `PURGE`
- `AuditEvent`: enumerated in §15

**Lifecycle transitions:**
- Form: `DRAFT → PUBLISHED → (locked on first response) → ARCHIVED`. No edits to
  questions after lock; changes go through "duplicate as new version".
- Job: `PENDING → RUNNING → COMPLETED | FAILED`.
- Record (teacher/student/form): `active → archived → (optional) purged`.

Constants: pagination default page size **20**, max **100**. CSV import max
**10,000 rows**, max **10 MB**, **UTF-8 only**.

---

## 12. API surface (concise)

A REST surface; the agent may use Next.js route handlers / server actions but
should keep these resources and verbs. Every non-auth route requires a valid
session; every mutation enforces RBAC server-side and emits audit events where
relevant (§15).

- **Auth:** `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`,
  `POST /auth/change-password`, `POST /auth/forgot-password` (sends reset link —
  generic response), `POST /auth/reset-password` (consume single-use token)
- **Admins:** `GET/POST /admins`, `PATCH /admins/:id`,
  `POST /admins/:id/reset-password` *(any admin)*; `DELETE /admins/:id` and
  `POST /admins/:id/suspend` *(super-admin only, §3)*
- **Departments:** `GET/POST /departments`, `PATCH/DELETE /departments/:id`
- **Teachers:** `GET/POST /teachers`, `PATCH/DELETE /teachers/:id`,
  `POST /teachers/import`, `GET /teachers/template`, `POST /teachers/bulk-delete`
- **Batches:** `GET/POST /batches`, `PATCH/DELETE /batches/:id`
- **Students:** `GET/POST /students`, `PATCH/DELETE /students/:id`,
  `POST /students/import`, `GET /students/template`,
  `PATCH /students/:id/move-batch`, `POST /students/:id/reset-password`,
  `POST /students/bulk-delete`
- **Forms:** `GET/POST /forms`, `PATCH /forms/:id`, `POST /forms/:id/publish`,
  `POST /forms/:id/duplicate`, `POST /forms/:id/version`,
  `POST /forms/:id/save-as-template`, `GET /forms/templates`
- **Assignments:** `GET/POST /forms/:id/assignments`, `PATCH/DELETE /assignments/:id`
- **Student submission:** `GET /me/forms` (open assigned),
  `GET /forms/:id/teachers?department=…`, `POST /submissions`,
  `GET /me/submissions` (metadata only)
- **Analytics:** `GET /analytics/teacher` (filters),
  `GET /analytics/teacher/:id/feedback` (raw, audit-logged),
  `GET /analytics/student` (filters), `GET /analytics/non-submitters`
- **Reports:** `POST /reports/generate` (single/bulk → job), `GET /reports/:jobId`,
  `GET /reports/:jobId/download`, `POST /reports/email` (single/bulk → `EMAIL` jobs)
- **Export:** `POST /export/csv` (filters → stream)
- **Backups:** `GET /backups`, `POST /backups` (trigger — any admin);
  `GET /backups/:id/download`, `POST /backups/restore` *(super-admin only)*
- **Audit:** `GET /audit` (super-admin only)
- **Health:** `GET /health`, `GET /health/ready`

---

## 13. Indexes, constraints & validation

**Prisma indexes** — on all FK and analytics-filter columns:
- `submissions`: `teacher_id`, `student_id`, `form_id`, `department_id`,
  `batch_id_snapshot`, `submitted_at`, and composites `[teacher_id, submitted_at]`,
  `[department_id, submitted_at]`, `[form_id, submitted_at]`
- `answers`: `submission_id`, `question_id`
- `teachers`: `department_id`  ·  `student_profiles`: `batch_id`
- `audit_logs`: `actor_user_id`, `created_at`, `[entity, entity_id]`

**Uniqueness (partial — archiving releases the value for re-use):**
`users.email` → `UNIQUE (email) WHERE is_active = true` (students set
`is_active = false` on archive, §4); `teachers.email` →
`UNIQUE (email) WHERE archived = false`; `student_profiles.roll_number` →
`UNIQUE (roll_number) WHERE archived = false`. Each predicate references only its own
table's columns. Because email/roll are no longer globally unique, **every
by-email/by-roll lookup (login, password reset, duplicate-check) filters to the
active row** so it can't match a stale archived one. Plain unique: `batches.name`;
`departments.name`; `departments.code`; `(form_id, order)` on questions;
`(question_id, order)` on options.

**Validation:** rating `scale_max > scale_min` (integers); scored MCQ/dropdown —
every option carries a numeric `weight`, and the question's effective range is
`[minWeight, maxWeight]` over its option set (if `maxWeight == minWeight` the
question is treated as not scored, per §6); assignment `end_date ≥ start_date`,
`daily_end_time > daily_start_time`, `allowed_weekdays` non-empty ⊆ {SU…SA};
submission — required answers present and
`teacher.department == submission.department`.

**Atomic operations (single transaction, all-or-nothing):** CSV import (commit only
after the whole file validates), bulk delete/archive, and form version creation.
(Restore is atomic only for a **plain-format dump restored with
`--single-transaction`**; custom/directory-format restores use their own mechanism.)
CSV **export** reads from one consistent snapshot (a transaction / repeatable-read)
so streamed rows don't shift mid-export on a busy system.

---

## 14. Conventions

- **HTTP status codes:** 200/201 success; 400 validation; 401 unauthenticated;
  403 forbidden (RBAC); 404 not found; 409 conflict (concurrent edit); 422 invalid
  CSV/semantic; 429 rate-limited; 500 server. Error body:
  `{ error: { code, message, details? } }`.
- **Password policy:** min 12 chars with upper, lower, digit, and symbol. Hashed
  with **Argon2id** (not bcrypt — its 72-byte truncation would silently cut long
  passwords). *(Optional: block reuse of last 5 — needs a password-history table.)*
- **Sessions:** access token ~15 min, refresh ~7 days, absolute cap ~30 days;
  secure cookie flags per §5.1. **Immediate revocation:** each token carries the
  user's `token_version`; validation does an **authoritative per-request read** of
  the live `token_version` (cheap, indexed) — caching it would reopen a small
  revocation window, so read it live. Bumping `token_version` (on password change,
  reset, suspension, archive, delete) instantly rejects **both** access and refresh
  tokens. Validation **also** checks a global **session epoch stored outside the DB**
  (see §5.7), so a DB restore can force a global re-login without depending on the
  restored `token_version` values.
- **Concurrency:** optimistic locking via `updated_at` (or a `version` field) on
  form and profile edits → 409 on a stale write. (Forms also lock after the first
  response, which limits conflicts.)
- **CSP:** `default-src 'self'; object-src 'none'; frame-ancestors 'none'`
  (tighten per asset needs); plus the other security headers in §7.
- **Logging:** structured JSON per request — `request_id`, `user_id`, `role`, `ip`,
  `method`, `path`, `status`, `latency_ms`. Never log secrets, raw passwords, or
  full feedback bodies.
- **File storage (Docker volumes):** `/storage/reports` (PDFs/ZIPs),
  `/storage/backups` (encrypted dumps), `/storage/tmp` (transient CSV/work). Served
  only to authorized roles, never from a public path. **Cleanup:** `/storage/tmp`
  cleared on job completion; `/storage/reports` purged on a rolling window (e.g. 30
  days) so generated files don't grow unbounded.
- **Backup encryption:** AES-256 (via `gpg` or `age`); key in env/Docker secrets,
  never in the repo.
- **Audit-log retention:** retained **indefinitely** (matching §2.10), purgeable
  only by the super-admin.
- **Time:** the **server** is the trusted source of the current instant (clocks
  synced via **NTP**); window rules are always **computed in Asia/Kolkata**
  regardless of the container's TZ. The browser clock is never trusted.
- **Analytics caching (optional):** with the §13 indexes, queries are fast at this
  scale — caching isn't needed for v1. If added later, cache ~5 min and invalidate
  on new submission, in-memory (no Redis).

---

## 15. Audit events

Emit a typed `AuditEvent` for: `LOGIN`, `FAILED_LOGIN`, `PASSWORD_CHANGED`,
`PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET`, `ADMIN_CREATED`, `ADMIN_UPDATED`,
`ADMIN_SUSPENDED`, `ADMIN_DELETED`, `TEACHER_CREATED/UPDATED/ARCHIVED/DELETED/PURGED`,
`STUDENT_CREATED/UPDATED/MOVED/ARCHIVED/DELETED/PURGED`, `CSV_IMPORTED`,
`FORM_CREATED/UPDATED/PUBLISHED/DUPLICATED/VERSIONED/ARCHIVED`,
`ASSIGNMENT_CREATED/UPDATED/DELETED`, `RAW_FEEDBACK_VIEWED`, `CSV_EXPORTED`,
`REPORT_GENERATED`, `REPORT_EMAILED`, `BACKUP_CREATED`, `BACKUP_DOWNLOADED`,
`RESTORE_STARTED`, `RESTORE_COMPLETED`. Each row records actor, event, entity,
entity_id, metadata,
ip, timestamp. **Visible to super-admin only.**

---

## 16. Background jobs (reports & email)

Bulk report generation and all email sends must **not** block the request — run them
through the generic `jobs` table (no external broker needed at this scale):
- `POST /reports/generate` creates a `jobs` row (`type=REPORT`,
  `status=PENDING`) and returns a `jobId`.
- A server-side worker renders the PDF(s), zips bulk output to `/storage/reports`,
  writes a `reports` row, and sets the job `COMPLETED` (or `FAILED` with `error`).
- The admin polls `GET /reports/:jobId` and downloads when `COMPLETED`.

**Email (`type=EMAIL`):** every outbound message (report, password-reset link,
account setup, form-open/reminder) is queued as an `EMAIL` job and written to
`email_messages`. The worker sends via the Workspace relay (§8), **one recipient per
message**, paced under the relay limits (≤100/transaction, ≤10,000 recipients/24h),
with **retry on transient failure and bounce handling** (mark `FAILED`/`BOUNCED`,
don't silently drop). Idempotent on `email_messages` so a retry never double-sends.

A `jobs` table + a single worker process is enough; the same table later carries
`EXPORT`/`RESTORE` jobs. Single-teacher reports may render synchronously.

---

## 17. Testing requirements (do not skip)

The coding agent **must** write automated tests for the high-risk logic, not just
happy-path UI:
- **Unit:** RBAC per role/route; score normalization (per-question scales → 0–100);
  per-student-first averaging; CSV validation (headers, types, duplicates, limits);
  submission-window evaluation in Asia/Kolkata (incl. the 17:00 and Sunday cases);
  form versioning lock-on-first-response; delete vs archive vs purge rules; password
  policy; **password-reset token single-use + expiry; `EMAIL` job retry/bounce
  idempotency (no double-send)**.
- **Integration:** auth + refresh + forced-change flow; **self-service email reset
  end-to-end**; student submit (multiple sessions kept); analytics filters; report
  job lifecycle (**generate + email**); backup create + restore snapshot.
- **E2E (Playwright):** admin creates form → assigns → student submits → admin sees
  analytics → generates report; CSV import dry-run → fix → commit; bulk delete by
  batch with confirmation.

---

## 18. Review notes (product decisions)

- **Admin powers (§2.12) — decided: compromise.** Review recommended restricting
  admin **creation / deletion / promotion** to the super-admin. Outcome: regular
  admins **keep** create/edit + password-reset (the original design), but **deleting
  or suspending an admin is super-admin only** — adopting the highest-risk part of
  the recommendation while preserving day-to-day admin convenience. All admin actions
  are audit-logged and visible to the super-admin.
- **Batch snapshot (§2.11) — validated.** Review agrees: keep the at-submission
  snapshot so historical analytics never shift when a student graduates. Confirmed.

---

## 19. Open items

**None — all product and engineering decisions are resolved.** This spec is
build-ready. Re-open only if requirements change (e.g. scale grows enough to justify
Redis/analytics caching from §8/§14, or multi-institute/timetabling is added).

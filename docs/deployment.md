# Deployment, backup and recovery

## Environments

| Environment | Database | Host |
|-------------|----------|------|
| Local/dev | PGlite (`./data/pglite`) | `npm run dev` |
| Self-hosted testing | Postgres 16 (Docker Compose) | Docker / VPS |
| Production (planned) | Neon (or other managed Postgres) | Vercel |

## Required environment variables

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (≥32 characters)
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` (canonical public URL)
- Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Self-hosted Docker

1. Copy `.env.example` → `.env` and set secrets
2. `docker compose up --build -d`
3. Migrate: `DATABASE_URL=postgresql://wadl:wadl@localhost:5432/wadl_tab npm run db:migrate`
4. Seed if needed: `npm run db:seed`
5. Back up the `postgres_data` volume regularly (`pg_dump`)

### Backup (Postgres)

```bash
docker compose exec postgres pg_dump -U wadl wadl_tab > backup-$(date +%F).sql
```

### Restore

```bash
cat backup.sql | docker compose exec -T postgres psql -U wadl wadl_tab
```

## Vercel + Neon cutover

1. Create a Neon project; enable connection pooling if desired
2. Add env vars in Vercel project settings
3. Run migrations once against Neon (`npm run db:migrate` with Neon `DATABASE_URL`)
4. Deploy via Vercel Git integration or `vercel deploy`
5. Verify `/login`, `/public/draw`, and an admin mutation write an audit row

Application code is portable: only `DATABASE_URL` and auth URLs change.

## Recovery notes

- Prefer archival (`status=archived|disabled`) over hard deletes for institutions, teams and accounts referenced by history
- Draw versions remain in `draw_versions` when superseded
- Audit events in `audit_events` are append-only
- Team access tokens are hashed; regenerating a link revokes prior hashes

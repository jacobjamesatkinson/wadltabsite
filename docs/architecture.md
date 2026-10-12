# WADL Tab — Architecture

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router, TypeScript, React Server Components |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide |
| Auth | Better Auth (email/password + optional Google OAuth) |
| ORM | Drizzle ORM |
| Database | PostgreSQL in Docker/production; embedded **PGlite** for local/dev without Docker (`DATABASE_URL=pglite`) |
| Validation | Zod on server actions |

## Runtime modes

1. **Local / testing (default):** `DATABASE_URL=pglite` stores data under `./data/pglite`.
2. **Self-hosted:** `docker compose up` runs Postgres + app. Set `DATABASE_URL=postgresql://wadl:wadl@postgres:5432/wadl_tab`.
3. **Vercel + Neon:** same codebase; set `DATABASE_URL` to the Neon connection string and deploy. No Docker-specific APIs in application code.

## Project layout

```
src/
  app/                  # Route groups: (admin), (coordinator), (adjudicator), (ha), public, team/[token]
  app/actions/          # Server Actions with permission checks
  components/           # Shell, tables, shadcn UI
  db/                   # Schema, migrations, seed, migrate
  lib/auth/             # Better Auth server + client + session helpers
  lib/permissions/      # Role/scope enforcement
  lib/draw/             # Power-pairing draw engine
  lib/adjudicators/     # Allocation algorithm
  lib/results/          # Standings helpers
  lib/audit/            # Audit event writer
```

## Auth vs authorisation

Authentication (Better Auth session) proves identity. Authorisation is separate:

- Roles: `admin`, `coordinator`, `adjudicator`, `head_adjudicator`
- Scopes: institution (coordinator), competition/venue/division (head adjudicator)
- Student access uses hashed, revocable tokens — not login roles
- Every protected Server Action calls `requirePermission` / scope helpers
- Navigation is filtered from the same permission map (UI-only filtering is not security)

## Draw pipeline

1. Rank teams by competition config (wins + tiebreakers)
2. Allocate bye if odd count (prefer lowest-ranked without prior bye)
3. Pair within win brackets; pull-up leftovers with warnings
4. Score soft preferences (rematch, same institution)
5. Allocate rooms × timeslots without double-booking
6. Persist as draft `DrawVersion`; publish only if `hardViolations` is empty

## Cutover to Vercel + Neon

1. Create Neon database; copy connection string
2. Set env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, Google OAuth if used
3. Run `npm run db:migrate` against Neon (from CI or locally)
4. Optionally `npm run db:seed` for a demo environment
5. Deploy the Next.js app to Vercel (`output: "standalone"` also supports container hosts)

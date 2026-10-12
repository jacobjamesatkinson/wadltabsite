# WADL Tab — Competition Management and Tabulation

Production-oriented web app for Western Australian Debating League competition administration, draw generation, adjudicator allocation, results and role-specific portals.

## Quick start (local, no Docker)

Requires Node.js 20+.

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wadl.local | Admin123! |
| Coordinator | coordinator@wadl.local | Coord123! |
| Adjudicator | adjudicator@wadl.local | Adj123! |
| Head adjudicator | headadj@wadl.local | HeadAdj123! |

Local default database is **PGlite** (`DATABASE_URL=pglite`), persisted under `./data/pglite`.

## Docker (self-hosted / testing with Postgres)

```bash
# Set BETTER_AUTH_SECRET in .env
docker compose up --build
```

Then run migrations/seed against Postgres:

```bash
DATABASE_URL=postgresql://wadl:wadl@localhost:5432/wadl_tab npm run db:setup
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js development server |
| `npm run build` / `start` | Production build |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | Migrate + seed |
| `npm test` | Vitest (draw engine + permissions) |

## Docs

- [Architecture](docs/architecture.md)
- [Competition policies](docs/competition-policies.md)
- [Deployment](docs/deployment.md)

## Public surfaces

- `/public/draw` — published draw (no auth)
- `/team/[token]` — private student team portal
- `/login` — Better Auth email/password (+ Google when configured)

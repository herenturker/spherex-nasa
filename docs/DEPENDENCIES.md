# Dependencies and runtime environment

The Floot source inventory records these explicitly attached project packages:

- jszip 3.10.2
- kysely-postgres-js 3.0.0
- kysely 0.28.17
- nanoid 6.0.2
- postgres 3.4.9
- recharts 3.10.1
- sharp 0.35.5
- superjson 2.2.2
- zod 4.6.7

The project also uses React 19 and other packages provided by Floot's framework. Floot's internal framework dependencies, secret environment variables, project-hosted storage and PostgreSQL resource are NOT encoded into a conventional standalone package.json. For source inspection use the exact virtual Floot item layout; do not assume this distribution is a zero-configuration Vite/Next.js project.

The `database/` snapshot is intended for a separate PostgreSQL resource. Python's `psycopg[binary]` is required only for the optional database import script, not for the production frontend.

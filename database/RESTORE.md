# PostgreSQL archive restoration

The snapshot includes all four application tables:

- `spherex_targets.jsonl` — 19 target definitions.
- `spherex_catalog_cache.jsonl` — 19 cached NASA catalogue query results.
- `spherex_processed_frames/*.jsonl.gz` — 114 processed FITS image rows, partitioned by sky target.
- `spherex_reports/*.jsonl.gz` — 62 saved scientific reports, partitioned by target and export half.

**Never restore into the existing live project database.** Create an empty Postgres database in a new development workspace first. From the unzipped repository root:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
python -m pip install 'psycopg[binary]'
python scripts/restore_postgres.py --database-url "$DATABASE_URL" --directory database
```

The importer refuses to run if ANY target table already has rows. It uses a single transaction, parameterized values and safe identifiers; no credentials are bundled.

## Fidelity

Table row counts and original FITS source URLs, cache keys, timestamps, source SHA-256 fields and processed PNG previews are retained. Some `science_gzip` strings were regenerated losslessly from the science JSON returned by the application's own database-backed endpoint. They retain the scientific arrays, wavelength grids, variance and ePSF fields, but **their compressed bytes need not exactly match the original database gzip bytes** (notably legacy ePSF normalization).

This export is a **functional normalized snapshot**, not a byte-for-byte `pg_dump`. The included `schema.sql` is a portability-oriented reconstruction of data types from `information_schema`, without undisclosed constraints, indexes or Floot-managed runtime infrastructure. Consult original Floot project migrations when recreating the host environment.

Do not redistribute any confidential environment variables, API tokens or passwords in the repository.

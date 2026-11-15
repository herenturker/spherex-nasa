#!/usr/bin/env python3
"""Restore the SPHEREx JSONL + per-target gzip backups into EMPTY Postgres tables."""
import argparse
import gzip
import json
from pathlib import Path

TABLES = ("spherex_targets", "spherex_catalog_cache", "spherex_processed_frames", "spherex_reports")


def iter_data_files(base: Path, table: str):
    """Each table has either a plain JSONL or a set of compressed JSONL partitions."""
    plain = base / f"{table}.jsonl"
    if plain.exists():
        yield plain
        return
    directory = base / table
    if not directory.is_dir():
        raise FileNotFoundError(f"Required database table backup missing: {table}")
    paths = sorted(directory.glob("*.jsonl.gz"))
    if not paths:
        raise FileNotFoundError(f"No .jsonl.gz partitions for database table: {table}")
    yield from paths


def main():
    parser = argparse.ArgumentParser(description="Restore SPHEREx backup to a fresh PostgreSQL database")
    parser.add_argument("--database-url", required=True, help="Explicit target PostgreSQL connection URL; do not publish")
    parser.add_argument("--directory", default="database", help="Path to the unpacked database folder")
    args = parser.parse_args()

    import psycopg
    from psycopg import sql
    from psycopg.types.json import Jsonb
    base = Path(args.directory)
    with psycopg.connect(args.database_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            # This script must never overwrite live or populated target tables.
            for name in TABLES:
                paths = list(iter_data_files(base, name))
                if not paths:
                    raise RuntimeError(f"No files for {name}")
                cur.execute(sql.SQL('SELECT COUNT(*) FROM {}').format(sql.Identifier(name)))
                count = cur.fetchone()[0]
                if count:
                    raise RuntimeError(f"Refusing import: {name} already has {count} rows. Use an EMPTY database.")
            for name in TABLES:
                restored = 0
                for path in iter_data_files(base, name):
                    opener = gzip.open if path.name.endswith('.gz') else open
                    with opener(path, 'rt', encoding='utf-8') as fp:
                        for line in fp:
                            if not line.strip():
                                continue
                            row = json.loads(line)
                            if not isinstance(row, dict) or not row:
                                raise ValueError(f"Invalid row in {path}")
                            columns = list(row)
                            command = sql.SQL('INSERT INTO {} ({}) VALUES ({})').format(
                                sql.Identifier(name),
                                sql.SQL(', ').join(map(sql.Identifier, columns)),
                                sql.SQL(', ').join([sql.Placeholder() for _ in columns]),
                            )
                            values = [Jsonb(row[c]) if isinstance(row[c], (dict, list)) else row[c] for c in columns]
                            cur.execute(command, values)
                            restored += 1
                print(f"Restored {name}: {restored} rows")
    print('All tables restored; one transaction committed.')


if __name__ == '__main__':
    main()

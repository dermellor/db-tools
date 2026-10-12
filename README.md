# db-tools

Reusable CLI scripts for exporting Supabase SQL artifacts.

## Install (local path)

```sh
npm install --save-dev 12signals-db-tools@file:../12signals-db-tools
```

## Usage

```sh
db-tools-export-policies --env .env.local --output db/policies.sql
db-tools-export-functions --env .env.local --output db/functions.sql
db-tools-export-schema --env .env.local --output db/schema.sql
```

Defaults:
- `--env` defaults to `.env.local` in the current working directory.
- `--output` defaults to `db/policies.sql`, `db/functions.sql`, or `db/schema.sql`.

## Optional bootstrap

If the export RPCs are missing, pass `--bootstrap` and set `DATABASE_URL`
to a direct Postgres connection string. The tool will create the functions
once, notify PostgREST to reload the schema, and retry the export.

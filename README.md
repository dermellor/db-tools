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

#!/bin/bash
# Creates one database per service (database-per-service pattern, report section 3.3)
# on top of the single Postgres instance used for local development.
set -e

for db in transitlk_users transitlk_ticketing; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE $db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done

#!/bin/sh
# Local stand-in for what the managed-database admin does once in staging/prod.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v db_name="$POSTGRES_DB" \
  -v migrator_password="$OCOP_MIGRATOR_PASSWORD" \
  -v app_password="$OCOP_APP_PASSWORD" \
  -v readonly_password="$OCOP_READONLY_PASSWORD" \
  -f /ocop-sql/bootstrap-roles.sql

-- Extensions and one schema per module (docs/kien-truc-va-cong-nghe.md 3.2).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA identity;
CREATE SCHEMA org;
CREATE SCHEMA platform;

GRANT USAGE ON SCHEMA identity, org, platform, public TO ocop_app, ocop_readonly;

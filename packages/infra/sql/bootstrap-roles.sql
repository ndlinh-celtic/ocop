-- Creates the three database roles of docs/kien-truc-va-cong-nghe.md 6.4.
-- Run once per database by a superuser (or the managed-service admin), before any migration.
-- psql variables: db_name, migrator_password, app_password, readonly_password.

CREATE ROLE ocop_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE ocop_app LOGIN PASSWORD :'app_password';
CREATE ROLE ocop_readonly LOGIN PASSWORD :'readonly_password';

-- The migrator owns every object; the app role gets explicit grants per table in migrations.
ALTER DATABASE :"db_name" OWNER TO ocop_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO ocop_migrator;
GRANT CONNECT ON DATABASE :"db_name" TO ocop_app, ocop_readonly;

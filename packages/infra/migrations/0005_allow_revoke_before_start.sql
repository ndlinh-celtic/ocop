-- A Phân vai revoked at or before its start keeps an empty window [valid_from, valid_from): never active.
ALTER TABLE identity.role_assignment DROP CONSTRAINT valid_range;
ALTER TABLE identity.role_assignment ADD CONSTRAINT valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from);

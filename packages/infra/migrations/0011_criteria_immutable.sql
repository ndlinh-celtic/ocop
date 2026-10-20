-- L19 AD-04 bất biến ba lớp (spec #16, ADR 0006), layer 2: the database refuses any change to a
-- published Phiên bản tiêu chí, whoever sends the SQL.
--   1. the domain refuses (assertDraft);
--   2. these triggers refuse UPDATE/DELETE on every table of the tree, and INSERT of new rows,
--      once the version is published; publishing (draft → published) is the last change allowed;
--   3. ocop_app does not own the tables, so it can neither DISABLE TRIGGER nor set
--      session_replication_role (superuser only).
-- Every tree row carries version_id (0010), so the check reads one row of criteria.version.

CREATE FUNCTION criteria.version_is_published(v uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM criteria.version WHERE id = v AND status = 'published') $$;

CREATE FUNCTION criteria.refuse_published_version_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'criteria version % is published and immutable (% refused)', OLD.id, TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER version_immutable_once_published
  BEFORE UPDATE OR DELETE ON criteria.version
  FOR EACH ROW EXECUTE FUNCTION criteria.refuse_published_version_change();

-- For the tree tables: the row's version before and after the change must both be a draft.
-- A cascade from deleting a draft version finds no version row any more, which is not published.
CREATE FUNCTION criteria.refuse_published_tree_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP IN ('UPDATE', 'DELETE') AND criteria.version_is_published(OLD.version_id))
     OR (TG_OP IN ('INSERT', 'UPDATE') AND criteria.version_is_published(NEW.version_id)) THEN
    RAISE EXCEPTION 'criteria version % is published and immutable (% on % refused)',
      CASE WHEN TG_OP = 'INSERT' THEN NEW.version_id ELSE OLD.version_id END, TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rank_threshold', 'product_group', 'product_subgroup', 'criteria_set', 'exclusion_condition',
                           'part', 'section', 'criterion_group', 'criterion', 'score_level'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON criteria.%I
                    FOR EACH ROW EXECUTE FUNCTION criteria.refuse_published_tree_change()', t || '_immutable_once_published', t);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION criteria.version_is_published(uuid) TO ocop_app;

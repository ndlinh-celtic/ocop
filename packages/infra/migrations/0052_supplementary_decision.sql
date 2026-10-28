-- L17 Quyết định công nhận bổ sung (spec #79 stories 56, 57; ticket #88; ADR 0009).
--
-- A Quyết định công nhận bổ sung (kind 'supplementary', no Phiên họp) công nhận 4 sao the hồ sơ 5 sao the Bộ trả về:
-- every hồ sơ it names sits in mục four_star. The tables and their append-only triggers come from 0047.

CREATE FUNCTION results.check_supplementary_section() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.section <> 'four_star'
     AND EXISTS (SELECT 1 FROM results.recognition_decision WHERE id = NEW.decision_id AND kind = 'supplementary') THEN
    RAISE EXCEPTION 'a Quyết định công nhận bổ sung names its hồ sơ in mục four_star only' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recognition_decision_dossier_supplementary_section BEFORE INSERT ON results.recognition_decision_dossier
  FOR EACH ROW EXECUTE FUNCTION results.check_supplementary_section();

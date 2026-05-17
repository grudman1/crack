-- 0003: widen validation_reviews.resolution_type to allow
-- 'remove_from_dataset' (false-positive case — bad FAMOUS_PEOPLE
-- entry that the admin wants to delete).
--
-- The inline CHECK from migration 0002 was created without an
-- explicit name. We look it up by definition rather than guessing,
-- drop it, and re-add a named one with the wider allowlist.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'validation_reviews'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%resolution_type%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.validation_reviews DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.validation_reviews
  ADD CONSTRAINT validation_reviews_resolution_type_check
  CHECK (
    resolution_type IN ('fix_validator', 'add_to_dataset', 'remove_from_dataset')
    OR resolution_type IS NULL
  );

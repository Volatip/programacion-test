DO $$
DECLARE
    truncate_sql text;
BEGIN
    SELECT 'TRUNCATE TABLE '
        || string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
        || ' RESTART IDENTITY CASCADE;'
    INTO truncate_sql
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'alembic_version';

    IF truncate_sql IS NOT NULL THEN
        EXECUTE truncate_sql;
    END IF;
END $$;

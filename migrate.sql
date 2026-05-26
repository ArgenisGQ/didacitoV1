DO $$
DECLARE
    fac_id integer;
    prog record;
    new_code text;
    counter integer := 1;
BEGIN
    -- Get or create default faculty
    SELECT id INTO fac_id FROM plan_app_faculty WHERE code = 'FAC-BASE';
    IF fac_id IS NULL THEN
        INSERT INTO plan_app_faculty (name, code, is_active, created_at, updated_at) 
        VALUES ('Facultad Base', 'FAC-BASE', true, NOW(), NOW()) RETURNING id INTO fac_id;
    END IF;

    -- Iterate distinct programs and insert as careers
    FOR prog IN SELECT DISTINCT program FROM plan_app_subject WHERE program IS NOT NULL AND program != '' LOOP
        new_code := 'CAR-B' || counter;
        counter := counter + 1;
        
        IF NOT EXISTS (SELECT 1 FROM plan_app_career WHERE name = prog.program) THEN
            INSERT INTO plan_app_career (name, code, faculty_id, is_active, created_at, updated_at)
            VALUES (prog.program, new_code, fac_id, true, NOW(), NOW());
        END IF;
    END LOOP;
END $$;

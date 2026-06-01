CREATE OR REPLACE FUNCTION public.generate_unique_test_case_id(p_project_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    project_prefix TEXT;
    next_number INT;
    final_id TEXT;
    project_name TEXT;
BEGIN
    SELECT name INTO project_name
    FROM projects 
    WHERE id = p_project_id;
    
    IF project_name IS NULL THEN
        project_name := 'UN';
    END IF;
    
    IF LENGTH(project_name) >= 2 THEN
        project_prefix := UPPER(SUBSTRING(project_name FROM 1 FOR 2));
    ELSIF LENGTH(project_name) = 1 THEN
        project_prefix := UPPER(project_name) || 'X';
    ELSE
        project_prefix := 'UN';
    END IF;
    
    project_prefix := REGEXP_REPLACE(project_prefix, '[^A-Z]', '', 'g');
    IF LENGTH(project_prefix) < 2 THEN
        project_prefix := project_prefix || REPEAT('X', 2 - LENGTH(project_prefix));
    END IF;
    
    PERFORM pg_advisory_xact_lock(hashtext('tc_readable_id_' || p_project_id::text));
    
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN readable_id ~ ('^TC-' || project_prefix || '[0-9]{4,}$')
                THEN CAST(SUBSTRING(readable_id FROM LENGTH('TC-' || project_prefix) + 1) AS INTEGER)
                ELSE 0 
            END
        ), 0
    ) + 1 INTO next_number
    FROM test_cases 
    WHERE project_id = p_project_id 
    AND readable_id IS NOT NULL;
    
    final_id := 'TC-' || project_prefix || LPAD(next_number::text, 4, '0');
    
    WHILE EXISTS (SELECT 1 FROM test_cases WHERE readable_id = final_id) LOOP
        next_number := next_number + 1;
        final_id := 'TC-' || project_prefix || LPAD(next_number::text, 4, '0');
    END LOOP;
    
    RETURN final_id;
END;
$function$;
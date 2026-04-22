-- Ensure self-hosted agent registrations persist and expose their type.
-- Older action-based registrations did not write agent_type, which can make
-- ETL/ELT agents disappear from type-aware screens and workflows.

ALTER TABLE public.self_hosted_agents
  ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'selenium';

UPDATE public.self_hosted_agents
SET agent_type = COALESCE(
  NULLIF(agent_type, ''),
  NULLIF(config->'metadata'->>'agent_type', ''),
  CASE
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%etl%' THEN 'etl'
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%elt%' THEN 'etl'
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%performance%' THEN 'performance'
    WHEN lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%playwright%' THEN 'playwright'
    ELSE 'selenium'
  END
)
WHERE agent_type IS NULL OR agent_type = '';

UPDATE public.self_hosted_agents
SET agent_type = 'etl'
WHERE agent_type = 'selenium'
  AND (
    lower(COALESCE(config->'metadata'->>'agent_type', '')) IN ('etl', 'elt')
    OR lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%etl%'
    OR lower(COALESCE(agent_id, '') || ' ' || COALESCE(agent_name, '')) LIKE '%elt%'
  );

ALTER TABLE public.self_hosted_agents
  ALTER COLUMN agent_type SET DEFAULT 'selenium';

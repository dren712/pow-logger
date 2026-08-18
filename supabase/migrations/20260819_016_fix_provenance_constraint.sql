-- 20260819_016_fix_provenance_constraint.sql

-- Drop the old overly restrictive constraint
ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS valid_provenance_level;

-- Add the corrected constraint matching the TypeScript model and GitHub verifier output
ALTER TABLE public.logs ADD CONSTRAINT valid_provenance_level CHECK (
  provenance_level IN (
    'self_attested',
    'source_linked',
    'source_exists',
    'identity_linked',
    'source_verified',
    'partner_attested'
  )
);

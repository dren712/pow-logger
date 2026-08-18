-- Migration: 012 Evidence Correction
-- Objective: Add verified_source_exists to distinguish from fully verified identity attribution

ALTER TABLE logs DROP CONSTRAINT IF EXISTS valid_source_verification_status;
ALTER TABLE logs ADD CONSTRAINT valid_source_verification_status 
CHECK (source_verification_status IN ('not_verified', 'verified_source_exists', 'verified', 'failed', 'unavailable'));

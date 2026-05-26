-- entite_crm_id passe de INT à VARCHAR(36) pour stocker des UUIDs
ALTER TABLE mapping_sources ALTER COLUMN entite_crm_id TYPE VARCHAR(36);

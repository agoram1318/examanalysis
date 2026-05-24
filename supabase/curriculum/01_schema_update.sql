-- Curriculum schema update
-- Run this before reset and subject seed files.

BEGIN;

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS curriculum_type TEXT;
UPDATE subjects SET curriculum_type = 'old' WHERE curriculum_type IS NULL;
ALTER TABLE subjects ALTER COLUMN curriculum_type SET DEFAULT 'old';
ALTER TABLE subjects ALTER COLUMN curriculum_type SET NOT NULL;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_curriculum_type_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_curriculum_type_check CHECK (curriculum_type IN ('old', 'new'));

-- The original schema has UNIQUE(name). Old/new curricula can share subject names.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_curriculum_type_name ON subjects(curriculum_type, name);

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE units_major ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE units_middle ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE units_small ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subjects_curriculum_type ON subjects(curriculum_type);
CREATE INDEX IF NOT EXISTS idx_units_major_subject_order ON units_major(subject_id, order_index);
CREATE INDEX IF NOT EXISTS idx_units_middle_major_order ON units_middle(major_unit_id, order_index);
CREATE INDEX IF NOT EXISTS idx_units_small_middle_order ON units_small(middle_unit_id, order_index);

COMMIT;

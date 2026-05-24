-- Reset curriculum data
-- Run this after 01_schema_update.sql and before subject seed files.

BEGIN;

DELETE FROM units_small;
DELETE FROM units_middle;
DELETE FROM units_major;
DELETE FROM subjects;

ALTER SEQUENCE IF EXISTS units_small_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS units_middle_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS units_major_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS subjects_id_seq RESTART WITH 1;

COMMIT;

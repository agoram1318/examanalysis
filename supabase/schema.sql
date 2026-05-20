-- ============================================================
-- 봉샘스쿨 테스트 분석표 생성기 — Supabase Schema
-- Supabase SQL Editor에 그대로 붙여넣기 가능
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. subjects (과목)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 2. units_major (대단원)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units_major (
  id         BIGSERIAL PRIMARY KEY,
  subject_id BIGINT      NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_major_subject_id ON units_major(subject_id);

-- ──────────────────────────────────────────────
-- 3. units_middle (중단원)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units_middle (
  id            BIGSERIAL PRIMARY KEY,
  major_unit_id BIGINT      NOT NULL REFERENCES units_major(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_middle_major_unit_id ON units_middle(major_unit_id);

-- ──────────────────────────────────────────────
-- 4. units_small (소단원)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units_small (
  id             BIGSERIAL PRIMARY KEY,
  middle_unit_id BIGINT      NOT NULL REFERENCES units_middle(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_small_middle_unit_id ON units_small(middle_unit_id);

-- ──────────────────────────────────────────────
-- 5. tests (시험)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
  id               BIGSERIAL PRIMARY KEY,
  title            TEXT        NOT NULL,
  school_name      TEXT,        -- 현재 미사용 (nullable, 기존 데이터 호환)
  grade            TEXT,
  subject_id       BIGINT      REFERENCES subjects(id) ON DELETE SET NULL,
  exam_range_text  TEXT,
  total_questions  INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tests_subject_id ON tests(subject_id);

-- ──────────────────────────────────────────────
-- 6. questions (문항)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id              BIGSERIAL PRIMARY KEY,
  test_id         BIGINT      NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_number INT         NOT NULL,
  answer          TEXT,
  score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  subject_id      BIGINT      REFERENCES subjects(id)     ON DELETE SET NULL,
  major_unit_id   BIGINT      REFERENCES units_major(id)  ON DELETE SET NULL,
  middle_unit_id  BIGINT      REFERENCES units_middle(id) ON DELETE SET NULL,
  small_unit_id   BIGINT      REFERENCES units_small(id)  ON DELETE SET NULL,
  question_type    TEXT,        -- 현재 초기버전에서는 미사용
  -- 1~8 숫자 등급: 1~2 기본확인 / 3~4 기본적용 / 5~6 중상변별 / 7~8 고난도
  difficulty       SMALLINT CHECK (difficulty BETWEEN 1 AND 8),
  evaluation_point TEXT,        -- 현재 초기버전에서는 미사용
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (test_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_questions_test_id       ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id    ON questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_major_unit_id ON questions(major_unit_id);
CREATE INDEX IF NOT EXISTS idx_questions_middle_unit_id ON questions(middle_unit_id);
CREATE INDEX IF NOT EXISTS idx_questions_small_unit_id  ON questions(small_unit_id);

-- ──────────────────────────────────────────────
-- 7. classes (반)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id           BIGSERIAL PRIMARY KEY,
  test_id      BIGINT      NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  teacher_name TEXT,
  academy_name TEXT,
  class_name   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_test_id ON classes(test_id);

-- ──────────────────────────────────────────────
-- 8. students (학생)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id           BIGSERIAL PRIMARY KEY,
  class_id     BIGINT      NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_name TEXT        NOT NULL,
  student_code TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- ──────────────────────────────────────────────
-- 9. student_answers (학생 답안)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_answers (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT      NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  question_id     BIGINT      NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer TEXT,
  -- OMR 찍음 체크 여부 (관리자 수동 체크)
  is_guessed      BOOLEAN     NOT NULL DEFAULT false,
  is_blank        BOOLEAN     NOT NULL DEFAULT false,
  is_correct      BOOLEAN     NOT NULL DEFAULT false,
  earned_score    NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_student_answers_student_id  ON student_answers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id ON student_answers(question_id);

-- ──────────────────────────────────────────────
-- 10. analysis_results (분석 결과)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_results (
  id                   BIGSERIAL PRIMARY KEY,
  student_id           BIGINT      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  total_score          NUMERIC(7,2) NOT NULL DEFAULT 0,
  correct_count        INT         NOT NULL DEFAULT 0,
  wrong_count          INT         NOT NULL DEFAULT 0,
  blank_count          INT         NOT NULL DEFAULT 0,
  guessed_count        INT         NOT NULL DEFAULT 0,
  guessed_correct_count INT        NOT NULL DEFAULT 0,
  guessed_wrong_count  INT         NOT NULL DEFAULT 0,
  weakest_unit_text    TEXT,
  weakest_type_text    TEXT,
  summary_comment      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_student_id ON analysis_results(student_id);


-- ============================================================
-- SEED DATA
-- ============================================================

-- ──────────────────────────────────────────────
-- subjects 샘플
-- ──────────────────────────────────────────────
INSERT INTO subjects (name) VALUES
  ('공통수학1'),
  ('공통수학2'),
  ('대수'),
  ('미적분Ⅰ'),
  ('확률과 통계'),
  ('기하')
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────
-- 공통수학1 — 대단원
-- ──────────────────────────────────────────────
INSERT INTO units_major (subject_id, name)
SELECT s.id, m.name
FROM subjects s,
     (VALUES
       ('다항식'),
       ('방정식과 부등식'),
       ('경우의 수'),
       ('행렬')
     ) AS m(name)
WHERE s.name = '공통수학1'
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- 공통수학1 — 중단원
-- ──────────────────────────────────────────────

-- 다항식 중단원
INSERT INTO units_middle (major_unit_id, name)
SELECT um.id, mid.name
FROM units_major um
JOIN subjects s ON s.id = um.subject_id
CROSS JOIN (VALUES
  ('다항식의 연산'),
  ('나머지정리와 인수분해')
) AS mid(name)
WHERE s.name = '공통수학1' AND um.name = '다항식'
ON CONFLICT DO NOTHING;

-- 방정식과 부등식 중단원
INSERT INTO units_middle (major_unit_id, name)
SELECT um.id, mid.name
FROM units_major um
JOIN subjects s ON s.id = um.subject_id
CROSS JOIN (VALUES
  ('복소수와 이차방정식'),
  ('여러 가지 방정식'),
  ('여러 가지 부등식')
) AS mid(name)
WHERE s.name = '공통수학1' AND um.name = '방정식과 부등식'
ON CONFLICT DO NOTHING;

-- 경우의 수 중단원
INSERT INTO units_middle (major_unit_id, name)
SELECT um.id, mid.name
FROM units_major um
JOIN subjects s ON s.id = um.subject_id
CROSS JOIN (VALUES
  ('경우의 수')
) AS mid(name)
WHERE s.name = '공통수학1' AND um.name = '경우의 수'
ON CONFLICT DO NOTHING;

-- 행렬 중단원
INSERT INTO units_middle (major_unit_id, name)
SELECT um.id, mid.name
FROM units_major um
JOIN subjects s ON s.id = um.subject_id
CROSS JOIN (VALUES
  ('행렬과 그 연산')
) AS mid(name)
WHERE s.name = '공통수학1' AND um.name = '행렬'
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- 공통수학1 — 소단원
-- ──────────────────────────────────────────────

-- 다항식의 연산 소단원
INSERT INTO units_small (middle_unit_id, name)
SELECT mid.id, sm.name
FROM units_middle mid
JOIN units_major maj ON maj.id = mid.major_unit_id
JOIN subjects s      ON s.id   = maj.subject_id
CROSS JOIN (VALUES
  ('다항식의 덧셈과 뺄셈'),
  ('다항식의 곱셈'),
  ('항등식')
) AS sm(name)
WHERE s.name = '공통수학1' AND maj.name = '다항식' AND mid.name = '다항식의 연산'
ON CONFLICT DO NOTHING;

-- 나머지정리와 인수분해 소단원
INSERT INTO units_small (middle_unit_id, name)
SELECT mid.id, sm.name
FROM units_middle mid
JOIN units_major maj ON maj.id = mid.major_unit_id
JOIN subjects s      ON s.id   = maj.subject_id
CROSS JOIN (VALUES
  ('나머지정리'),
  ('인수분해')
) AS sm(name)
WHERE s.name = '공통수학1' AND maj.name = '다항식' AND mid.name = '나머지정리와 인수분해'
ON CONFLICT DO NOTHING;

-- 복소수와 이차방정식 소단원
INSERT INTO units_small (middle_unit_id, name)
SELECT mid.id, sm.name
FROM units_middle mid
JOIN units_major maj ON maj.id = mid.major_unit_id
JOIN subjects s      ON s.id   = maj.subject_id
CROSS JOIN (VALUES
  ('복소수'),
  ('이차방정식'),
  ('이차방정식과 이차함수')
) AS sm(name)
WHERE s.name = '공통수학1' AND maj.name = '방정식과 부등식' AND mid.name = '복소수와 이차방정식'
ON CONFLICT DO NOTHING;

-- 여러 가지 방정식 소단원
INSERT INTO units_small (middle_unit_id, name)
SELECT mid.id, sm.name
FROM units_middle mid
JOIN units_major maj ON maj.id = mid.major_unit_id
JOIN subjects s      ON s.id   = maj.subject_id
CROSS JOIN (VALUES
  ('연립방정식'),
  ('절댓값을 포함한 방정식')
) AS sm(name)
WHERE s.name = '공통수학1' AND maj.name = '방정식과 부등식' AND mid.name = '여러 가지 방정식'
ON CONFLICT DO NOTHING;

-- 경우의 수 소단원
INSERT INTO units_small (middle_unit_id, name)
SELECT mid.id, sm.name
FROM units_middle mid
JOIN units_major maj ON maj.id = mid.major_unit_id
JOIN subjects s      ON s.id   = maj.subject_id
CROSS JOIN (VALUES
  ('순열'),
  ('조합')
) AS sm(name)
WHERE s.name = '공통수학1' AND maj.name = '경우의 수' AND mid.name = '경우의 수'
ON CONFLICT DO NOTHING;

-- 행렬과 그 연산 소단원
INSERT INTO units_small (middle_unit_id, name)
SELECT mid.id, sm.name
FROM units_middle mid
JOIN units_major maj ON maj.id = mid.major_unit_id
JOIN subjects s      ON s.id   = maj.subject_id
CROSS JOIN (VALUES
  ('행렬의 덧셈'),
  ('행렬의 곱셈')
) AS sm(name)
WHERE s.name = '공통수학1' AND maj.name = '행렬' AND mid.name = '행렬과 그 연산'
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION: difficulty 컬럼 TEXT → SMALLINT (기존 DB 적용용)
-- Supabase SQL Editor에서 아래 구문을 실행하세요.
-- 새로 생성하는 DB라면 위의 CREATE TABLE이 이미 SMALLINT이므로 불필요합니다.
-- ============================================================
/*
ALTER TABLE questions
  ALTER COLUMN difficulty TYPE SMALLINT
  USING CASE difficulty
    WHEN '하'   THEN 2
    WHEN '중'   THEN 4
    WHEN '상'   THEN 6
    WHEN '최상' THEN 8
    ELSE NULL
  END;

ALTER TABLE questions
  ADD CONSTRAINT questions_difficulty_range
  CHECK (difficulty BETWEEN 1 AND 8);
*/

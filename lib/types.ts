// ========================
// 핵심 도메인 타입 정의
// ========================

export type Subject = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type Chapter = {
  id: string;
  subject_id: string;
  level: 'major' | 'middle' | 'minor'; // 대단원 | 중단원 | 소단원
  name: string;
  parent_id: string | null;
  order_index: number;
  created_at: string;
  subject?: Subject;
  parent?: Chapter;
  children?: Chapter[];
};

export type Class = {
  id: string;
  name: string;
  grade: string;
  year: number;
  created_at: string;
  students?: Student[];
};

export type Student = {
  id: string;
  name: string;
  class_id: string;
  student_number: string;
  created_at: string;
  class?: Class;
};

export type Test = {
  id: string;
  title: string;
  subject_id: string;
  class_id: string;
  test_date: string;
  total_score: number;
  description: string | null;
  created_at: string;
  subject?: Subject;
  class?: Class;
  questions?: Question[];
};

export type Question = {
  id: string;
  test_id: string;
  number: number;
  chapter_id: string | null;
  correct_answer: string;
  score: number;
  question_type: 'multiple' | 'short' | 'essay'; // 객관식 | 단답형 | 서술형
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  chapter?: Chapter;
};

export type StudentAnswer = {
  id: string;
  test_id: string;
  student_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean | null;
  score_earned: number;
  created_at: string;
  student?: Student;
  question?: Question;
};

export type TestResult = {
  id: string;
  test_id: string;
  student_id: string;
  total_score: number;
  percentage: number;
  rank: number | null;
  created_at: string;
  student?: Student;
  test?: Test;
};

// ========================
// 분석용 집계 타입
// ========================

export type StudentAnalysis = {
  student: Student;
  test: Test;
  total_score: number;
  percentage: number;
  rank: number;
  total_students: number;
  answers: (StudentAnswer & { question: Question & { chapter?: Chapter } })[];
  chapter_scores: ChapterScore[];
  weak_chapters: Chapter[];
  strong_chapters: Chapter[];
};

export type ChapterScore = {
  chapter: Chapter;
  total_questions: number;
  correct_questions: number;
  accuracy: number;
  score_earned: number;
  max_score: number;
};

export type ClassAnalysis = {
  test: Test;
  class: Class;
  total_students: number;
  average_score: number;
  average_percentage: number;
  max_score: number;
  min_score: number;
  score_distribution: ScoreDistribution[];
  question_stats: QuestionStat[];
  chapter_stats: ChapterStat[];
  student_results: StudentResult[];
};

export type ScoreDistribution = {
  range: string;
  count: number;
  percentage: number;
};

export type QuestionStat = {
  question: Question;
  correct_count: number;
  total_count: number;
  accuracy: number;
};

export type ChapterStat = {
  chapter: Chapter;
  average_accuracy: number;
  total_questions: number;
};

export type StudentResult = {
  student: Student;
  total_score: number;
  percentage: number;
  rank: number;
};

// ========================
// 로컬 스토리지 기반 데이터 타입 (Supabase 연동 전)
// ========================

export type LocalDB = {
  subjects: Subject[];
  chapters: Chapter[];
  classes: Class[];
  students: Student[];
  tests: Test[];
  questions: Question[];
  studentAnswers: StudentAnswer[];
};

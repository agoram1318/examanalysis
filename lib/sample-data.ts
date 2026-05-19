import { Subject, Chapter, Class, Student, Test, Question } from './types';

// ========================
// 샘플 데이터 (초기 버전용)
// 관리자가 추후 DB에서 직접 추가/수정 가능
// ========================

export const SAMPLE_SUBJECTS: Subject[] = [
  { id: 'subj-1', name: '수학', code: 'MATH', created_at: new Date().toISOString() },
  { id: 'subj-2', name: '수학(상)', code: 'MATH-A', created_at: new Date().toISOString() },
  { id: 'subj-3', name: '수학(하)', code: 'MATH-B', created_at: new Date().toISOString() },
];

export const SAMPLE_CHAPTERS: Chapter[] = [
  // 대단원
  { id: 'ch-1', subject_id: 'subj-1', level: 'major', name: '다항식', parent_id: null, order_index: 1, created_at: new Date().toISOString() },
  { id: 'ch-2', subject_id: 'subj-1', level: 'major', name: '방정식과 부등식', parent_id: null, order_index: 2, created_at: new Date().toISOString() },
  { id: 'ch-3', subject_id: 'subj-1', level: 'major', name: '도형의 방정식', parent_id: null, order_index: 3, created_at: new Date().toISOString() },
  { id: 'ch-4', subject_id: 'subj-1', level: 'major', name: '집합과 명제', parent_id: null, order_index: 4, created_at: new Date().toISOString() },
  { id: 'ch-5', subject_id: 'subj-1', level: 'major', name: '함수', parent_id: null, order_index: 5, created_at: new Date().toISOString() },
  // 중단원 - 다항식
  { id: 'ch-1-1', subject_id: 'subj-1', level: 'middle', name: '다항식의 연산', parent_id: 'ch-1', order_index: 1, created_at: new Date().toISOString() },
  { id: 'ch-1-2', subject_id: 'subj-1', level: 'middle', name: '나머지정리와 인수분해', parent_id: 'ch-1', order_index: 2, created_at: new Date().toISOString() },
  // 중단원 - 방정식과 부등식
  { id: 'ch-2-1', subject_id: 'subj-1', level: 'middle', name: '복소수와 이차방정식', parent_id: 'ch-2', order_index: 1, created_at: new Date().toISOString() },
  { id: 'ch-2-2', subject_id: 'subj-1', level: 'middle', name: '이차방정식과 이차함수', parent_id: 'ch-2', order_index: 2, created_at: new Date().toISOString() },
  { id: 'ch-2-3', subject_id: 'subj-1', level: 'middle', name: '여러 가지 방정식', parent_id: 'ch-2', order_index: 3, created_at: new Date().toISOString() },
  { id: 'ch-2-4', subject_id: 'subj-1', level: 'middle', name: '부등식', parent_id: 'ch-2', order_index: 4, created_at: new Date().toISOString() },
  // 중단원 - 도형의 방정식
  { id: 'ch-3-1', subject_id: 'subj-1', level: 'middle', name: '평면좌표', parent_id: 'ch-3', order_index: 1, created_at: new Date().toISOString() },
  { id: 'ch-3-2', subject_id: 'subj-1', level: 'middle', name: '직선의 방정식', parent_id: 'ch-3', order_index: 2, created_at: new Date().toISOString() },
  { id: 'ch-3-3', subject_id: 'subj-1', level: 'middle', name: '원의 방정식', parent_id: 'ch-3', order_index: 3, created_at: new Date().toISOString() },
  { id: 'ch-3-4', subject_id: 'subj-1', level: 'middle', name: '도형의 이동', parent_id: 'ch-3', order_index: 4, created_at: new Date().toISOString() },
  // 소단원 - 다항식의 연산
  { id: 'ch-1-1-1', subject_id: 'subj-1', level: 'minor', name: '다항식의 덧셈과 뺄셈', parent_id: 'ch-1-1', order_index: 1, created_at: new Date().toISOString() },
  { id: 'ch-1-1-2', subject_id: 'subj-1', level: 'minor', name: '다항식의 곱셈', parent_id: 'ch-1-1', order_index: 2, created_at: new Date().toISOString() },
  { id: 'ch-1-1-3', subject_id: 'subj-1', level: 'minor', name: '다항식의 나눗셈', parent_id: 'ch-1-1', order_index: 3, created_at: new Date().toISOString() },
  // 소단원 - 나머지정리와 인수분해
  { id: 'ch-1-2-1', subject_id: 'subj-1', level: 'minor', name: '나머지정리', parent_id: 'ch-1-2', order_index: 1, created_at: new Date().toISOString() },
  { id: 'ch-1-2-2', subject_id: 'subj-1', level: 'minor', name: '인수분해', parent_id: 'ch-1-2', order_index: 2, created_at: new Date().toISOString() },
];

export const SAMPLE_CLASSES: Class[] = [
  { id: 'cls-1', name: '중등 A반', grade: '중3', year: 2026, created_at: new Date().toISOString() },
  { id: 'cls-2', name: '고등 수학(상) B반', grade: '고1', year: 2026, created_at: new Date().toISOString() },
  { id: 'cls-3', name: '고등 수학(하) C반', grade: '고1', year: 2026, created_at: new Date().toISOString() },
];

export const SAMPLE_STUDENTS: Student[] = [
  { id: 'stu-1', name: '김민준', class_id: 'cls-1', student_number: '001', created_at: new Date().toISOString() },
  { id: 'stu-2', name: '이서연', class_id: 'cls-1', student_number: '002', created_at: new Date().toISOString() },
  { id: 'stu-3', name: '박도윤', class_id: 'cls-1', student_number: '003', created_at: new Date().toISOString() },
  { id: 'stu-4', name: '최지아', class_id: 'cls-1', student_number: '004', created_at: new Date().toISOString() },
  { id: 'stu-5', name: '정하은', class_id: 'cls-1', student_number: '005', created_at: new Date().toISOString() },
  { id: 'stu-6', name: '강시우', class_id: 'cls-2', student_number: '001', created_at: new Date().toISOString() },
  { id: 'stu-7', name: '윤아린', class_id: 'cls-2', student_number: '002', created_at: new Date().toISOString() },
  { id: 'stu-8', name: '임준서', class_id: 'cls-2', student_number: '003', created_at: new Date().toISOString() },
];

export const SAMPLE_TESTS: Test[] = [
  {
    id: 'test-1',
    title: '다항식 단원 테스트',
    subject_id: 'subj-1',
    class_id: 'cls-1',
    test_date: '2026-05-10',
    total_score: 100,
    description: '다항식 전체 단원 형성평가',
    created_at: new Date().toISOString(),
  },
  {
    id: 'test-2',
    title: '방정식과 부등식 중간고사 대비',
    subject_id: 'subj-1',
    class_id: 'cls-2',
    test_date: '2026-05-15',
    total_score: 100,
    description: '방정식과 부등식 단원 중간고사 대비 테스트',
    created_at: new Date().toISOString(),
  },
];

export const SAMPLE_QUESTIONS: Question[] = [
  // test-1 문항
  { id: 'q-1', test_id: 'test-1', number: 1, chapter_id: 'ch-1-1', correct_answer: '3', score: 4, question_type: 'multiple', difficulty: 'easy', created_at: new Date().toISOString() },
  { id: 'q-2', test_id: 'test-1', number: 2, chapter_id: 'ch-1-1', correct_answer: '5', score: 4, question_type: 'multiple', difficulty: 'easy', created_at: new Date().toISOString() },
  { id: 'q-3', test_id: 'test-1', number: 3, chapter_id: 'ch-1-1', correct_answer: '2', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-4', test_id: 'test-1', number: 4, chapter_id: 'ch-1-2', correct_answer: '4', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-5', test_id: 'test-1', number: 5, chapter_id: 'ch-1-2', correct_answer: '1', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-6', test_id: 'test-1', number: 6, chapter_id: 'ch-1-1', correct_answer: '3', score: 4, question_type: 'multiple', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-7', test_id: 'test-1', number: 7, chapter_id: 'ch-1-2', correct_answer: '2', score: 4, question_type: 'multiple', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-8', test_id: 'test-1', number: 8, chapter_id: 'ch-1-1', correct_answer: '5', score: 4, question_type: 'multiple', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-9', test_id: 'test-1', number: 9, chapter_id: 'ch-1-2', correct_answer: '15', score: 5, question_type: 'short', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-10', test_id: 'test-1', number: 10, chapter_id: 'ch-1-2', correct_answer: '24', score: 5, question_type: 'short', difficulty: 'hard', created_at: new Date().toISOString() },
  // ... 나머지 문항 (11~25번)
  { id: 'q-11', test_id: 'test-1', number: 11, chapter_id: 'ch-1-1', correct_answer: '2', score: 4, question_type: 'multiple', difficulty: 'easy', created_at: new Date().toISOString() },
  { id: 'q-12', test_id: 'test-1', number: 12, chapter_id: 'ch-1-2', correct_answer: '4', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-13', test_id: 'test-1', number: 13, chapter_id: 'ch-1-1', correct_answer: '1', score: 4, question_type: 'multiple', difficulty: 'easy', created_at: new Date().toISOString() },
  { id: 'q-14', test_id: 'test-1', number: 14, chapter_id: 'ch-1-2', correct_answer: '3', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-15', test_id: 'test-1', number: 15, chapter_id: 'ch-1-1', correct_answer: '5', score: 4, question_type: 'multiple', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-16', test_id: 'test-1', number: 16, chapter_id: 'ch-1-2', correct_answer: '7', score: 5, question_type: 'short', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-17', test_id: 'test-1', number: 17, chapter_id: 'ch-1-1', correct_answer: '12', score: 5, question_type: 'short', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-18', test_id: 'test-1', number: 18, chapter_id: 'ch-1-2', correct_answer: '6', score: 4, question_type: 'multiple', difficulty: 'easy', created_at: new Date().toISOString() },
  { id: 'q-19', test_id: 'test-1', number: 19, chapter_id: 'ch-1-1', correct_answer: '3', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-20', test_id: 'test-1', number: 20, chapter_id: 'ch-1-2', correct_answer: '4', score: 4, question_type: 'multiple', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-21', test_id: 'test-1', number: 21, chapter_id: 'ch-1-1', correct_answer: '18', score: 5, question_type: 'short', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-22', test_id: 'test-1', number: 22, chapter_id: 'ch-1-2', correct_answer: '36', score: 5, question_type: 'short', difficulty: 'hard', created_at: new Date().toISOString() },
  { id: 'q-23', test_id: 'test-1', number: 23, chapter_id: 'ch-1-1', correct_answer: '2', score: 4, question_type: 'multiple', difficulty: 'easy', created_at: new Date().toISOString() },
  { id: 'q-24', test_id: 'test-1', number: 24, chapter_id: 'ch-1-2', correct_answer: '1', score: 4, question_type: 'multiple', difficulty: 'medium', created_at: new Date().toISOString() },
  { id: 'q-25', test_id: 'test-1', number: 25, chapter_id: 'ch-1-1', correct_answer: '81', score: 9, question_type: 'short', difficulty: 'hard', created_at: new Date().toISOString() },
];

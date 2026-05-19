'use client';

/**
 * 로컬스토리지 기반 데이터 스토어
 * Supabase 연동 전까지 브라우저 로컬스토리지에 데이터를 저장
 * 추후 각 함수를 Supabase API 호출로 교체하면 됨
 */

import {
  Subject, Chapter, Class, Student, Test, Question, StudentAnswer, LocalDB
} from './types';
import {
  SAMPLE_SUBJECTS, SAMPLE_CHAPTERS, SAMPLE_CLASSES, SAMPLE_STUDENTS,
  SAMPLE_TESTS, SAMPLE_QUESTIONS
} from './sample-data';

const STORAGE_KEY = 'bongsam_exam_db';

function getDB(): LocalDB {
  if (typeof window === 'undefined') {
    return getDefaultDB();
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const defaultDB = getDefaultDB();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDB));
    return defaultDB;
  }
  return JSON.parse(raw);
}

function saveDB(db: LocalDB): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getDefaultDB(): LocalDB {
  return {
    subjects: SAMPLE_SUBJECTS,
    chapters: SAMPLE_CHAPTERS,
    classes: SAMPLE_CLASSES,
    students: SAMPLE_STUDENTS,
    tests: SAMPLE_TESTS,
    questions: SAMPLE_QUESTIONS,
    studentAnswers: [],
  };
}

export function resetDB(): void {
  saveDB(getDefaultDB());
}

// ========================
// Subject
// ========================
export function getSubjects(): Subject[] {
  return getDB().subjects;
}
export function saveSubject(s: Subject): void {
  const db = getDB();
  const idx = db.subjects.findIndex(x => x.id === s.id);
  if (idx >= 0) db.subjects[idx] = s;
  else db.subjects.push(s);
  saveDB(db);
}
export function deleteSubject(id: string): void {
  const db = getDB();
  db.subjects = db.subjects.filter(x => x.id !== id);
  saveDB(db);
}

// ========================
// Chapter
// ========================
export function getChapters(): Chapter[] {
  return getDB().chapters;
}
export function saveChapter(c: Chapter): void {
  const db = getDB();
  const idx = db.chapters.findIndex(x => x.id === c.id);
  if (idx >= 0) db.chapters[idx] = c;
  else db.chapters.push(c);
  saveDB(db);
}
export function deleteChapter(id: string): void {
  const db = getDB();
  db.chapters = db.chapters.filter(x => x.id !== id);
  saveDB(db);
}

// ========================
// Class
// ========================
export function getClasses(): Class[] {
  return getDB().classes;
}
export function saveClass(c: Class): void {
  const db = getDB();
  const idx = db.classes.findIndex(x => x.id === c.id);
  if (idx >= 0) db.classes[idx] = c;
  else db.classes.push(c);
  saveDB(db);
}
export function deleteClass(id: string): void {
  const db = getDB();
  db.classes = db.classes.filter(x => x.id !== id);
  saveDB(db);
}

// ========================
// Student
// ========================
export function getStudents(): Student[] {
  return getDB().students;
}
export function getStudentsByClass(classId: string): Student[] {
  return getDB().students.filter(s => s.class_id === classId);
}
export function saveStudent(s: Student): void {
  const db = getDB();
  const idx = db.students.findIndex(x => x.id === s.id);
  if (idx >= 0) db.students[idx] = s;
  else db.students.push(s);
  saveDB(db);
}
export function deleteStudent(id: string): void {
  const db = getDB();
  db.students = db.students.filter(x => x.id !== id);
  saveDB(db);
}

// ========================
// Test
// ========================
export function getTests(): Test[] {
  return getDB().tests;
}
export function getTestById(id: string): Test | undefined {
  return getDB().tests.find(t => t.id === id);
}
export function saveTest(t: Test): void {
  const db = getDB();
  const idx = db.tests.findIndex(x => x.id === t.id);
  if (idx >= 0) db.tests[idx] = t;
  else db.tests.push(t);
  saveDB(db);
}
export function deleteTest(id: string): void {
  const db = getDB();
  db.tests = db.tests.filter(x => x.id !== id);
  db.questions = db.questions.filter(x => x.test_id !== id);
  db.studentAnswers = db.studentAnswers.filter(x => x.test_id !== id);
  saveDB(db);
}

// ========================
// Question
// ========================
export function getQuestionsByTest(testId: string): Question[] {
  return getDB().questions
    .filter(q => q.test_id === testId)
    .sort((a, b) => a.number - b.number);
}
export function saveQuestion(q: Question): void {
  const db = getDB();
  const idx = db.questions.findIndex(x => x.id === q.id);
  if (idx >= 0) db.questions[idx] = q;
  else db.questions.push(q);
  saveDB(db);
}
export function saveQuestions(questions: Question[]): void {
  const db = getDB();
  questions.forEach(q => {
    const idx = db.questions.findIndex(x => x.id === q.id);
    if (idx >= 0) db.questions[idx] = q;
    else db.questions.push(q);
  });
  saveDB(db);
}
export function deleteQuestion(id: string): void {
  const db = getDB();
  db.questions = db.questions.filter(x => x.id !== id);
  db.studentAnswers = db.studentAnswers.filter(x => x.question_id !== id);
  saveDB(db);
}
export function deleteQuestionsByTest(testId: string): void {
  const db = getDB();
  db.questions = db.questions.filter(x => x.test_id !== testId);
  saveDB(db);
}

// ========================
// StudentAnswer
// ========================
export function getAnswersByTest(testId: string): StudentAnswer[] {
  return getDB().studentAnswers.filter(a => a.test_id === testId);
}
export function getAnswersByStudentAndTest(studentId: string, testId: string): StudentAnswer[] {
  return getDB().studentAnswers.filter(
    a => a.student_id === studentId && a.test_id === testId
  );
}
export function saveAnswers(answers: StudentAnswer[]): void {
  const db = getDB();
  answers.forEach(a => {
    const idx = db.studentAnswers.findIndex(x => x.id === a.id);
    if (idx >= 0) db.studentAnswers[idx] = a;
    else db.studentAnswers.push(a);
  });
  saveDB(db);
}
export function deleteAnswersByStudentAndTest(studentId: string, testId: string): void {
  const db = getDB();
  db.studentAnswers = db.studentAnswers.filter(
    a => !(a.student_id === studentId && a.test_id === testId)
  );
  saveDB(db);
}

// ========================
// 유틸리티
// ========================
export function generateId(): string {
  return crypto.randomUUID();
}

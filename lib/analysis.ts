/**
 * 채점 및 분석 로직
 */

import {
  Test, Question, Student, StudentAnswer, Class,
  StudentAnalysis, ClassAnalysis, ChapterScore,
  ScoreDistribution, QuestionStat, ChapterStat, StudentResult,
} from './types';
import { getChapters, getStudentsByClass } from './store';

// ========================
// 자동 채점
// ========================

export function gradeAnswer(question: Question, answer: string): boolean {
  const correct = question.correct_answer.trim().toLowerCase();
  const given = answer.trim().toLowerCase();
  return correct === given;
}

export function gradeStudentAnswers(
  questions: Question[],
  rawAnswers: Record<string, string>, // questionId -> answer
  studentId: string,
  testId: string,
): StudentAnswer[] {
  return questions.map(q => {
    const answer = rawAnswers[q.id] ?? '';
    const isCorrect = answer.trim() !== '' && gradeAnswer(q, answer);
    return {
      id: `${studentId}-${q.id}`,
      test_id: testId,
      student_id: studentId,
      question_id: q.id,
      answer,
      is_correct: answer.trim() === '' ? null : isCorrect,
      score_earned: isCorrect ? q.score : 0,
      created_at: new Date().toISOString(),
    };
  });
}

// ========================
// 학생별 분석
// ========================

export function buildStudentAnalysis(
  student: Student,
  test: Test,
  questions: Question[],
  answers: StudentAnswer[],
  allStudentAnswers: StudentAnswer[], // 같은 테스트의 전체 학생 답안
  allStudents: Student[],
): StudentAnalysis {
  const chapters = getChapters();

  const answerMap = new Map(answers.map(a => [a.question_id, a]));
  const totalScore = answers.reduce((sum, a) => sum + a.score_earned, 0);
  const percentage = test.total_score > 0 ? (totalScore / test.total_score) * 100 : 0;

  // 학생 전체 점수 집계 → 순위 계산
  const studentScores = new Map<string, number>();
  allStudentAnswers.forEach(a => {
    const prev = studentScores.get(a.student_id) ?? 0;
    studentScores.set(a.student_id, prev + a.score_earned);
  });
  const sortedScores = [...studentScores.values()].sort((a, b) => b - a);
  const rank = sortedScores.filter(s => s > totalScore).length + 1;

  // 단원별 점수 집계
  const chapterMap = new Map<string, { correct: number; total: number; scoreEarned: number; maxScore: number }>();
  questions.forEach(q => {
    if (!q.chapter_id) return;
    const ans = answerMap.get(q.id);
    const prev = chapterMap.get(q.chapter_id) ?? { correct: 0, total: 0, scoreEarned: 0, maxScore: 0 };
    chapterMap.set(q.chapter_id, {
      correct: prev.correct + (ans?.is_correct ? 1 : 0),
      total: prev.total + 1,
      scoreEarned: prev.scoreEarned + (ans?.score_earned ?? 0),
      maxScore: prev.maxScore + q.score,
    });
  });

  const chapterScores: ChapterScore[] = [...chapterMap.entries()].map(([cid, data]) => {
    const chapter = chapters.find(c => c.id === cid);
    return {
      chapter: chapter!,
      total_questions: data.total,
      correct_questions: data.correct,
      accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      score_earned: data.scoreEarned,
      max_score: data.maxScore,
    };
  }).filter(cs => cs.chapter != null);

  const sorted = [...chapterScores].sort((a, b) => a.accuracy - b.accuracy);
  const weak_chapters = sorted.slice(0, 3).filter(cs => cs.accuracy < 70).map(cs => cs.chapter);
  const strong_chapters = [...sorted].reverse().slice(0, 3).filter(cs => cs.accuracy >= 80).map(cs => cs.chapter);

  const enrichedAnswers = answers.map(a => {
    const q = questions.find(q => q.id === a.question_id)!;
    const chapter = q?.chapter_id ? chapters.find(c => c.id === q.chapter_id) : undefined;
    return { ...a, question: { ...q, chapter } };
  });

  return {
    student,
    test,
    total_score: totalScore,
    percentage,
    rank,
    total_students: allStudents.length,
    answers: enrichedAnswers,
    chapter_scores: chapterScores,
    weak_chapters,
    strong_chapters,
  };
}

// ========================
// 반 전체 분석
// ========================

export function buildClassAnalysis(
  test: Test,
  cls: Class,
  questions: Question[],
  allAnswers: StudentAnswer[],
): ClassAnalysis {
  const chapters = getChapters();
  const students = getStudentsByClass(cls.id);

  // 학생별 총점 계산
  const studentScoreMap = new Map<string, number>();
  allAnswers.forEach(a => {
    const prev = studentScoreMap.get(a.student_id) ?? 0;
    studentScoreMap.set(a.student_id, prev + a.score_earned);
  });

  const scores = [...studentScoreMap.values()];
  const totalStudents = scores.length;
  const avgScore = totalStudents > 0 ? scores.reduce((s, v) => s + v, 0) / totalStudents : 0;
  const avgPct = test.total_score > 0 ? (avgScore / test.total_score) * 100 : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;

  // 점수 분포 (10점 구간)
  const ranges = ['0~9', '10~19', '20~29', '30~39', '40~49', '50~59', '60~69', '70~79', '80~89', '90~100'];
  const counts = new Array(10).fill(0);
  scores.forEach(s => {
    const idx = Math.min(Math.floor(s / 10), 9);
    counts[idx]++;
  });
  const score_distribution: ScoreDistribution[] = ranges.map((range, i) => ({
    range,
    count: counts[i],
    percentage: totalStudents > 0 ? (counts[i] / totalStudents) * 100 : 0,
  }));

  // 문항별 정답률
  const question_stats: QuestionStat[] = questions.map(q => {
    const qAnswers = allAnswers.filter(a => a.question_id === q.id);
    const correct = qAnswers.filter(a => a.is_correct).length;
    return {
      question: q,
      correct_count: correct,
      total_count: qAnswers.length,
      accuracy: qAnswers.length > 0 ? (correct / qAnswers.length) * 100 : 0,
    };
  });

  // 단원별 평균 정답률
  const chapterMap = new Map<string, { correct: number; total: number }>();
  allAnswers.forEach(a => {
    const q = questions.find(q => q.id === a.question_id);
    if (!q?.chapter_id) return;
    const prev = chapterMap.get(q.chapter_id) ?? { correct: 0, total: 0 };
    chapterMap.set(q.chapter_id, {
      correct: prev.correct + (a.is_correct ? 1 : 0),
      total: prev.total + 1,
    });
  });

  const chapter_stats: ChapterStat[] = [...chapterMap.entries()].map(([cid, data]) => {
    const chapter = chapters.find(c => c.id === cid);
    const totalQuestions = questions.filter(q => q.chapter_id === cid).length;
    return {
      chapter: chapter!,
      average_accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      total_questions: totalQuestions,
    };
  }).filter(cs => cs.chapter != null);

  // 학생별 순위
  const sortedEntries = [...studentScoreMap.entries()].sort((a, b) => b[1] - a[1]);
  const student_results: StudentResult[] = sortedEntries.map(([sid, score], idx) => {
    const student = students.find(s => s.id === sid);
    return {
      student: student!,
      total_score: score,
      percentage: test.total_score > 0 ? (score / test.total_score) * 100 : 0,
      rank: idx + 1,
    };
  }).filter(sr => sr.student != null);

  return {
    test,
    class: cls,
    total_students: totalStudents,
    average_score: avgScore,
    average_percentage: avgPct,
    max_score: maxScore,
    min_score: minScore,
    score_distribution,
    question_stats,
    chapter_stats,
    student_results,
  };
}

// ========================
// 등급 계산 (9등급)
// ========================
export function getGrade(percentage: number): number {
  if (percentage >= 96) return 1;
  if (percentage >= 89) return 2;
  if (percentage >= 77) return 3;
  if (percentage >= 60) return 4;
  if (percentage >= 40) return 5;
  if (percentage >= 23) return 6;
  if (percentage >= 11) return 7;
  if (percentage >= 4) return 8;
  return 9;
}

export function getGradeLabel(percentage: number): string {
  const grade = getGrade(percentage);
  return `${grade}등급`;
}

export function getScoreColor(percentage: number): string {
  if (percentage >= 80) return 'text-blue-600';
  if (percentage >= 60) return 'text-green-600';
  if (percentage >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function getAccuracyBadge(accuracy: number): { label: string; color: string } {
  if (accuracy >= 80) return { label: '우수', color: 'bg-blue-100 text-blue-700' };
  if (accuracy >= 60) return { label: '보통', color: 'bg-green-100 text-green-700' };
  if (accuracy >= 40) return { label: '미흡', color: 'bg-yellow-100 text-yellow-700' };
  return { label: '취약', color: 'bg-red-100 text-red-700' };
}

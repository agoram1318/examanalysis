'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Users, AlertCircle, Loader2, ChevronRight,
  BarChart3, FileBarChart, TrendingDown, Crosshair, Printer,
  GraduationCap, ClipboardList, Edit2, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchClassIdsForTest } from '@/lib/class-tests';
import Button from '@/components/ui/Button';
import PrintReportLink from '@/components/reports/PrintReportLink';
import { formatScoreValue, formatSubjectList, getQuestionSubjectName, scoreOrFallback } from '@/lib/report-utils';
import {
  buildScoreDistribution,
  computeEstimatedGrade,
  computeMedian,
  computePercentile,
  evalAchievement,
  difficultyInterpretation,
  generateTestWideComment,
  guessInterpretation,
  wrongInterpretation,
} from '@/lib/test-wide-analysis';

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  subject_name: string | null;
  total_questions: number;
  exam_range_text: string | null;
};

type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
};

type StudentRow = {
  id: number;
  student_name: string;
  student_code: string | null;
  class_id: number;
};

type QuestionRow = {
  id: number;
  question_number: number;
  answer: string | null;
  score: number;
  difficulty: number | null;
  question_comment: string | null;
  subject_name: string | null;
  major_unit_name: string | null;
  middle_unit_name: string | null;
  small_unit_name: string | null;
};

type AnswerRow = {
  student_id: number;
  question_id: number;
  selected_answer: string | null;
  is_guessed: boolean;
  is_blank: boolean;
  is_correct: boolean;
  earned_score: number;
};

type UnitRaw = { name: string } | { name: string }[] | null;

function pickName(raw: unknown): string | null {
  const u = raw as UnitRaw;
  if (!u) return null;
  if (Array.isArray(u)) return u[0]?.name ?? null;
  return u.name ?? null;
}

function featureComment(q: QuestionRow): string | null {
  const comment = q.question_comment?.trim();
  return comment || null;
}

function wrongHintWithFeature(
  correctRate: number,
  difficulty: number | null,
  q: QuestionRow,
): string {
  const comment = featureComment(q);
  if (comment) return `${q.question_number}번은 '${comment}' 문항입니다. 오답률이 높아 해당 풀이 포인트를 전체적으로 보완할 필요가 있습니다.`;
  return wrongInterpretation(correctRate, difficulty);
}

function guessHintWithFeature(
  guessRate: number,
  difficulty: number | null,
  q: QuestionRow,
): string {
  const comment = featureComment(q);
  if (comment) return `${q.question_number}번은 '${comment}' 문항입니다. 찍음 비율이 높아 풀이 시작점과 판단 근거를 점검해야 합니다.`;
  return guessInterpretation(guessRate, difficulty);
}

// ─────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────
function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
      {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
      <h2 className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>{children}</h2>
    </div>
  );
}

function RateBar({ rate, small }: { rate: number; small?: boolean }) {
  const color = rate >= 80 ? '#22c55e' : rate >= 60 ? '#eab308' : rate >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: small ? 5 : 6, background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${Math.min(rate, 100)}%`, background: color, borderRadius: 9999 }} />
      </div>
      <span className="font-semibold shrink-0 text-right" style={{ color: 'var(--fg-main)', fontSize: small ? 11 : 12, minWidth: 38 }}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function EvalBadge({ rate }: { rate: number }) {
  const ev = evalAchievement(rate);
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: ev.bg, color: ev.color }}>
      {ev.text}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl px-5 py-8 text-center" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function TestWideAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testIdStr } = use(params);
  const testId = Number(testIdStr);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [test, setTest] = useState<TestRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  useEffect(() => {
    if (isNaN(testId)) { setNotFound(true); setLoading(false); return; }

    async function load() {
      const { data: testRaw, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, total_questions, exam_range_text')
        .eq('id', testId)
        .single();

      if (testErr || !testRaw) { setNotFound(true); setLoading(false); return; }

      setTest({
        id: testRaw.id,
        title: testRaw.title,
        grade: testRaw.grade,
        subject_name: null,
        total_questions: testRaw.total_questions,
        exam_range_text: testRaw.exam_range_text ?? null,
      });

      const [questionsRes, classIds] = await Promise.all([
        supabase.from('questions').select(`
          id, question_number, answer, score, difficulty, question_comment,
          subjects:subject_id(name),
          units_major:major_unit_id(name),
          units_middle:middle_unit_id(name),
          units_small:small_unit_id(name)
        `).eq('test_id', testId).order('question_number'),
        fetchClassIdsForTest(testId),
      ]);

      const questionCount = questionsRes.data?.length ?? 0;
      const qs: QuestionRow[] = (questionsRes.data ?? []).map((q) => ({
        id: q.id,
        question_number: q.question_number,
        answer: q.answer,
        score: scoreOrFallback(q.score, questionCount),
        difficulty: q.difficulty,
        question_comment: q.question_comment ?? null,
        subject_name: getQuestionSubjectName(q.subjects),
        major_unit_name: pickName(q.units_major),
        middle_unit_name: pickName(q.units_middle),
        small_unit_name: pickName(q.units_small),
      }));
      setQuestions(qs);
      setTest((prev) => prev ? {
        ...prev,
        subject_name: formatSubjectList(qs.map((q) => q.subject_name)),
      } : prev);

      if (classIds.length === 0) { setLoading(false); return; }

      const { data: classesRaw } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .in('id', classIds);

      setClasses(classesRaw ?? []);

      const { data: studentsRaw } = await supabase
        .from('students')
        .select('id, student_name, student_code, class_id')
        .in('class_id', classIds)
        .order('student_code');

      const studentsData = studentsRaw ?? [];
      setStudents(studentsData);

      if (!studentsData.length || !qs.length) { setLoading(false); return; }

      const studentIds = studentsData.map((s) => s.id);
      const questionIds = qs.map((q) => q.id);

      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('student_id, question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .in('student_id', studentIds)
        .in('question_id', questionIds);

      setAllAnswers(
        (answersRaw ?? []).map((a) => ({ ...a, earned_score: Number(a.earned_score) }))
      );
      setLoading(false);
    }

    load();
  }, [testId]);

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const totalPossible = questions.reduce((sum, q) => sum + q.score, 0);

  const studentStats = students.map((s) => {
    const answers = allAnswers.filter((a) => a.student_id === s.id);
    const totalScore = answers.reduce((sum, a) => sum + a.earned_score, 0);
    const correctCount = answers.filter((a) => a.is_correct).length;
    const blankCount = answers.filter((a) => a.is_blank).length;
    const wrongCount = answers.length - correctCount - blankCount;
    const guessedCount = answers.filter((a) => a.is_guessed).length;
    const answeredCount = answers.filter((a) => !a.is_blank).length;
    const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const cls = classMap.get(s.class_id);
    const isComplete = answeredCount > 0 || totalScore > 0;
    return {
      student: s,
      cls,
      totalScore,
      correctCount,
      wrongCount,
      blankCount,
      guessedCount,
      answeredCount,
      scoreRate,
      isComplete,
    };
  });

  const completedStats = studentStats.filter((s) => s.isComplete);
  const scores = completedStats.map((s) => s.totalScore);
  const allScoresForPercentile = scores;

  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const minScore = scores.length ? Math.min(...scores) : 0;
  const medianScore = computeMedian(scores);
  const avgRate = totalPossible > 0 ? (avgScore / totalPossible) * 100 : 0;
  const totalGuessed = allAnswers.filter((a) => a.is_guessed).length;
  const totalBlank = allAnswers.filter((a) => a.is_blank).length;
  const avgGuessRate = (() => {
    const rates = completedStats.map((s) =>
      s.answeredCount > 0 ? (s.guessedCount / s.answeredCount) * 100 : 0
    );
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  })();

  const scoreDistribution = buildScoreDistribution(scores);
  const maxDistCount = Math.max(...scoreDistribution.map((b) => b.count), 1);

  const rankedStudents = [...completedStats]
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s, idx) => {
      const percentile = computePercentile(allScoresForPercentile, s.totalScore);
      const estGrade = computeEstimatedGrade(percentile);
      return { ...s, rank: idx + 1, percentile, estGrade };
    });

  const qStats = questions.map((q) => {
    const ans = allAnswers.filter((a) => a.question_id === q.id);
    const correctCount = ans.filter((a) => a.is_correct).length;
    const blankCount = ans.filter((a) => a.is_blank).length;
    const wrongCount = ans.length - correctCount - blankCount;
    const guessedCount = ans.filter((a) => a.is_guessed).length;
    const n = students.length;
    const correctRate = n > 0 ? (correctCount / n) * 100 : 0;
    const guessRate = ans.length > 0 ? (guessedCount / ans.length) * 100 : 0;
    return { q, correctCount, wrongCount, blankCount, guessedCount, n, correctRate, guessRate };
  });

  const top5Wrong = [...qStats].sort((a, b) => a.correctRate - b.correctRate).slice(0, 5);
  const top5Guess = [...qStats].filter((s) => s.guessedCount > 0).sort((a, b) => b.guessRate - a.guessRate).slice(0, 5);

  const classStats = classes.map((cls) => {
    const clsStudents = students.filter((s) => s.class_id === cls.id);
    const clsStudentIds = new Set(clsStudents.map((s) => s.id));
    const clsAnswers = allAnswers.filter((a) => clsStudentIds.has(a.student_id));
    const clsCompleted = studentStats.filter((s) => s.cls?.id === cls.id && s.isComplete);
    const clsScores = clsCompleted.map((s) => s.totalScore);
    const clsAvg = clsScores.length ? clsScores.reduce((a, b) => a + b, 0) / clsScores.length : 0;
    const clsAvgRate = totalPossible > 0 ? (clsAvg / totalPossible) * 100 : 0;
    const clsGuessRate = (() => {
      const rates = clsCompleted.map((s) =>
        s.answeredCount > 0 ? (s.guessedCount / s.answeredCount) * 100 : 0
      );
      return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    })();
    const clsBlank = clsAnswers.filter((a) => a.is_blank).length;
    return {
      cls,
      studentCount: clsStudents.length,
      completedCount: clsCompleted.length,
      avgScore: clsAvg,
      maxScore: clsScores.length ? Math.max(...clsScores) : 0,
      minScore: clsScores.length ? Math.min(...clsScores) : 0,
      avgRate: clsAvgRate,
      avgGuessRate: clsGuessRate,
      blankCount: clsBlank,
    };
  });

  type UnitAgg = { questionCount: number; total: number; correct: number };
  function buildUnitMap(getKey: (q: QuestionRow) => string): Map<string, UnitAgg> {
    const map = new Map<string, UnitAgg>();
    questions.forEach((q) => {
      const key = getKey(q);
      const entry = map.get(key) ?? { questionCount: 0, total: 0, correct: 0 };
      entry.questionCount++;
      map.set(key, entry);
    });
    allAnswers.forEach((a) => {
      const q = questions.find((qq) => qq.id === a.question_id);
      if (!q) return;
      const key = getKey(q);
      const entry = map.get(key);
      if (!entry) return;
      entry.total++;
      if (a.is_correct) entry.correct++;
    });
    return map;
  }

  const subjectUnits = buildUnitMap((q) => q.subject_name || '미분류');
  const majorUnits = buildUnitMap((q) => {
    const subject = q.subject_name || '미분류';
    return `${subject} > ${q.major_unit_name || '미분류'}`;
  });
  const middleUnits = buildUnitMap((q) => {
    const subject = q.subject_name || '미분류';
    const maj = q.major_unit_name || '미분류';
    return `${subject} > ${maj} > ${q.middle_unit_name || '미분류'}`;
  });
  const smallUnits = buildUnitMap((q) => {
    const subject = q.subject_name || '미분류';
    const maj = q.major_unit_name || '미분류';
    const mid = q.middle_unit_name || '미분류';
    return `${subject} > ${maj} > ${mid} > ${q.small_unit_name || '미분류'}`;
  });

  const diffLevels = [1, 2, 3, 4, 5, 6, 7, 8].map((level) => {
    const levelQs = questions.filter((q) => q.difficulty === level);
    const levelQIds = new Set(levelQs.map((q) => q.id));
    const ans = allAnswers.filter((a) => levelQIds.has(a.question_id));
    const correct = ans.filter((a) => a.is_correct).length;
    const guessed = ans.filter((a) => a.is_guessed).length;
    const total = ans.length;
    const rate = total > 0 ? (correct / total) * 100 : 0;
    const guessRate = total > 0 ? (guessed / total) * 100 : 0;
    return { level, qCount: levelQs.length, total, correct, rate, guessRate };
  }).filter((d) => d.qCount > 0 || d.total > 0);

  const highDiffAns = allAnswers.filter((a) => {
    const q = questions.find((qq) => qq.id === a.question_id);
    return (q?.difficulty ?? 0) >= 5;
  });
  const highDiffRate = highDiffAns.length > 0
    ? (highDiffAns.filter((a) => a.is_correct).length / highDiffAns.length) * 100
    : null;

  const lowUnitNames = [...majorUnits.entries()]
    .filter(([, v]) => v.total > 0 && v.correct / v.total < 0.4)
    .map(([name]) => name);

  const highGuessQCount = qStats.filter((s) => s.guessRate >= 30).length;

  const comment = students.length > 0 && questions.length > 0 && allAnswers.length > 0
    ? generateTestWideComment({
        avgRate,
        avgGuessRate,
        highDiffRate,
        lowUnitNames,
        highGuessQuestionCount: highGuessQCount,
      })
    : '';

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--fg-muted)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-base)',
  };

  const tdStyle = (i: number): React.CSSProperties => ({
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--fg-main)',
    borderTop: '1px solid var(--border)',
    background: i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9',
    verticalAlign: 'middle',
  });

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>테스트를 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록으로</Button></Link>
      </div>
    );
  }

  const emptyKind =
    classes.length === 0 ? 'no_classes'
    : questions.length === 0 ? 'no_questions'
    : students.length === 0 ? 'no_students'
    : allAnswers.length === 0 ? 'no_answers'
    : null;

  const infoItems = [
    { label: '테스트명', value: test.title },
    { label: '학년', value: test.grade || '–' },
    { label: '과목', value: test.subject_name || '–' },
    { label: '시험 범위', value: test.exam_range_text?.trim() || '범위 미입력' },
    { label: '총 문항 수', value: `${questions.length}문항` },
    { label: '부여된 반 수', value: `${classes.length}개` },
    { label: '전체 응시 학생 수', value: `${students.length}명` },
    { label: '답안 입력 완료', value: `${completedStats.length}명` },
    { label: '생성일', value: today },
  ];

  const summaryCards = [
    { label: '전체 응시자 수', value: `${students.length}명`, accent: false },
    { label: '답안 입력 완료', value: `${completedStats.length}명`, accent: false },
    { label: '전체 평균 점수', value: `${formatScoreValue(avgScore)}점`, accent: true },
    { label: '최고점', value: `${formatScoreValue(maxScore)}점`, accent: false },
    { label: '최저점', value: `${formatScoreValue(minScore)}점`, accent: false },
    { label: '중앙값', value: `${formatScoreValue(medianScore)}점`, accent: false },
    { label: '평균 정답률', value: `${avgRate.toFixed(1)}%`, accent: true },
    { label: '전체 찍음 수', value: `${totalGuessed}개`, accent: false },
    { label: '평균 찍음 비율', value: `${avgGuessRate.toFixed(1)}%`, accent: false },
    { label: '전체 미응답 수', value: `${totalBlank}개`, accent: false },
  ];

  return (
    <div className="report-wrap" style={{ maxWidth: 1100, margin: '0 auto' }}>

      <div className="flex items-start justify-between mb-5 no-print">
        <div className="flex items-start gap-3 flex-wrap">
          <Link href="/tests">
            <Button variant="ghost" size="sm"><ArrowLeft size={15} /> 테스트 목록</Button>
          </Link>
          <Link href={`/tests/${testId}/classes`}>
            <Button variant="ghost" size="sm"><Users size={15} /> 부여된 반</Button>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{test.title}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>테스트 전체 분석</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrintReportLink href={`/tests/${testId}/print`} />
          <Button variant="accent" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> 인쇄 / PDF 저장
          </Button>
        </div>
      </div>

      <div
        className="no-print rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-xs"
        style={{ background: 'var(--accent-lt)', border: '1px solid #fed7aa', color: '#7c2d12' }}
      >
        <Printer size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        인쇄 창에서 대상 프린터를 <strong>&apos;PDF로 저장&apos;</strong>으로 선택하면 PDF 파일로 저장할 수 있습니다.
      </div>

      <div className="rounded-2xl px-8 py-6 mb-6" style={{ background: 'var(--sidebar-bg)', color: '#fff' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold tracking-widest uppercase opacity-70">봉샘스쿨</span>
            </div>
            <h1 className="text-xl font-bold mb-1">봉샘스쿨 테스트 전체 분석 리포트</h1>
            <p className="text-sm opacity-60">{test.title}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{classes.length}개 반</p>
            <p className="text-sm opacity-60 mt-0.5">{students.length}명 응시</p>
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs opacity-50 shrink-0">{item.label}</span>
              <span className="text-sm font-medium opacity-90 truncate">{item.value}</span>
            </div>
          ))}
        </div>
        <p className="print-only mt-3 text-xs opacity-50">생성일: {today}</p>
      </div>

      {emptyKind && (
        <EmptyStatePanel kind={emptyKind} testId={testId} />
      )}

      {!emptyKind && (
        <div className="space-y-6">

          <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <SectionTitle>전체 요약</SectionTitle>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {summaryCards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: c.accent ? 'var(--accent)' : 'var(--bg-base)',
                    border: `1px solid ${c.accent ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <p className="text-xs font-medium mb-1.5" style={{ color: c.accent ? 'rgba(255,255,255,0.8)' : 'var(--fg-muted)' }}>{c.label}</p>
                  <p className="text-xl font-bold" style={{ color: c.accent ? '#fff' : 'var(--fg-main)' }}>{c.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <SectionTitle icon={<BarChart3 size={15} />}>점수 분포</SectionTitle>
            {scores.length === 0 ? (
              <EmptyState text="답안이 입력된 학생이 없어 분포를 계산할 수 없습니다." />
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['점수 구간', '학생 수', '비율', '분포'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scoreDistribution.map((band, i) => (
                      <tr key={band.label}>
                        <td style={tdStyle(i)}>{band.label}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center', fontWeight: 600 }}>{band.count}명</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{band.percentage.toFixed(1)}%</td>
                        <td style={tdStyle(i)}>
                          <div className="h-5 rounded overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${(band.count / maxDistCount) * 100}%`,
                                background: 'var(--accent)',
                                minWidth: band.count > 0 ? 4 : 0,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <SectionTitle icon={<Users size={15} />}>학생 전체 순위</SectionTitle>
            <div
              className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2 text-xs"
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}
            >
              <Info size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">봉샘스쿨 내부 데이터 기준 추정 등급</p>
                <p>해당 등급은 봉샘스쿨 테스트 응시 데이터 기준의 추정 등급이며, 실제 학교 내신 등급과 다를 수 있습니다.</p>
              </div>
            </div>
            {rankedStudents.length === 0 ? (
              <EmptyState text="순위를 산출할 답안 데이터가 없습니다." />
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table style={{ minWidth: 1100, borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {['순위', '학생명', '코드', '반명', '학원명', '강사명', '총점', '정답', '오답', '미응답', '찍음', '정답률', '백분위', '추정등급', ''].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rankedStudents.map((s, i) => (
                        <tr key={s.student.id}>
                          <td style={{ ...tdStyle(i), textAlign: 'center', fontWeight: 700 }}>{s.rank}</td>
                          <td style={tdStyle(i)}><span className="font-medium">{s.student.student_name}</span></td>
                          <td style={tdStyle(i)}><span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{s.student.student_code || '–'}</span></td>
                          <td style={tdStyle(i)}>{s.cls?.class_name || '–'}</td>
                          <td style={tdStyle(i)}>{s.cls?.academy_name || '–'}</td>
                          <td style={tdStyle(i)}>{s.cls?.teacher_name || '–'}</td>
                          <td style={{ ...tdStyle(i), fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>
                            {formatScoreValue(s.totalScore)}<span className="text-xs font-normal opacity-50">/{formatScoreValue(totalPossible)}</span>
                          </td>
                          <td style={{ ...tdStyle(i), color: '#16a34a', textAlign: 'center', fontWeight: 600 }}>{s.correctCount}</td>
                          <td style={{ ...tdStyle(i), color: '#dc2626', textAlign: 'center', fontWeight: 600 }}>{s.wrongCount}</td>
                          <td style={{ ...tdStyle(i), color: '#94a3b8', textAlign: 'center' }}>{s.blankCount}</td>
                          <td style={{ ...tdStyle(i), color: '#d97706', textAlign: 'center' }}>{s.guessedCount}</td>
                          <td style={{ ...tdStyle(i), minWidth: 100 }}><RateBar rate={s.scoreRate} small /></td>
                          <td style={{ ...tdStyle(i), textAlign: 'center' }}>{s.percentile.toFixed(1)}</td>
                          <td style={{ ...tdStyle(i), textAlign: 'center', fontWeight: 700 }}>{s.estGrade}등급</td>
                          <td style={{ ...tdStyle(i), textAlign: 'center' }} className="no-print">
                            <Link href={`/students/${s.student.id}/tests/${testId}/report`}>
                              <button
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:opacity-80 whitespace-nowrap"
                                style={{ background: 'var(--accent-lt)', color: 'var(--accent)', borderColor: '#fed7aa' }}
                              >
                                <FileBarChart size={12} /> 리포트
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <SectionTitle icon={<GraduationCap size={15} />}>반별 비교 분석</SectionTitle>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table style={{ minWidth: 900, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['반명', '학원명', '강사명', '응시 수', '평균 점수', '최고점', '최저점', '평균 정답률', '평균 찍음 비율', '미응답', ''].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classStats.map((c, i) => (
                      <tr key={c.cls.id}>
                        <td style={tdStyle(i)}><span className="font-medium">{c.cls.class_name || '–'}</span></td>
                        <td style={tdStyle(i)}>{c.cls.academy_name || '–'}</td>
                        <td style={tdStyle(i)}>{c.cls.teacher_name || '–'}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{c.studentCount}명</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center', fontWeight: 600 }}>{formatScoreValue(c.avgScore)}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{formatScoreValue(c.maxScore)}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{formatScoreValue(c.minScore)}</td>
                        <td style={{ ...tdStyle(i), minWidth: 110 }}><RateBar rate={c.avgRate} small /></td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{c.avgGuessRate.toFixed(1)}%</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{c.blankCount}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }} className="no-print">
                          <Link href={`/classes/${c.cls.id}/tests/${testId}/analysis`}>
                            <button
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap"
                              style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                            >
                              <BarChart3 size={12} /> 반 분석
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="report-section page-break-before rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <SectionTitle icon={<BarChart3 size={15} />}>문항별 전체 정답률</SectionTitle>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table style={{ minWidth: 1160, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['번호', '정답', '배점', '정답자', '오답자', '미응답', '정답률', '찍음', '찍음률', '대단원', '중단원', '소단원', '난이도', '문항 특징'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {qStats.map((s, i) => {
                      const isLow = s.correctRate < 40;
                      const rowBg = isLow ? (i % 2 === 0 ? '#fff5f5' : '#fff1f1') : (i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9');
                      return (
                        <tr key={s.q.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center' }}>
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold" style={{ background: isLow ? '#fee2e2' : 'var(--accent-lt)', color: isLow ? '#dc2626' : 'var(--accent)' }}>
                              {s.q.question_number}
                            </span>
                          </td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', fontWeight: 600 }}>{s.q.answer ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center' }}>{formatScoreValue(s.q.score)}점</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{s.correctCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{s.wrongCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#94a3b8' }}>{s.blankCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, minWidth: 120 }}><RateBar rate={s.correctRate} small /></td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#d97706' }}>{s.guessedCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center' }}>{s.guessRate.toFixed(0)}%</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12 }}>{s.q.major_unit_name ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12 }}>{s.q.middle_unit_name ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12 }}>{s.q.small_unit_name ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {s.q.difficulty !== null ? `${difficultyInterpretation(s.q.difficulty)} (${s.q.difficulty})` : '–'}
                          </td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, minWidth: 160 }}>
                            {featureComment(s.q) ?? '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>
            <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <SectionTitle icon={<TrendingDown size={15} />}>전체 오답률 TOP 5</SectionTitle>
              <div className="space-y-2">
                {top5Wrong.map((s, i) => (
                  <div key={s.q.id} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0" style={{ background: '#fee2e2', color: '#dc2626' }}>{s.q.question_number}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm" style={{ color: '#dc2626' }}>정답률 {s.correctRate.toFixed(1)}%</span>
                        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>오답 {s.wrongCount}명</span>
                        {s.q.major_unit_name && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}>{s.q.major_unit_name}</span>
                        )}
                      </div>
                      {featureComment(s.q) && (
                        <p className="text-xs mb-1" style={{ color: 'var(--fg-sub)' }}>
                          문항 특징: {featureComment(s.q)}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: '#7c2d12' }}>{wrongHintWithFeature(s.correctRate, s.q.difficulty, s.q)}</p>
                    </div>
                    <span className="text-xl font-bold shrink-0" style={{ color: 'var(--fg-muted)' }}>{i + 1}위</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <SectionTitle icon={<Crosshair size={15} />}>전체 찍음 비율 TOP 5</SectionTitle>
              {top5Guess.length === 0 ? (
                <EmptyState text="찍음 체크된 답안이 없습니다." />
              ) : (
                <div className="space-y-2">
                  {top5Guess.map((s, i) => (
                    <div key={s.q.id} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0" style={{ background: '#fff7ed', color: '#ea580c' }}>{s.q.question_number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm" style={{ color: '#ea580c' }}>찍음 {s.guessRate.toFixed(1)}%</span>
                          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{s.guessedCount}명 · 정답률 {s.correctRate.toFixed(1)}%</span>
                        </div>
                        {featureComment(s.q) && (
                          <p className="text-xs mb-1" style={{ color: 'var(--fg-sub)' }}>
                            문항 특징: {featureComment(s.q)}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: '#78350f' }}>{guessHintWithFeature(s.guessRate, s.q.difficulty, s.q)}</p>
                      </div>
                      <span className="text-xl font-bold shrink-0" style={{ color: 'var(--fg-muted)' }}>{i + 1}위</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <SectionTitle>단원별 전체 성취도</SectionTitle>
              <div className="space-y-4">
              <UnitTable title="과목" entries={[...subjectUnits.entries()]} thStyle={thStyle} tdStyle={tdStyle} />
              <UnitTable title="대단원" entries={[...majorUnits.entries()]} thStyle={thStyle} tdStyle={tdStyle} />
              {middleUnits.size > 0 && <UnitTable title="중단원" entries={[...middleUnits.entries()]} thStyle={thStyle} tdStyle={tdStyle} />}
              {smallUnits.size > 0 && <UnitTable title="소단원" entries={[...smallUnits.entries()]} thStyle={thStyle} tdStyle={tdStyle} />}
            </div>
          </section>

          {diffLevels.length > 0 && (
            <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <SectionTitle>난이도별 전체 성취도</SectionTitle>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table style={{ minWidth: 700, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['난이도', '난이도 해석', '문항 수', '전체 답안 수', '정답 수', '정답률', '찍음 비율', '평가'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diffLevels.map((d, i) => (
                      <tr key={d.level}>
                        <td style={tdStyle(i)}><span className="font-semibold">{d.level}</span></td>
                        <td style={tdStyle(i)}>{difficultyInterpretation(d.level)}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{d.qCount}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{d.total}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{d.correct}</td>
                        <td style={{ ...tdStyle(i), minWidth: 120 }}><RateBar rate={d.rate} small /></td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{d.guessRate.toFixed(1)}%</td>
                        <td style={tdStyle(i)}><EvalBadge rate={d.rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {comment && (
            <section className="report-section rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <SectionTitle>테스트 전체 자동 코멘트</SectionTitle>
              <div className="rounded-xl px-6 py-5" style={{ background: 'var(--accent-lt)', border: '1px solid #fed7aa' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#7c2d12' }}>{comment}</p>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3 no-print">
        <Link href={`/tests/${testId}/questions`}>
          <Button variant="outline"><Edit2 size={15} /> 문항 입력</Button>
        </Link>
        <Link href={`/tests/${testId}/assign-classes`}>
          <Button variant="outline"><Users size={15} /> 반에 일괄 부여</Button>
        </Link>
        <Link href="/tests">
          <Button variant="outline"><ArrowLeft size={15} /> 테스트 목록</Button>
        </Link>
      </div>
    </div>
  );
}

function UnitTable({
  title,
  entries,
  thStyle,
  tdStyle,
}: {
  title: string;
  entries: [string, { questionCount: number; total: number; correct: number }][];
  thStyle: React.CSSProperties;
  tdStyle: (i: number) => React.CSSProperties;
}) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--fg-muted)' }}>{title}</p>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['단원명', '문항 수', '전체 답안 수', '정답 수', '정답률', '평가'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, s], i) => {
              const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
              return (
                <tr key={name}>
                  <td style={tdStyle(i)}>{name}</td>
                  <td style={{ ...tdStyle(i), textAlign: 'center' }}>{s.questionCount}</td>
                  <td style={{ ...tdStyle(i), textAlign: 'center' }}>{s.total}</td>
                  <td style={{ ...tdStyle(i), textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{s.correct}</td>
                  <td style={{ ...tdStyle(i), minWidth: 140 }}><RateBar rate={rate} small /></td>
                  <td style={tdStyle(i)}><EvalBadge rate={rate} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyStatePanel({ kind, testId }: { kind: string; testId: number }) {
  const configs: Record<string, { title: string; desc: string; actions: { label: string; href: string; variant?: 'accent' | 'outline' }[] }> = {
    no_classes: {
      title: '아직 어떤 반에도 부여되지 않았습니다',
      desc: '테스트를 반에 부여한 후 학생을 등록하고 답안을 입력하면 전체 분석을 확인할 수 있습니다.',
      actions: [
        { label: '반에 일괄 부여', href: `/tests/${testId}/assign-classes`, variant: 'accent' },
        { label: '반 생성', href: `/tests/${testId}/classes/new`, variant: 'outline' },
      ],
    },
    no_questions: {
      title: '문항 정보가 없습니다',
      desc: '문항별 정답, 배점, 단원, 난이도를 먼저 입력해 주세요.',
      actions: [{ label: '문항 입력', href: `/tests/${testId}/questions`, variant: 'accent' }],
    },
    no_students: {
      title: '부여된 반에 학생이 없습니다',
      desc: '각 반에서 학생을 등록한 후 답안을 입력해 주세요.',
      actions: [
        { label: '부여된 반 보기', href: `/tests/${testId}/classes`, variant: 'accent' },
        { label: '반 관리', href: '/classes', variant: 'outline' },
      ],
    },
    no_answers: {
      title: '아직 답안이 입력되지 않았습니다',
      desc: '반별 답안 입력 화면에서 학생 답안을 입력하면 분석 결과가 표시됩니다.',
      actions: [
        { label: '부여된 반 보기', href: `/tests/${testId}/classes`, variant: 'accent' },
      ],
    },
  };

  const cfg = configs[kind] ?? configs.no_answers;

  return (
    <div
      className="rounded-xl border px-8 py-10 text-center mb-6"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <ClipboardList size={36} className="mx-auto mb-3 opacity-25" style={{ color: 'var(--fg-muted)' }} />
      <h3 className="font-bold text-base mb-2" style={{ color: 'var(--fg-main)' }}>{cfg.title}</h3>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: 'var(--fg-muted)' }}>{cfg.desc}</p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {cfg.actions.map((a) => (
          <Link key={a.href} href={a.href}>
            <Button variant={a.variant === 'accent' ? 'accent' : 'outline'} size="sm">{a.label}</Button>
          </Link>
        ))}
      </div>
    </div>
  );
}

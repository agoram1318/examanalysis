'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Users, AlertCircle, Loader2, ChevronRight,
  BarChart3, FileBarChart, TrendingDown, Crosshair, Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
  test_id: number;
};

type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  subject_name: string | null;
};

type StudentRow = {
  id: number;
  student_name: string;
  student_code: string | null;
};

type QuestionRow = {
  id: number;
  question_number: number;
  answer: string | null;
  score: number;
  question_type: string | null;
  difficulty: number | null;
  evaluation_point: string | null;
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

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
type UnitRaw = { name: string } | { name: string }[] | null;
function pickName(raw: unknown): string | null {
  const u = raw as UnitRaw;
  if (!u) return null;
  if (Array.isArray(u)) return u[0]?.name ?? null;
  return u.name ?? null;
}

function evalLabel(rate: number): { text: string; color: string; bg: string } {
  if (rate >= 80) return { text: '안정',      color: '#15803d', bg: '#f0fdf4' };
  if (rate >= 60) return { text: '보통',      color: '#ca8a04', bg: '#fefce8' };
  if (rate >= 40) return { text: '보완 필요', color: '#ea580c', bg: '#fff7ed' };
  return              { text: '집중 보완', color: '#dc2626', bg: '#fef2f2' };
}

function difficultyGroup(d: number | null): string {
  if (d === null) return '미설정';
  if (d <= 2) return '기본 확인 (1~2)';
  if (d <= 4) return '기본 적용 (3~4)';
  if (d <= 6) return '중상 난도 (5~6)';
  return '고난도/킬러 (7~8)';
}

const DIFF_ORDER = ['기본 확인 (1~2)', '기본 적용 (3~4)', '중상 난도 (5~6)', '고난도/킬러 (7~8)', '미설정'];

// ─────────────────────────────────────────────
// 자동 코멘트
// ─────────────────────────────────────────────
interface AnalysisData {
  avgRate:          number;
  avgGuessRate:     number;
  typeStats:        Map<string, { total: number; correct: number }>;
  diffStats:        Map<string, { total: number; correct: number; guessed: number }>;
  questions:        QuestionRow[];
  allAnswers:       AnswerRow[];
  studentCount:     number;
}

function generateClassComment(d: AnalysisData): string {
  const parts: string[] = [];

  if (d.avgRate >= 80) {
    parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  } else if (d.avgRate >= 60) {
    parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  } else if (d.avgRate >= 40) {
    parts.push('개념 이해와 유형 적용 훈련이 함께 필요합니다.');
  } else {
    parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');
  }

  if (d.avgGuessRate >= 20) {
    parts.push('풀이 확신도와 시간 관리 점검이 필요합니다.');
  }

  const condType = d.typeStats.get('조건 해석형');
  if (condType && condType.total > 0 && condType.correct / condType.total < 0.5) {
    parts.push('조건을 식으로 정리하고 풀이 방향을 잡는 훈련이 필요합니다.');
  }

  const highDiff = d.diffStats.get('중상 난도 (5~6)');
  const topDiff  = d.diffStats.get('고난도/킬러 (7~8)');
  const highTotal   = (highDiff?.total ?? 0) + (topDiff?.total ?? 0);
  const highCorrect = (highDiff?.correct ?? 0) + (topDiff?.correct ?? 0);
  if (highTotal > 0 && highCorrect / highTotal < 0.4) {
    parts.push('중상 난도 변별 문항 접근 전략이 필요합니다.');
  }

  const lastQ = d.questions.slice(Math.floor(d.questions.length * 0.75));
  const lastQIds = new Set(lastQ.map((q) => q.id));
  const blankAtEnd = d.allAnswers.filter(
    (a) => lastQIds.has(a.question_id) && (a.is_blank || !a.selected_answer)
  ).length;
  const maxBlankAtEnd = lastQ.length * d.studentCount;
  if (maxBlankAtEnd > 0 && blankAtEnd / maxBlankAtEnd >= 0.25) {
    parts.push('시간 배분 훈련이 필요합니다.');
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────
function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
      {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
      <h2 className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
        {children}
      </h2>
    </div>
  );
}

function RateBar({ rate, small }: { rate: number; small?: boolean }) {
  const color = rate >= 80 ? '#22c55e' : rate >= 60 ? '#eab308' : rate >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: small ? 5 : 6, background: 'var(--border)' }}
      >
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 9999 }} />
      </div>
      <span
        className="font-semibold shrink-0 text-right"
        style={{ color: 'var(--fg-main)', fontSize: small ? 11 : 12, minWidth: 38 }}
      >
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function EvalBadge({ rate }: { rate: number }) {
  const ev = evalLabel(rate);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: ev.bg, color: ev.color }}
    >
      {ev.text}
    </span>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function ClassAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: classIdStr } = use(params);
  const classId = Number(classIdStr);

  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cls, setCls]         = useState<ClassRow | null>(null);
  const [test, setTest]       = useState<TestRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  // ── 데이터 로드
  useEffect(() => {
    if (isNaN(classId)) { setNotFound(true); setLoading(false); return; }

    async function load() {
      // 1. 반
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name, test_id')
        .eq('id', classId)
        .single();

      if (classErr || !classData) { setNotFound(true); setLoading(false); return; }
      setCls(classData);

      // 2. 테스트
      const { data: testRaw, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, subjects(name)')
        .eq('id', classData.test_id)
        .single();

      if (testErr || !testRaw) { setNotFound(true); setLoading(false); return; }
      const subjectName = (() => {
        const s = testRaw.subjects as unknown as UnitRaw;
        if (!s) return null;
        if (Array.isArray(s)) return s[0]?.name ?? null;
        return (s as { name: string }).name ?? null;
      })();
      setTest({ id: testRaw.id, title: testRaw.title, grade: testRaw.grade, subject_name: subjectName });

      // 3. 학생 + 문항 (병렬)
      const [studentsRes, questionsRes] = await Promise.all([
        supabase.from('students').select('id, student_name, student_code').eq('class_id', classId).order('student_code'),
        supabase.from('questions').select(`
          id, question_number, answer, score, question_type, difficulty, evaluation_point,
          units_major:major_unit_id(name),
          units_middle:middle_unit_id(name),
          units_small:small_unit_id(name)
        `).eq('test_id', classData.test_id).order('question_number'),
      ]);

      const studentsData = studentsRes.data ?? [];
      setStudents(studentsData);

      const qs: QuestionRow[] = (questionsRes.data ?? []).map((q) => ({
        id:               q.id,
        question_number:  q.question_number,
        answer:           q.answer,
        score:            Number(q.score),
        question_type:    q.question_type,
        difficulty:       q.difficulty,
        evaluation_point: q.evaluation_point,
        major_unit_name:  pickName(q.units_major),
        middle_unit_name: pickName(q.units_middle),
        small_unit_name:  pickName(q.units_small),
      }));
      setQuestions(qs);

      if (!studentsData.length || !qs.length) { setLoading(false); return; }

      // 4. 전체 답안
      const studentIds  = studentsData.map((s) => s.id);
      const questionIds = qs.map((q) => q.id);

      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('student_id, question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .in('student_id', studentIds)
        .in('question_id', questionIds);

      setAllAnswers(
        (answersRaw ?? []).map((a) => ({
          ...a,
          earned_score: Number(a.earned_score),
        }))
      );
      setLoading(false);
    }

    load();
  }, [classId]);

  // ─────────────────────────────────────────────
  // 집계 계산
  // ─────────────────────────────────────────────

  // 학생별 합산
  const studentStats = students.map((s) => {
    const answers = allAnswers.filter((a) => a.student_id === s.id);
    const totalScore    = answers.reduce((sum, a) => sum + a.earned_score, 0);
    const correctCount  = answers.filter((a) => a.is_correct).length;
    const blankCount    = answers.filter((a) => a.is_blank || !a.selected_answer).length;
    const wrongCount    = answers.length - correctCount - blankCount;
    const guessedCount  = answers.filter((a) => a.is_guessed).length;
    const guessedCorrect = answers.filter((a) => a.is_guessed && a.is_correct).length;
    const guessedWrong  = answers.filter((a) => a.is_guessed && !a.is_correct).length;
    const answeredCount = answers.filter((a) => !a.is_blank && a.selected_answer).length;
    const totalPossible = questions.reduce((sum, q) => sum + q.score, 0);
    const scoreRate     = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    return { student: s, totalScore, totalPossible, correctCount, wrongCount, blankCount, guessedCount, guessedCorrect, guessedWrong, answeredCount, scoreRate };
  }).filter((s) => s.answeredCount > 0 || s.totalScore > 0);

  const totalPossible = questions.reduce((sum, q) => sum + q.score, 0);
  const scores        = studentStats.map((s) => s.totalScore);
  const avgScore      = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const maxScore      = scores.length ? Math.max(...scores) : 0;
  const minScore      = scores.length ? Math.min(...scores) : 0;
  const avgRate       = totalPossible > 0 ? (avgScore / totalPossible) * 100 : 0;
  const totalGuessed  = allAnswers.filter((a) => a.is_guessed).length;
  const totalBlank    = allAnswers.filter((a) => a.is_blank || !a.selected_answer).length;
  const avgGuessRate  = (() => {
    const rates = studentStats.map((s) =>
      s.answeredCount > 0 ? (s.guessedCount / s.answeredCount) * 100 : 0
    );
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  })();

  // 문항별 집계
  const qStats = questions.map((q) => {
    const ans = allAnswers.filter((a) => a.question_id === q.id);
    const correctCount  = ans.filter((a) => a.is_correct).length;
    const blankCount    = ans.filter((a) => a.is_blank || !a.selected_answer).length;
    const wrongCount    = ans.length - correctCount - blankCount;
    const guessedCount  = ans.filter((a) => a.is_guessed).length;
    const n             = students.length;
    const correctRate   = n > 0 ? (correctCount / n) * 100 : 0;
    const guessRate     = ans.length > 0 ? (guessedCount / ans.length) * 100 : 0;
    return { q, correctCount, wrongCount, blankCount, guessedCount, n, correctRate, guessRate };
  });

  // TOP 5 오답
  const top5Wrong = [...qStats]
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 5);

  // TOP 5 찍음
  const top5Guess = [...qStats]
    .filter((s) => s.guessedCount > 0)
    .sort((a, b) => b.guessRate - a.guessRate)
    .slice(0, 5);

  // 단원별 집계
  const majorMap = new Map<string, { total: number; correct: number }>();
  const middleMap = new Map<string, { total: number; correct: number }>();
  allAnswers.forEach((a) => {
    const q = questions.find((q) => q.id === a.question_id);
    if (!q) return;
    const maj = q.major_unit_name || '미분류';
    const mid = q.middle_unit_name ? `${maj} > ${q.middle_unit_name}` : `${maj} > 미분류`;

    const majEntry = majorMap.get(maj) ?? { total: 0, correct: 0 };
    majEntry.total++;
    if (a.is_correct) majEntry.correct++;
    majorMap.set(maj, majEntry);

    const midEntry = middleMap.get(mid) ?? { total: 0, correct: 0 };
    midEntry.total++;
    if (a.is_correct) midEntry.correct++;
    middleMap.set(mid, midEntry);
  });

  // 유형별 집계
  const typeMap = new Map<string, { total: number; correct: number }>();
  allAnswers.forEach((a) => {
    const q = questions.find((q) => q.id === a.question_id);
    if (!q) return;
    const type = q.question_type || '유형 미설정';
    const e = typeMap.get(type) ?? { total: 0, correct: 0 };
    e.total++;
    if (a.is_correct) e.correct++;
    typeMap.set(type, e);
  });

  // 난이도별 집계
  const diffMap = new Map<string, { total: number; correct: number; guessed: number }>();
  allAnswers.forEach((a) => {
    const q = questions.find((q) => q.id === a.question_id);
    if (!q) return;
    const key = difficultyGroup(q.difficulty);
    const e = diffMap.get(key) ?? { total: 0, correct: 0, guessed: 0 };
    e.total++;
    if (a.is_correct) e.correct++;
    if (a.is_guessed) e.guessed++;
    diffMap.set(key, e);
  });
  const diffMapSorted = [...diffMap.entries()]
    .sort(([a], [b]) => DIFF_ORDER.indexOf(a) - DIFF_ORDER.indexOf(b));

  // 자동 코멘트
  const comment = students.length > 0 && questions.length > 0
    ? generateClassComment({ avgRate, avgGuessRate, typeStats: typeMap, diffStats: diffMap, questions, allAnswers, studentCount: students.length })
    : '';

  // 오답 해석 문구
  function wrongHint(qs: typeof qStats[0]): string {
    if (qs.correctRate < 20) return '고난도 문항으로 변별력이 크게 나타난 문항입니다.';
    if (qs.q.question_type?.includes('조건')) return '조건 해석 과정에서 어려움이 있었을 가능성이 높습니다.';
    if ((qs.q.difficulty ?? 0) >= 6) return '고난도 문항으로 변별력이 크게 나타난 문항입니다.';
    return '정답률이 낮아 해당 단원의 재점검이 필요합니다.';
  }

  // 찍음 해석 문구
  function guessHint(qs: typeof qStats[0]): string {
    if ((qs.q.difficulty ?? 0) >= 6) return '점수보다 실질 체감 난도가 높았을 가능성이 있습니다.';
    if (qs.guessRate >= 50) return '학생들이 풀이 방향을 잡기 어려워한 문항입니다.';
    return '시간 부족 또는 접근 불안정성이 나타난 문항입니다.';
  }

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound || !cls || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>반을 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록으로</Button></Link>
      </div>
    );
  }

  const noData = allAnswers.length === 0;

  const infoItems = [
    { label: '테스트명',  value: test.title },
    { label: '학년',      value: test.grade || '–' },
    { label: '과목',      value: test.subject_name || '–' },
    { label: '강사명',    value: cls.teacher_name || '–' },
    { label: '학원명',    value: cls.academy_name || '–' },
    { label: '반명',      value: cls.class_name || '–' },
    { label: '응시 인원', value: `${students.length}명` },
  ];

  const summaryCards = [
    { label: '응시 인원',     value: `${students.length}명`,             accent: false },
    { label: '평균 점수',     value: `${avgScore.toFixed(1)}점`,          accent: true  },
    { label: '최고점',        value: `${maxScore.toFixed(1)}점`,          accent: false },
    { label: '최저점',        value: `${minScore.toFixed(1)}점`,          accent: false },
    { label: '평균 정답률',   value: `${avgRate.toFixed(1)}%`,            accent: true  },
    { label: '총 찍음 수',    value: `${totalGuessed}개`,                 accent: false },
    { label: '평균 찍음 비율', value: `${avgGuessRate.toFixed(1)}%`,      accent: false },
    { label: '미응답 총합',   value: `${totalBlank}개`,                   accent: false },
  ];

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

  return (
    <div className="report-wrap" style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── 네비게이션 헤더 ── */}
      <div className="flex items-start justify-between mb-5 no-print">
        <div className="flex items-start gap-3">
          <div className="flex gap-2">
            <Link href={`/classes/${classId}/answers`}>
              <Button variant="ghost" size="sm"><ArrowLeft size={15} /> 답안 입력</Button>
            </Link>
            <Link href={`/classes/${classId}/students`}>
              <Button variant="ghost" size="sm"><Users size={15} /> 학생 등록</Button>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{test.title}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>{cls.class_name || '반'}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>반 전체 분석</span>
          </div>
        </div>
        <Button variant="accent" size="sm" onClick={() => window.print()}>
          <Printer size={14} /> 인쇄 / PDF 저장
        </Button>
      </div>

      {/* 인쇄 안내 (화면에서만 표시) */}
      <div
        className="no-print rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-xs"
        style={{ background: 'var(--accent-lt)', border: '1px solid #fed7aa', color: '#7c2d12' }}
      >
        <Printer size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        인쇄 창에서 대상 프린터를 <strong>&apos;PDF로 저장&apos;</strong>으로 선택하면 PDF 파일로 저장할 수 있습니다.
        반 전체 분석은 가로 방향 인쇄를 권장합니다.
      </div>

      {/* ── 리포트 헤더 ── */}
      <div
        className="rounded-2xl px-8 py-6 mb-6"
        style={{ background: 'var(--sidebar-bg)', color: '#fff' }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold tracking-widest uppercase opacity-70">봉샘스쿨</span>
            </div>
            <h1 className="text-xl font-bold mb-1">반 전체 학습 분석 리포트</h1>
            <p className="text-sm opacity-60">{test.title}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{cls.class_name || '–'}</p>
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

        {/* 생성일 — 인쇄 시만 표시 */}
        <p className="print-only mt-3 text-xs opacity-50">생성일: {today}</p>
      </div>

      <div className="space-y-6">

        {/* ① 전체 요약 카드 */}
        <section
          className="report-section rounded-xl border p-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
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
                <p className="text-xs font-medium mb-1.5" style={{ color: c.accent ? 'rgba(255,255,255,0.8)' : 'var(--fg-muted)' }}>
                  {c.label}
                </p>
                <p className="text-xl font-bold" style={{ color: c.accent ? '#fff' : 'var(--fg-main)' }}>
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ② 학생별 점수 리스트 */}
        <section
          className="report-section rounded-xl border p-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <SectionTitle icon={<Users size={15} />}>학생별 점수</SectionTitle>
          {studentStats.length === 0 ? (
            <EmptyState text="아직 답안이 입력되지 않았습니다." />
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table style={{ minWidth: 860, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['코드', '학생명', '총점', '정답', '오답', '미응답', '찍음', '찍어서 맞음', '찍어서 틀림', '정답률', ''].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...studentStats].sort((a, b) => b.totalScore - a.totalScore).map((s, i) => (
                      <tr key={s.student.id}>
                        <td style={tdStyle(i)}>
                          <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
                            {s.student.student_code || '–'}
                          </span>
                        </td>
                        <td style={tdStyle(i)}>
                          <span className="font-medium">{s.student.student_name}</span>
                        </td>
                        <td style={{ ...tdStyle(i), fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>
                          {s.totalScore.toFixed(1)}
                          <span className="text-xs font-normal opacity-50">/{s.totalPossible}</span>
                        </td>
                        <td style={{ ...tdStyle(i), color: '#16a34a', textAlign: 'center', fontWeight: 600 }}>{s.correctCount}</td>
                        <td style={{ ...tdStyle(i), color: '#dc2626', textAlign: 'center', fontWeight: 600 }}>{s.wrongCount}</td>
                        <td style={{ ...tdStyle(i), color: '#94a3b8', textAlign: 'center' }}>{s.blankCount}</td>
                        <td style={{ ...tdStyle(i), color: '#d97706', textAlign: 'center' }}>{s.guessedCount}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{s.guessedCorrect}</td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>{s.guessedWrong}</td>
                        <td style={{ ...tdStyle(i), minWidth: 120 }}>
                          <RateBar rate={s.scoreRate} small />
                        </td>
                        <td style={{ ...tdStyle(i), textAlign: 'center' }}>
                          <Link href={`/students/${s.student.id}/report`}>
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

        {/* ③ 문항별 정답률 */}
        <section
          className="report-section page-break-before rounded-xl border p-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <SectionTitle icon={<BarChart3 size={15} />}>문항별 정답률 분석</SectionTitle>
          {noData ? (
            <EmptyState text="답안 데이터가 없습니다." />
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table style={{ minWidth: 1000, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['번호', '정답', '배점', '정답자', '오답자', '미응답', '정답률', '찍음', '찍음률', '대단원', '중단원', '소단원', '유형', '난이도', '평가 포인트'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {qStats.map((s, i) => {
                      const isLow = s.correctRate < 40;
                      const rowBg = isLow
                        ? (i % 2 === 0 ? '#fff5f5' : '#fff1f1')
                        : (i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9');
                      return (
                        <tr key={s.q.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center' }}>
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                              style={{
                                background: isLow ? '#fee2e2' : 'var(--accent-lt)',
                                color: isLow ? '#dc2626' : 'var(--accent)',
                              }}
                            >
                              {s.q.question_number}
                            </span>
                          </td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', fontWeight: 600 }}>{s.q.answer ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center' }}>{s.q.score}점</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{s.correctCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{s.wrongCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#94a3b8' }}>{s.blankCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, minWidth: 120 }}>
                            <RateBar rate={s.correctRate} small />
                          </td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center', color: '#d97706' }}>{s.guessedCount}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, textAlign: 'center' }}>
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                              style={{
                                background: s.guessRate >= 30 ? '#fff7ed' : 'transparent',
                                color: s.guessRate >= 30 ? '#ea580c' : 'var(--fg-muted)',
                              }}
                            >
                              {s.guessRate.toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, color: 'var(--fg-sub)' }}>{s.q.major_unit_name ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, color: 'var(--fg-sub)' }}>{s.q.middle_unit_name ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, color: 'var(--fg-sub)' }}>{s.q.small_unit_name ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, color: 'var(--fg-sub)' }}>{s.q.question_type ?? '–'}</td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 12, color: 'var(--fg-sub)', whiteSpace: 'nowrap' }}>
                            {s.q.difficulty !== null ? difficultyGroup(s.q.difficulty).replace(/ \(.*\)/, '') : '–'}
                            {s.q.difficulty !== null ? ` (${s.q.difficulty})` : ''}
                          </td>
                          <td style={{ ...tdStyle(i), background: rowBg, fontSize: 11, color: 'var(--fg-muted)', maxWidth: 140 }}>
                            {s.q.evaluation_point ?? '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                className="px-4 py-2 text-xs flex items-center gap-1.5"
                style={{ borderTop: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'var(--bg-base)' }}
              >
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}
                />
                정답률 40% 미만 문항은 붉은 배경으로 표시됩니다.
              </div>
            </div>
          )}
        </section>

        {/* ④⑤ TOP5 그리드 */}
        {!noData && (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>

            {/* TOP5 오답 */}
            <section
              className="report-section rounded-xl border p-6"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <SectionTitle icon={<TrendingDown size={15} />}>가장 많이 틀린 문항 TOP 5</SectionTitle>
              <div className="space-y-2">
                {top5Wrong.map((s, i) => {
                  return (
                    <div
                      key={s.q.id}
                      className="rounded-xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        {s.q.question_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="font-bold text-sm"
                            style={{ color: '#dc2626' }}
                          >
                            정답률 {s.correctRate.toFixed(1)}%
                          </span>
                          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>오답 {s.wrongCount}명</span>
                          {s.q.major_unit_name && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                            >
                              {s.q.major_unit_name}
                            </span>
                          )}
                          <EvalBadge rate={s.correctRate} />
                        </div>
                        <div className="flex gap-3 text-xs mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                          {s.q.question_type && <span>유형: {s.q.question_type}</span>}
                          {s.q.difficulty !== null && <span>난이도: {s.q.difficulty}</span>}
                        </div>
                        <p className="text-xs" style={{ color: '#7c2d12' }}>{wrongHint(s)}</p>
                      </div>
                      <span
                        className="text-xl font-bold shrink-0"
                        style={{ color: 'var(--fg-muted)', lineHeight: 1 }}
                      >
                        {i + 1}위
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* TOP5 찍음 */}
            <section
              className="report-section rounded-xl border p-6"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <SectionTitle icon={<Crosshair size={15} />}>찍음 비율 높은 문항 TOP 5</SectionTitle>
              {top5Guess.length === 0 ? (
                <EmptyState text="찍음 체크된 답안이 없습니다." />
              ) : (
                <div className="space-y-2">
                  {top5Guess.map((s, i) => (
                    <div
                      key={s.q.id}
                      className="rounded-xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
                        style={{ background: '#fff7ed', color: '#ea580c' }}
                      >
                        {s.q.question_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm" style={{ color: '#ea580c' }}>
                            찍음 {s.guessRate.toFixed(1)}%
                          </span>
                          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                            {s.guessedCount}명 / 정답률 {s.correctRate.toFixed(1)}%
                          </span>
                          {s.q.major_unit_name && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                            >
                              {s.q.major_unit_name}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                          {s.q.question_type && <span>유형: {s.q.question_type}</span>}
                          {s.q.difficulty !== null && <span>난이도: {s.q.difficulty}</span>}
                        </div>
                        <p className="text-xs" style={{ color: '#78350f' }}>{guessHint(s)}</p>
                      </div>
                      <span
                        className="text-xl font-bold shrink-0"
                        style={{ color: 'var(--fg-muted)', lineHeight: 1 }}
                      >
                        {i + 1}위
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ⑥ 단원별 분석 */}
        {!noData && (majorMap.size > 0 || middleMap.size > 0) && (
          <section
            className="report-section rounded-xl border p-6"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <SectionTitle>단원별 정답률 분석</SectionTitle>
            <div className="space-y-4">
              <UnitTable label="대단원" entries={[...majorMap.entries()]} />
              {middleMap.size > 0 && <UnitTable label="중단원" entries={[...middleMap.entries()]} />}
            </div>
          </section>
        )}

        {/* ⑦ 유형별 분석 */}
        {!noData && typeMap.size > 0 && (
          <section
            className="report-section rounded-xl border p-6"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <SectionTitle>유형별 정답률 분석</SectionTitle>
            <ClassAnalysisTable
              headers={['유형', '문항 수', '전체 답안 수', '정답 수', '정답률', '평가']}
              rows={[...typeMap.entries()].map(([name, s]) => {
                const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
                return { name, total: questions.filter((q) => (q.question_type || '유형 미설정') === name).length, answers: s.total, correct: s.correct, rate };
              })}
            />
          </section>
        )}

        {/* ⑧ 난이도별 분석 */}
        {!noData && diffMap.size > 0 && (
          <section
            className="report-section rounded-xl border p-6"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <SectionTitle>난이도별 정답률 분석</SectionTitle>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table style={{ minWidth: 700, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['난이도 구간', '문항 수', '전체 답안 수', '정답 수', '정답률', '찍음 비율', '평가'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diffMapSorted.map(([key, s], i) => {
                      const qCount = questions.filter((q) => difficultyGroup(q.difficulty) === key).length;
                      const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
                      const guessRate = s.total > 0 ? (s.guessed / s.total) * 100 : 0;
                      return (
                        <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={tdStyle(i)}>
                            <span className="font-semibold" style={{ color: 'var(--fg-main)' }}>{key}</span>
                          </td>
                          <td style={{ ...tdStyle(i), textAlign: 'center' }}>{qCount}</td>
                          <td style={{ ...tdStyle(i), textAlign: 'center' }}>{s.total}</td>
                          <td style={{ ...tdStyle(i), textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{s.correct}</td>
                          <td style={{ ...tdStyle(i), minWidth: 120 }}><RateBar rate={rate} small /></td>
                          <td style={{ ...tdStyle(i), textAlign: 'center' }}>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: guessRate >= 25 ? '#ea580c' : 'var(--fg-sub)' }}
                            >
                              {guessRate.toFixed(1)}%
                            </span>
                          </td>
                          <td style={tdStyle(i)}><EvalBadge rate={rate} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ⑨ 반 전체 자동 코멘트 */}
        {comment && (
          <section
            className="report-section rounded-xl border p-6"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <SectionTitle>반 전체 학습 코멘트</SectionTitle>
            <div
              className="rounded-xl px-6 py-5"
              style={{ background: 'var(--accent-lt)', border: '1px solid #fed7aa' }}
            >
              <p className="text-sm leading-relaxed" style={{ color: '#7c2d12' }}>
                {comment}
              </p>
            </div>
          </section>
        )}

      </div>

      {/* ── 하단 버튼 ── */}
      <div className="mt-6 flex gap-3 no-print">
        <Link href={`/classes/${classId}/answers`}>
          <Button variant="outline"><ArrowLeft size={15} /> 답안 입력으로 돌아가기</Button>
        </Link>
        <Link href={`/classes/${classId}/students`}>
          <Button variant="outline"><Users size={15} /> 학생 등록으로 돌아가기</Button>
        </Link>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl px-5 py-8 text-center"
      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{text}</p>
    </div>
  );
}

function UnitTable({ label, entries }: { label: string; entries: [string, { total: number; correct: number }][] }) {
  const thS: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: 'var(--fg-muted)', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)', background: 'var(--bg-base)',
  };
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--fg-muted)' }}>{label}</p>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['단원명', '전체 답안 수', '정답 수', '정답률', '평가'].map((h) => (
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, s], i) => {
              const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
              const tdS: React.CSSProperties = {
                padding: '8px 12px', fontSize: 13, color: 'var(--fg-main)',
                borderTop: '1px solid var(--border)',
                background: i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9',
              };
              return (
                <tr key={name}>
                  <td style={tdS}>{name}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}>{s.total}</td>
                  <td style={{ ...tdS, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{s.correct}</td>
                  <td style={{ ...tdS, minWidth: 140 }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: 'var(--border)' }}>
                        <div style={{ height: '100%', width: `${rate}%`, background: rate >= 80 ? '#22c55e' : rate >= 60 ? '#eab308' : rate >= 40 ? '#f97316' : '#ef4444', borderRadius: 9999 }} />
                      </div>
                      <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--fg-main)', minWidth: 38, textAlign: 'right' }}>{rate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={tdS}><EvalBadge rate={rate} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TableRow { name: string; total: number; answers: number; correct: number; rate: number }
function ClassAnalysisTable({ headers, rows }: { headers: string[]; rows: TableRow[] }) {
  const thS: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: 'var(--fg-muted)', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)', background: 'var(--bg-base)',
  };
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{headers.map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tdS: React.CSSProperties = {
              padding: '8px 12px', fontSize: 13, color: 'var(--fg-main)',
              borderTop: '1px solid var(--border)',
              background: i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9',
            };
            return (
              <tr key={r.name}>
                <td style={tdS}><span className="font-medium">{r.name}</span></td>
                <td style={{ ...tdS, textAlign: 'center' }}>{r.total}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{r.answers}</td>
                <td style={{ ...tdS, textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{r.correct}</td>
                <td style={{ ...tdS, minWidth: 140 }}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: 'var(--border)' }}>
                      <div style={{ height: '100%', width: `${r.rate}%`, background: r.rate >= 80 ? '#22c55e' : r.rate >= 60 ? '#eab308' : r.rate >= 40 ? '#f97316' : '#ef4444', borderRadius: 9999 }} />
                    </div>
                    <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--fg-main)', minWidth: 38, textAlign: 'right' }}>{r.rate.toFixed(1)}%</span>
                  </div>
                </td>
                <td style={tdS}><EvalBadge rate={r.rate} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, AlertCircle, Loader2, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, FileBarChart, Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
type StudentRow = {
  id: number;
  student_name: string;
  student_code: string | null;
  class_id: number;
};

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

type QuestionRow = {
  id: number;
  question_number: number;
  answer: string | null;
  score: number;
  difficulty: number | null;
  major_unit_name: string | null;
  middle_unit_name: string | null;
  small_unit_name: string | null;
};

type AnswerRow = {
  question_id: number;
  selected_answer: string | null;
  is_guessed: boolean;
  is_blank: boolean;
  is_correct: boolean;
  earned_score: number;
};

type QA = QuestionRow & { ans: AnswerRow | null };

// ─────────────────────────────────────────────
// 유틸 함수
// ─────────────────────────────────────────────
function evalLabel(rate: number): { text: string; color: string; bg: string } {
  if (rate >= 80) return { text: '안정',      color: '#15803d', bg: '#f0fdf4' };
  if (rate >= 60) return { text: '보통',      color: '#ca8a04', bg: '#fefce8' };
  if (rate >= 40) return { text: '보완 필요', color: '#ea580c', bg: '#fff7ed' };
  return              { text: '집중 보완', color: '#dc2626', bg: '#fef2f2' };
}

function difficultyLabel(d: number | null): string {
  if (d === null) return '–';
  if (d <= 2) return `${d} (기본 확인)`;
  if (d <= 4) return `${d} (기본 적용)`;
  if (d <= 6) return `${d} (중상 난도)`;
  return `${d} (고난도/킬러)`;
}

function difficultyGroup(d: number | null): string {
  if (d === null) return '미설정';
  if (d <= 2) return '기본 확인 (1~2)';
  if (d <= 4) return '기본 적용 (3~4)';
  if (d <= 6) return '중상 난도 (5~6)';
  return '고난도/킬러 (7~8)';
}

interface GroupStat { name: string; total: number; correct: number }

function groupStats(items: QA[], keyFn: (qa: QA) => string): GroupStat[] {
  const map = new Map<string, GroupStat>();
  items.forEach((qa) => {
    const key = keyFn(qa);
    if (!map.has(key)) map.set(key, { name: key, total: 0, correct: 0 });
    const s = map.get(key)!;
    s.total++;
    if (qa.ans?.is_correct) s.correct++;
  });
  return [...map.values()];
}

function generateComment(qaRows: QA[], totalScore: number, totalPossible: number): string {
  const parts: string[] = [];
  const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const answered = qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length;
  const guessedCount = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessRate = answered > 0 ? (guessedCount / answered) * 100 : 0;

  // 점수 기반
  if (scoreRate >= 90) {
    parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  } else if (scoreRate >= 70) {
    parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  } else if (scoreRate >= 50) {
    parts.push('개념 이해와 문제 적용 훈련이 함께 필요합니다.');
  } else {
    parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');
  }

  // 찍음 비율
  if (guessRate < 10) {
    parts.push('풀이 확신도가 비교적 안정적입니다.');
  } else if (guessRate < 25) {
    parts.push('일부 문항에서 확신 부족이 나타났습니다.');
  } else if (guessRate < 40) {
    parts.push('중상 난도 문항에서 접근 불안정성이 보입니다.');
  } else {
    parts.push('문제 접근력과 시간 관리 훈련이 필요합니다.');
  }

  // 찍어서 맞은 비율
  if (guessedCount > 0 && guessedCorrect / guessedCount > 0.5) {
    parts.push('맞힌 문항도 풀이 과정을 점검할 필요가 있습니다.');
  }

  // 후반 미응답
  const lastQ = qaRows.slice(Math.floor(qaRows.length * 0.75));
  const blankAtEnd = lastQ.filter((qa) => qa.ans?.is_blank || !qa.ans?.selected_answer).length;
  if (blankAtEnd >= 2) {
    parts.push('시간 배분 훈련과 변별 문항 접근 전략이 필요합니다.');
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 섹션 타이틀
// ─────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-1 h-5 rounded-full"
        style={{ background: 'var(--accent)' }}
      />
      <h2 className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
        {children}
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 분석 테이블
// ─────────────────────────────────────────────
function AnalysisTable({ stats }: { stats: GroupStat[] }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bg-base)' }}>
          <tr>
            {['단원명 / 유형명', '문항 수', '정답 수', '정답률', '평가'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-semibold"
                style={{
                  color: 'var(--fg-muted)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
            const ev = evalLabel(rate);
            return (
              <tr
                key={s.name}
                style={{
                  background: i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <td
                  className="px-4 py-2.5 text-sm font-medium"
                  style={{ color: 'var(--fg-main)' }}
                >
                  {s.name}
                </td>
                <td
                  className="px-4 py-2.5 text-sm text-center"
                  style={{ color: 'var(--fg-sub)' }}
                >
                  {s.total}
                </td>
                <td
                  className="px-4 py-2.5 text-sm text-center font-semibold"
                  style={{ color: '#16a34a' }}
                >
                  {s.correct}
                </td>
                <td className="px-4 py-2.5 text-sm text-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 6, background: 'var(--border)' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${rate}%`,
                          background: rate >= 80 ? '#22c55e' : rate >= 60 ? '#eab308' : rate >= 40 ? '#f97316' : '#ef4444',
                          borderRadius: 9999,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span
                      className="font-semibold text-xs w-10 shrink-0 text-right"
                      style={{ color: 'var(--fg-main)' }}
                    >
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: ev.bg, color: ev.color }}
                  >
                    {ev.text}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function StudentReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId: studentIdStr } = use(params);
  const studentId = Number(studentIdStr);

  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [cls, setCls]         = useState<ClassRow | null>(null);
  const [test, setTest]       = useState<TestRow | null>(null);
  const [qaRows, setQaRows]   = useState<QA[]>([]);

  // ── 데이터 로드
  useEffect(() => {
    if (isNaN(studentId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      // 1. 학생
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('id, student_name, student_code, class_id')
        .eq('id', studentId)
        .single();

      if (studentErr || !studentData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setStudent(studentData);

      // 2. 반
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name, test_id')
        .eq('id', studentData.class_id)
        .single();

      if (classErr || !classData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCls(classData);

      // 3. 테스트 (과목 포함)
      const { data: testRaw, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, subjects(name)')
        .eq('id', classData.test_id)
        .single();

      if (testErr || !testRaw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const subjectsRaw = testRaw.subjects as unknown as { name: string } | { name: string }[] | null;
      const subjectName = Array.isArray(subjectsRaw)
        ? (subjectsRaw[0]?.name ?? null)
        : (subjectsRaw?.name ?? null);
      setTest({
        id:           testRaw.id,
        title:        testRaw.title,
        grade:        testRaw.grade,
        subject_name: subjectName,
      });

      // 4. 문항 (단원 조인)
      const { data: questionsRaw } = await supabase
        .from('questions')
        .select(`
          id, question_number, answer, score,
          difficulty,
          units_major:major_unit_id(name),
          units_middle:middle_unit_id(name),
          units_small:small_unit_id(name)
        `)
        .eq('test_id', classData.test_id)
        .order('question_number');

      type UnitRaw = { name: string } | { name: string }[] | null;
      function pickName(raw: unknown): string | null {
        const u = raw as UnitRaw;
        if (!u) return null;
        if (Array.isArray(u)) return u[0]?.name ?? null;
        return u.name ?? null;
      }

      const questions: QuestionRow[] = (questionsRaw ?? []).map((q) => {
        return {
          id:               q.id,
          question_number:  q.question_number,
          answer:           q.answer,
          score:            Number(q.score),
          difficulty:       q.difficulty,
          major_unit_name:  pickName(q.units_major),
          middle_unit_name: pickName(q.units_middle),
          small_unit_name:  pickName(q.units_small),
        };
      });

      if (questions.length === 0) {
        setQaRows([]);
        setLoading(false);
        return;
      }

      // 5. 학생 답안
      const questionIds = questions.map((q) => q.id);
      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .eq('student_id', studentId)
        .in('question_id', questionIds);

      const answerMap = new Map<number, AnswerRow>();
      (answersRaw ?? []).forEach((a) => {
        answerMap.set(a.question_id, {
          question_id:     a.question_id,
          selected_answer: a.selected_answer,
          is_guessed:      a.is_guessed,
          is_blank:        a.is_blank,
          is_correct:      a.is_correct,
          earned_score:    Number(a.earned_score),
        });
      });

      const combined: QA[] = questions.map((q) => ({
        ...q,
        ans: answerMap.get(q.id) ?? null,
      }));

      setQaRows(combined);
      setLoading(false);
    }

    load();
  }, [studentId]);

  // ── 집계 계산
  const totalPossible = qaRows.reduce((s, qa) => s + qa.score, 0);
  const totalScore    = qaRows.reduce((s, qa) => s + (qa.ans?.earned_score ?? 0), 0);
  const correctCount  = qaRows.filter((qa) => qa.ans?.is_correct).length;
  const wrongCount    = qaRows.filter((qa) => qa.ans && !qa.ans.is_correct && !qa.ans.is_blank && qa.ans.selected_answer).length;
  const blankCount    = qaRows.filter((qa) => !qa.ans || qa.ans.is_blank || !qa.ans.selected_answer).length;
  const guessedCount  = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessedWrong  = qaRows.filter((qa) => qa.ans?.is_guessed && !qa.ans?.is_correct).length;
  const answeredCount = qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length;
  const scoreRate     = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const guessRate     = answeredCount > 0 ? (guessedCount / answeredCount) * 100 : 0;

  // 단원별 성취도 (대단원)
  const majorStats = groupStats(qaRows, (qa) => qa.major_unit_name || '미분류');
  // 중단원별
  const middleStats = groupStats(qaRows, (qa) =>
    qa.middle_unit_name ? `${qa.major_unit_name ?? ''} > ${qa.middle_unit_name}` : '미분류'
  );
  // 난이도별
  const diffStats = groupStats(qaRows, (qa) => difficultyGroup(qa.difficulty));
  const DIFF_ORDER = ['기본 확인 (1~2)', '기본 적용 (3~4)', '중상 난도 (5~6)', '고난도/킬러 (7~8)', '미설정'];
  const diffStatsSorted = [...diffStats].sort(
    (a, b) => DIFF_ORDER.indexOf(a.name) - DIFF_ORDER.indexOf(b.name)
  );

  // 자동 코멘트
  const comment = qaRows.length > 0
    ? generateComment(qaRows, totalScore, totalPossible)
    : '';

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

  if (notFound || !student || !cls || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>
          학생 정보를 찾을 수 없습니다.
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
          존재하지 않거나 삭제된 학생입니다.
        </p>
        <Link href="/tests">
          <Button variant="outline" size="sm">테스트 목록으로</Button>
        </Link>
      </div>
    );
  }

  const infoItems = [
    { label: '학생명',   value: student.student_name },
    { label: '학생 코드', value: student.student_code || '–' },
    { label: '테스트명', value: test.title },
    { label: '학년',     value: test.grade || '–' },
    { label: '과목',     value: test.subject_name || '–' },
    { label: '강사명',   value: cls.teacher_name || '–' },
    { label: '학원명',   value: cls.academy_name || '–' },
    { label: '반명',     value: cls.class_name || '–' },
  ];

  const summaryCards = [
    { label: '총점',           value: `${totalScore}점`,        accent: true  },
    { label: '총 배점',         value: `${totalPossible}점`,     accent: false },
    { label: '정답 수',         value: `${correctCount}개`,      accent: false },
    { label: '오답 수',         value: `${wrongCount}개`,        accent: false },
    { label: '미응답 수',       value: `${blankCount}개`,        accent: false },
    { label: '찍은 문항',       value: `${guessedCount}개`,      accent: false },
    { label: '찍어서 맞음',     value: `${guessedCorrect}개`,    accent: false },
    { label: '찍어서 틀림',     value: `${guessedWrong}개`,      accent: false },
    { label: '정답률',          value: `${scoreRate.toFixed(1)}%`, accent: true },
    { label: '찍음 비율',       value: `${guessRate.toFixed(1)}%`, accent: false },
  ];

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="report-wrap" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── 페이지 헤더 (네비게이션) ── */}
      <div className="flex items-start justify-between mb-5 no-print">
        <div className="flex items-start gap-3">
          <Link href={`/classes/${cls.id}/answers`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} /> 답안 입력으로 돌아가기
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{test.title}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{cls.class_name || '반'}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
              {student.student_name}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              학생별 분석표
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/classes/${cls.id}/analysis`}>
            <Button variant="outline" size="sm">
              <BarChart3 size={14} /> 반 전체 분석 보기
            </Button>
          </Link>
          <Button variant="accent" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> 인쇄 / PDF 저장
          </Button>
        </div>
      </div>

      {/* 인쇄 안내 (화면에서만 표시) */}
      <div
        className="no-print rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-xs"
        style={{ background: 'var(--accent-lt)', border: '1px solid #fed7aa', color: '#7c2d12' }}
      >
        <Printer size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        인쇄 창에서 대상 프린터를 <strong>&apos;PDF로 저장&apos;</strong>으로 선택하면 PDF 파일로 저장할 수 있습니다.
        배경 그래픽 옵션을 켜면 색상이 더 잘 출력됩니다.
      </div>

      {/* ── 리포트 본문 ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >

        {/* ── 리포트 헤더 ── */}
        <div
          className="px-8 py-6"
          style={{
            background: 'var(--sidebar-bg)',
            color: '#fff',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileBarChart size={18} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold tracking-widest uppercase opacity-70">
                  봉샘스쿨
                </span>
              </div>
              <h1 className="text-xl font-bold mb-1">학생별 학습 진단 리포트</h1>
              <p className="text-sm opacity-60">{test.title}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                {student.student_name}
              </p>
              {student.student_code && (
                <p className="text-sm font-mono opacity-60 mt-0.5">{student.student_code}</p>
              )}
            </div>
          </div>

          {/* 학생 기본 정보 그리드 */}
          <div
            className="mt-5 grid gap-x-6 gap-y-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-xs opacity-50 shrink-0">{item.label}</span>
                <span className="text-sm font-medium truncate opacity-90">{item.value}</span>
              </div>
            ))}
          </div>

          {/* 생성일 — 인쇄 시만 표시 */}
          <p className="print-only mt-3 text-xs opacity-50">생성일: {today}</p>
        </div>

        {/* ── 본문 콘텐츠 ── */}
        <div className="px-8 py-6 space-y-8">

          {/* ① 종합 결과 카드 */}
          <section className="report-section">
            <SectionTitle>종합 결과</SectionTitle>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            >
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: card.accent ? 'var(--accent)' : 'var(--bg-base)',
                    border: `1px solid ${card.accent ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <p
                    className="text-xs font-medium mb-1.5"
                    style={{ color: card.accent ? 'rgba(255,255,255,0.8)' : 'var(--fg-muted)' }}
                  >
                    {card.label}
                  </p>
                  <p
                    className="text-xl font-bold"
                    style={{ color: card.accent ? '#fff' : 'var(--fg-main)' }}
                  >
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ② 단원별 성취도 */}
          <section className="report-section">
            <SectionTitle>단원별 성취도</SectionTitle>
            {majorStats.length === 0 ? (
              <EmptyState text="문항에 단원 정보가 입력되지 않았습니다." />
            ) : (
              <div className="space-y-3">
                <AnalysisTable
                  stats={majorStats.map((s) => ({ ...s, name: `▶ ${s.name}` }))}
                />
                {middleStats.filter((s) => !s.name.includes('미분류') || majorStats.length > 1).length > 0 && (
                  <AnalysisTable stats={middleStats} />
                )}
              </div>
            )}
          </section>

          {/* ③ 난이도별 성취도 */}
          <section className="report-section">
            <SectionTitle>난이도별 성취도</SectionTitle>
            {diffStatsSorted.length === 0 ? (
              <EmptyState text="문항에 난이도 정보가 입력되지 않았습니다." />
            ) : (
              <AnalysisTable stats={diffStatsSorted} />
            )}
          </section>

          {/* ⑤ 문항별 결과표 */}
          <section className="report-section page-break-before">
            <SectionTitle>문항별 결과</SectionTitle>
            <QuestionTable qaRows={qaRows} />
          </section>

          {/* ⑥ 자동 코멘트 */}
          {comment && (
            <section className="report-section">
              <SectionTitle>종합 학습 코멘트</SectionTitle>
              <div
                className="rounded-xl px-6 py-5"
                style={{
                  background: 'var(--accent-lt)',
                  border: '1px solid #fed7aa',
                }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: '#7c2d12' }}
                >
                  {comment}
                </p>
              </div>
            </section>
          )}

        </div>

        {/* ── 리포트 하단 */}
        <div
          className="px-8 py-4 flex items-center justify-between"
          style={{
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            봉샘스쿨 학습 진단 리포트 · {student.student_name} · {test.title}
          </p>
          <div className="flex gap-2 no-print">
            <Link href={`/classes/${cls.id}/answers`}>
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} /> 답안 입력
              </Button>
            </Link>
            <Link href={`/classes/${cls.id}/analysis`}>
              <Button variant="accent" size="sm">
                <BarChart3 size={14} /> 반 전체 분석
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 빈 상태
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

// ─────────────────────────────────────────────
// 서브 컴포넌트: 문항별 결과표
// ─────────────────────────────────────────────
function QuestionTable({ qaRows }: { qaRows: QA[] }) {
  if (qaRows.length === 0) {
    return <EmptyState text="문항 정보가 없습니다." />;
  }

  const cols = [
    { label: '번호',      w: 52 },
    { label: '정답',      w: 60 },
    { label: '학생 답',   w: 72 },
    { label: '결과',      w: 56 },
    { label: '획득 점수', w: 72 },
    { label: '찍음',      w: 52 },
    { label: '미응답',    w: 60 },
    { label: '대단원',    w: 100 },
    { label: '중단원',    w: 100 },
    { label: '소단원',    w: 100 },
    { label: '난이도',    w: 80 },
  ];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="overflow-x-auto">
        <table style={{ minWidth: 900, borderCollapse: 'collapse', width: '100%' }}>
          <thead style={{ background: 'var(--bg-base)' }}>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.label}
                  className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap"
                  style={{
                    color: 'var(--fg-muted)',
                    width: col.w,
                    minWidth: col.w,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {qaRows.map((qa, i) => {
              const ans = qa.ans;
              const hasAnswer = ans && !ans.is_blank && ans.selected_answer;
              const rowBg = i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9';

              return (
                <tr
                  key={qa.id}
                  style={{ background: rowBg, borderTop: '1px solid var(--border)' }}
                >
                  {/* 번호 */}
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                    >
                      {qa.question_number}
                    </span>
                  </td>

                  {/* 정답 */}
                  <td
                    className="px-3 py-2 text-center text-sm font-semibold"
                    style={{ color: 'var(--fg-main)' }}
                  >
                    {qa.answer ?? '–'}
                  </td>

                  {/* 학생 답 */}
                  <td
                    className="px-3 py-2 text-center text-sm"
                    style={{
                      color: hasAnswer
                        ? ans.is_correct ? '#16a34a' : '#dc2626'
                        : 'var(--fg-muted)',
                      fontWeight: hasAnswer ? 600 : 400,
                    }}
                  >
                    {ans?.is_blank ? '미응답' : (ans?.selected_answer ?? '–')}
                  </td>

                  {/* 결과 */}
                  <td className="px-3 py-2 text-center">
                    {!ans || (!ans.is_blank && !ans.selected_answer) ? (
                      <MinusCircle size={15} className="mx-auto" style={{ color: 'var(--fg-muted)' }} />
                    ) : ans.is_blank ? (
                      <MinusCircle size={15} className="mx-auto" style={{ color: '#94a3b8' }} />
                    ) : ans.is_correct ? (
                      <CheckCircle2 size={15} className="mx-auto" style={{ color: '#16a34a' }} />
                    ) : (
                      <XCircle size={15} className="mx-auto" style={{ color: '#dc2626' }} />
                    )}
                  </td>

                  {/* 획득 점수 */}
                  <td
                    className="px-3 py-2 text-center text-sm font-semibold"
                    style={{
                      color: hasAnswer && ans.is_correct ? '#16a34a' : 'var(--fg-muted)',
                    }}
                  >
                    {ans ? `${ans.earned_score}점` : '–'}
                  </td>

                  {/* 찍음 */}
                  <td className="px-3 py-2 text-center">
                    {ans?.is_guessed ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ background: '#fff7ed', color: '#ea580c' }}
                      >
                        찍음
                      </span>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>–</span>
                    )}
                  </td>

                  {/* 미응답 */}
                  <td className="px-3 py-2 text-center">
                    {ans?.is_blank ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        미응답
                      </span>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>–</span>
                    )}
                  </td>

                  {/* 대단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.major_unit_name ?? '–'}
                  </td>

                  {/* 중단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.middle_unit_name ?? '–'}
                  </td>

                  {/* 소단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.small_unit_name ?? '–'}
                  </td>

                  {/* 난이도 */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--fg-sub)' }}>
                    {difficultyLabel(qa.difficulty)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

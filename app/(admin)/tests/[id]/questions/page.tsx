'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import { formatScoreValue, getSubjectDisplayName } from '@/lib/report-utils';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  total_questions: number;
};

type Subject = { id: number; name: string };
type MajorUnit  = { id: number; name: string; subject_id: number };
type MiddleUnit = { id: number; name: string; major_unit_id: number };
type SmallUnit  = { id: number; name: string; middle_unit_id: number };

type QuestionForm = {
  question_number: number;
  question_format: 'objective' | 'subjective';
  answer: string;
  score: string;
  subject_id: number | null;
  major_unit_id: number | null;
  middle_unit_id: number | null;
  small_unit_id: number | null;
  difficulty: number | null;
  question_comment: string;
};

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const DIFFICULTY_LABELS: Record<number, string> = {
  1: '1 — 기본확인',
  2: '2 — 기본확인',
  3: '3 — 기본적용',
  4: '4 — 기본적용',
  5: '5 — 중상변별',
  6: '6 — 중상변별',
  7: '7 — 고난도',
  8: '8 — 고난도',
};

function parseScore(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const score = Number(trimmed);
  return Number.isFinite(score) && score > 0 ? score : null;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatScoreFixed(value: number): string {
  return value.toFixed(2);
}

function buildScorePlan(questions: QuestionForm[]): {
  resolvedScores: number[];
  autoScores: (number | null)[];
  explicitTotal: number;
  resolvedTotal: number;
  blankCount: number;
  invalidCount: number;
  canAutoAllocate: boolean;
} {
  const parsed = questions.map((q) => parseScore(q.score));
  const invalidCount = questions.filter((q, index) => q.score.trim() !== '' && parsed[index] === null).length;
  const blankIndexes = parsed
    .map((score, index) => (score === null && questions[index].score.trim() === '' ? index : -1))
    .filter((index) => index >= 0);
  const explicitTotal = parsed.reduce<number>((sum, score) => sum + (score ?? 0), 0);
  const remaining = 100 - explicitTotal;
  const canAutoAllocate = blankIndexes.length === 0 || remaining > 0;
  const resolvedScores = parsed.map((score) => score ?? 0);
  const autoScores: (number | null)[] = questions.map(() => null);

  if (blankIndexes.length > 0 && canAutoAllocate) {
    const remainingCents = Math.round(remaining * 100);
    const baseCents = Math.floor(remainingCents / blankIndexes.length);
    const extraCents = remainingCents - baseCents * blankIndexes.length;
    blankIndexes.forEach((questionIndex, order) => {
      const value = (baseCents + (order < extraCents ? 1 : 0)) / 100;
      resolvedScores[questionIndex] = value;
      autoScores[questionIndex] = value;
    });
  }

  return {
    resolvedScores,
    autoScores,
    explicitTotal: roundScore(explicitTotal),
    resolvedTotal: roundScore(resolvedScores.reduce((sum, score) => sum + score, 0)),
    blankCount: blankIndexes.length,
    invalidCount,
    canAutoAllocate,
  };
}

function makeDefaultQuestion(num: number): QuestionForm {
  return {
    question_number: num,
    question_format: 'objective',
    answer: '',
    score: '',
    subject_id: null,
    major_unit_id: null,
    middle_unit_id: null,
    small_unit_id: null,
    difficulty: null,
    question_comment: '',
  };
}

// ─────────────────────────────────────────────
// 셀 공통 스타일
// ─────────────────────────────────────────────
const cellInput =
  'w-full px-2 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white';
const cellBorder = { borderColor: 'var(--border)' };

// ─────────────────────────────────────────────
// 행 컴포넌트 (React.memo로 불필요한 리렌더 방지)
// ─────────────────────────────────────────────
type RowProps = {
  q: QuestionForm;
  idx: number;
  autoScore: number | null;
  subjects: Subject[];
  majorUnits: MajorUnit[];
  allMiddles: MiddleUnit[];
  allSmalls: SmallUnit[];
  onChange: (idx: number, patch: Partial<QuestionForm>) => void;
};

const QuestionRow = React.memo(function QuestionRow({
  q, idx, autoScore, subjects, majorUnits, allMiddles, allSmalls, onChange,
}: RowProps) {
  const filteredMajors = q.subject_id
    ? majorUnits.filter(m => m.subject_id === q.subject_id)
    : [];
  const filteredMiddles = allMiddles.filter(m => m.major_unit_id === q.major_unit_id);
  const filteredSmalls  = allSmalls.filter(s => s.middle_unit_id === q.middle_unit_id);

  const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafaf9';

  return (
    <tr style={{ background: rowBg, borderTop: '1px solid var(--border)' }}>
      {/* 번호 */}
      <td className="px-3 py-2 text-center">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
          style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
        >
          {q.question_number}
        </span>
      </td>

      {/* 정답 */}
      <td className="px-2 py-2">
        <select
          className={cellInput}
          style={{ ...cellBorder, width: 96 }}
          value={q.question_format}
          onChange={e => onChange(idx, { question_format: e.target.value as QuestionForm['question_format'] })}
        >
          <option value="objective">객관식</option>
          <option value="subjective">주관식</option>
        </select>
      </td>

      {/* 정답 */}
      <td className="px-2 py-2">
        <input
          className={cellInput}
          style={{ ...cellBorder, width: q.question_format === 'objective' ? 72 : 160 }}
          placeholder={q.question_format === 'objective' ? '1~5' : '예: x=2, 3/2'}
          value={q.answer}
          onChange={e => onChange(idx, { answer: e.target.value })}
        />
      </td>

      {/* 배점 */}
      <td className="px-2 py-2">
        <input
          type="number"
          min="0.1"
          step="0.01"
          max="100"
          className={cellInput}
          style={{ ...cellBorder, width: 72 }}
          value={q.score}
          placeholder={autoScore === null ? '배점' : `자동 ${formatScoreValue(autoScore)}점`}
          onChange={e => onChange(idx, { score: e.target.value })}
        />
      </td>

      {/* 과목 */}
      <td className="px-2 py-2">
        {subjects.length === 0 ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>데이터 없음</span>
        ) : (
          <select
            className={cellInput}
            style={{ ...cellBorder, width: 132 }}
            value={q.subject_id ?? ''}
            onChange={e =>
              onChange(idx, {
                subject_id: e.target.value ? Number(e.target.value) : null,
                major_unit_id: null,
                middle_unit_id: null,
                small_unit_id: null,
              })
            }
          >
            <option value="">선택 안함</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{getSubjectDisplayName(s.name) ?? s.name}</option>
            ))}
          </select>
        )}
      </td>

      {/* 대단원 */}
      <td className="px-2 py-2">
        {!q.subject_id ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>과목 먼저 선택</span>
        ) : filteredMajors.length === 0 ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>데이터 없음</span>
        ) : (
          <select
            className={cellInput}
            style={{ ...cellBorder, width: 136 }}
            value={q.major_unit_id ?? ''}
            onChange={e =>
              onChange(idx, {
                major_unit_id: e.target.value ? Number(e.target.value) : null,
                middle_unit_id: null,
                small_unit_id: null,
              })
            }
          >
            <option value="">선택 안함</option>
            {filteredMajors.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </td>

      {/* 중단원 */}
      <td className="px-2 py-2">
        {!q.major_unit_id ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>대단원 먼저 선택</span>
        ) : filteredMiddles.length === 0 ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>데이터 없음</span>
        ) : (
          <select
            className={cellInput}
            style={{ ...cellBorder, width: 136 }}
            value={q.middle_unit_id ?? ''}
            onChange={e =>
              onChange(idx, {
                middle_unit_id: e.target.value ? Number(e.target.value) : null,
                small_unit_id: null,
              })
            }
          >
            <option value="">선택 안함</option>
            {filteredMiddles.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </td>

      {/* 소단원 */}
      <td className="px-2 py-2">
        {!q.middle_unit_id ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>중단원 먼저 선택</span>
        ) : filteredSmalls.length === 0 ? (
          <span className="text-xs px-2" style={{ color: 'var(--fg-muted)' }}>데이터 없음</span>
        ) : (
          <select
            className={cellInput}
            style={{ ...cellBorder, width: 136 }}
            value={q.small_unit_id ?? ''}
            onChange={e =>
              onChange(idx, { small_unit_id: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">선택 안함</option>
            {filteredSmalls.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </td>

      {/* 난이도 */}
      <td className="px-2 py-2">
        <select
          className={cellInput}
          style={{ ...cellBorder, width: 116 }}
          value={q.difficulty ?? ''}
          onChange={e =>
            onChange(idx, { difficulty: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">선택 안함</option>
          {Object.entries(DIFFICULTY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </td>

      {/* 문항 특징 코멘트 */}
      <td className="px-2 py-2">
        <textarea
          className={`${cellInput} resize-none`}
          style={{ ...cellBorder, width: 180, minHeight: 42 }}
          placeholder="예: 조건 해석이 핵심인 문항 / 계산 실수 주의 / 중상 난도 변별 문항"
          value={q.question_comment}
          onChange={e => onChange(idx, { question_comment: e.target.value })}
        />
      </td>
    </tr>
  );
});

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function QuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: testIdStr } = use(params);
  const testId = Number(testIdStr);
  const router = useRouter();

  const [test, setTest]           = useState<TestRow | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [majorUnits, setMajorUnits] = useState<MajorUnit[]>([]);
  const [allMiddles, setAllMiddles] = useState<MiddleUnit[]>([]);
  const [allSmalls, setAllSmalls]   = useState<SmallUnit[]>([]);
  const [questions, setQuestions]   = useState<QuestionForm[]>([]);

  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 데이터 로드
  useEffect(() => {
    if (isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      // 1. 테스트 정보
      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, total_questions')
        .eq('id', testId)
        .single();

      if (testErr || !testData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTest(testData);

      // 2. 과목/단원 데이터 전체 로드
      const [subjectsRes, majorsRes, middlesRes, smallsRes] = await Promise.all([
        supabase.from('subjects').select('id, name').order('id'),
        supabase.from('units_major').select('id, name, subject_id').order('id'),
        supabase.from('units_middle').select('id, name, major_unit_id').order('id'),
        supabase.from('units_small').select('id, name, middle_unit_id').order('id'),
      ]);

      setSubjects(subjectsRes.data ?? []);
      setMajorUnits(majorsRes.data ?? []);
      setAllMiddles(middlesRes.data ?? []);
      setAllSmalls(smallsRes.data ?? []);

      // 3. 기존 questions 데이터
      const { data: existingQs } = await supabase
        .from('questions')
        .select(
          'question_number, question_format, answer, score, subject_id, major_unit_id, middle_unit_id, small_unit_id, difficulty, question_comment'
        )
        .eq('test_id', testId)
        .order('question_number');

      if (existingQs && existingQs.length > 0) {
        setQuestions(
          existingQs.map(q => ({
            question_number: q.question_number,
            question_format: (q.question_format === 'subjective' ? 'subjective' : 'objective') as QuestionForm['question_format'],
            answer:          q.answer ?? '',
            score:           q.score === null || q.score === undefined ? '' : String(Number(q.score)),
            subject_id:      q.subject_id ?? null,
            major_unit_id:   q.major_unit_id ?? null,
            middle_unit_id:  q.middle_unit_id ?? null,
            small_unit_id:   q.small_unit_id ?? null,
            difficulty:      q.difficulty ?? null,
            question_comment: q.question_comment ?? '',
          }))
        );
      } else {
        setQuestions(
          Array.from({ length: testData.total_questions }, (_, i) =>
            makeDefaultQuestion(i + 1)
          )
        );
      }

      setLoading(false);
    }

    load();
  }, [testId]);

  // ── 문항 업데이트 (상위 단원 변경 시 하위 초기화 포함)
  const updateQuestion = useCallback(
    (idx: number, patch: Partial<QuestionForm>) => {
      setQuestions(qs =>
        qs.map((q, i) => {
          if (i !== idx) return q;
          const updated = { ...q, ...patch };
          if ('subject_id' in patch) {
            updated.major_unit_id = null;
            updated.middle_unit_id = null;
            updated.small_unit_id = null;
          }
          if ('major_unit_id' in patch) {
            updated.middle_unit_id = null;
            updated.small_unit_id  = null;
          }
          if ('middle_unit_id' in patch) {
            updated.small_unit_id = null;
          }
          return updated;
        })
      );
    },
    []
  );

  // ── 저장 (DELETE → INSERT 방식)
  const handleSave = async () => {
    setSaveError(null);

    const allEmpty = questions.every(q => !q.answer.trim());
    if (allEmpty) {
      setSaveError('최소 한 개 이상의 정답을 입력해주세요.');
      return;
    }

    const scorePlan = buildScorePlan(questions);
    if (scorePlan.invalidCount > 0) {
      setSaveError('배점은 0보다 큰 숫자로 입력해주세요. 비워둔 문항은 저장 시 자동 배점됩니다.');
      return;
    }
    if (!scorePlan.canAutoAllocate) {
      setSaveError('직접 입력한 배점 합계가 100점 이상이라 빈 배점 문항에 자동 배점할 점수가 없습니다.');
      return;
    }

    setSaving(true);

    const { error: delErr } = await supabase
      .from('questions')
      .delete()
      .eq('test_id', testId);

    if (delErr) {
      setSaveError(`기존 데이터 삭제 실패: ${delErr.message}`);
      setSaving(false);
      return;
    }

    const rows = questions.map((q, index) => ({
      test_id:         testId,
      question_number: q.question_number,
      question_format: q.question_format,
      answer:          q.answer.trim() || null,
      score:           scorePlan.resolvedScores[index],
      subject_id:      q.subject_id,
      major_unit_id:   q.major_unit_id,
      middle_unit_id:  q.middle_unit_id,
      small_unit_id:   q.small_unit_id,
      difficulty:      q.difficulty,
      question_comment: q.question_comment.trim() || null,
    }));

    const { error: insErr } = await supabase.from('questions').insert(rows);

    if (insErr) {
      setSaveError(`저장 실패: ${insErr.message}`);
      setSaving(false);
      return;
    }

    router.push(`/tests/${testId}/classes/new`);
  };

  const scorePlan = buildScorePlan(questions);
  const totalScore = scorePlan.resolvedTotal;

  // ── 로딩
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  // ── 없음
  if (notFound || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>
          테스트를 찾을 수 없습니다.
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
          존재하지 않거나 삭제된 테스트입니다.
        </p>
        <Link href="/tests">
          <Button variant="outline" size="sm">테스트 목록으로</Button>
        </Link>
      </div>
    );
  }

  const subtitle = test.grade ?? '';

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3">
          <Link href="/tests" className="mt-0.5">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} /> 목록으로
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
                {test.title}
              </span>
              <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                문항 정보 입력
              </span>
            </div>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>
            {questions.length}문항 ·{' '}
            <span className="font-semibold" style={{ color: 'var(--fg-main)' }}>
              예상 합계 {formatScoreFixed(totalScore)}점
            </span>
          </span>
          <Button variant="accent" onClick={handleSave} loading={saving} disabled={saving}>
            <Save size={15} /> 저장 후 반 생성
          </Button>
        </div>
      </div>

      {/* ── 테스트 정보 요약 카드 ── */}
      <div
        className="rounded-xl border px-5 py-3 mb-4 flex flex-wrap items-center gap-x-6 gap-y-1"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {[
          { label: '테스트명', value: test.title },
          { label: '학년',    value: test.grade || '–' },
          { label: '총 문항', value: `${test.total_questions}문항` },
          { label: '배점 합계', value: `${formatScoreFixed(totalScore)}점${scorePlan.blankCount > 0 ? ' (예상)' : ''}` },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
            <span className="font-medium" style={{ color: 'var(--fg-main)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── 단원 데이터 없음 안내 ── */}
      {subjects.length === 0 && (
        <div
          className="px-4 py-3 mb-4 rounded-lg border text-sm"
          style={{ background: '#fefce8', borderColor: '#fde047', color: '#713f12' }}
        >
          과목 데이터가 아직 Supabase에 없습니다. 과목/단원 선택 없이 나머지 항목만 입력할 수 있습니다.
        </div>
      )}

      {/* ── 저장 에러 ── */}
      {saveError && (
        <div
          className="flex items-start gap-2 px-4 py-3 mb-4 rounded-lg border text-sm"
          style={{ background: '#fff5f5', borderColor: '#fca5a5', color: '#dc2626' }}
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {saveError}
        </div>
      )}

      <div
        className="px-4 py-3 mb-4 rounded-lg border text-sm"
        style={{
          background: scorePlan.resolvedTotal === 100 ? '#f0fdf4' : '#fff7ed',
          borderColor: scorePlan.resolvedTotal === 100 ? '#86efac' : '#fdba74',
          color: scorePlan.resolvedTotal === 100 ? '#166534' : '#9a3412',
        }}
      >
        현재 배점 합계: <strong>{formatScoreFixed(totalScore)}점</strong>
        {scorePlan.blankCount > 0 && (
          <span> · 배점 미입력 {scorePlan.blankCount}문항은 저장 시 자동 배점됩니다.</span>
        )}
        {scorePlan.blankCount === 0 && scorePlan.resolvedTotal !== 100 && (
          <span> · 100점이 아닙니다. 입력된 배점을 그대로 저장합니다.</span>
        )}
      </div>

      {/* ── 문항 입력 테이블 ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
            문항별 정보 입력
          </span>
          <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            가로 스크롤로 전체 열을 확인하세요.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table style={{ minWidth: 1220, borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ background: 'var(--bg-base)' }}>
              <tr>
                {[
                  { label: '번호',      w: 56  },
                  { label: '문항 형식', w: 112 },
                  { label: '정답',      w: 88  },
                  { label: '배점',      w: 72  },
                  { label: '과목',      w: 148 },
                  { label: '대단원',    w: 152 },
                  { label: '중단원',    w: 152 },
                  { label: '소단원',    w: 152 },
                  { label: '난이도',    w: 132 },
                  { label: '문항 특징 코멘트', w: 196 },
                ].map(col => (
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
              {questions.map((q, idx) => (
                <QuestionRow
                  key={q.question_number}
                  q={q}
                  idx={idx}
                  autoScore={scorePlan.autoScores[idx]}
                  subjects={subjects}
                  majorUnits={majorUnits}
                  allMiddles={allMiddles}
                  allSmalls={allSmalls}
                  onChange={updateQuestion}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="mt-4 flex justify-end gap-3">
        <Link href="/tests">
          <Button variant="outline" disabled={saving}>취소</Button>
        </Link>
        <Button variant="accent" onClick={handleSave} loading={saving} disabled={saving}>
          <Save size={15} /> 저장 후 다음
        </Button>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, AlertCircle, Loader2, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, BarChart3, FileBarChart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// ─────────────────────────────────────────────
// 타입 정의
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
  school_name: string | null;
  grade: string | null;
  total_questions: number;
};

type QuestionRow = {
  id: number;
  question_number: number;
  answer: string | null;
  score: number;
};

type StudentRow = {
  id: number;
  student_name: string;
  student_code: string | null;
};

type AnswerForm = {
  selected_answer: string;
  is_guessed: boolean;
  is_blank: boolean;
};

type AnswerMap = Record<number, AnswerForm>; // key: question.id

// ─────────────────────────────────────────────
// 상수 및 헬퍼
// ─────────────────────────────────────────────
const CHOICES = ['1', '2', '3', '4', '5'] as const;

function defaultForm(): AnswerForm {
  return { selected_answer: '', is_guessed: false, is_blank: false };
}

function computeResult(form: AnswerForm, correctAnswer: string | null, score: number) {
  if (form.is_blank || !form.selected_answer.trim()) {
    return { is_correct: false, earned_score: 0 };
  }
  const correct =
    form.selected_answer.trim() === (correctAnswer ?? '').trim();
  return { is_correct: correct, earned_score: correct ? score : 0 };
}

type StudentStatus = 'none' | 'partial' | 'complete';

function getStatus(count: number, total: number): StudentStatus {
  if (count === 0) return 'none';
  if (count >= total) return 'complete';
  return 'partial';
}

const STATUS_LABEL: Record<StudentStatus, string> = {
  none: '미입력',
  partial: '일부 입력',
  complete: '입력 완료',
};

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function AnswersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: classIdStr } = use(params);
  const classId = Number(classIdStr);

  // ── 데이터
  const [cls, setCls]           = useState<ClassRow | null>(null);
  const [test, setTest]         = useState<TestRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [students, setStudents]  = useState<StudentRow[]>([]);

  // ── UI 상태
  const [pageLoading, setPageLoading]     = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [answerMap, setAnswerMap]         = useState<AnswerMap>({});
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerCounts, setAnswerCounts]   = useState<Record<number, number>>({});
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess]     = useState(false);

  // ── 학생별 답안 개수 새로고침
  const reloadCounts = useCallback(
    async (studentIds: number[], questionIds: number[]) => {
      if (!studentIds.length || !questionIds.length) return;
      const { data } = await supabase
        .from('student_answers')
        .select('student_id')
        .in('student_id', studentIds)
        .in('question_id', questionIds);

      const counts: Record<number, number> = {};
      studentIds.forEach((id) => { counts[id] = 0; });
      (data ?? []).forEach((row) => {
        counts[row.student_id] = (counts[row.student_id] ?? 0) + 1;
      });
      setAnswerCounts(counts);
    },
    []
  );

  // ── 초기 데이터 로드
  useEffect(() => {
    if (isNaN(classId)) {
      setNotFound(true);
      setPageLoading(false);
      return;
    }

    async function load() {
      // 1. 반 정보
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name, test_id')
        .eq('id', classId)
        .single();

      if (classErr || !classData) {
        setNotFound(true);
        setPageLoading(false);
        return;
      }
      setCls(classData);

      // 2. 테스트 + 학생 (병렬)
      const [testRes, studentsRes] = await Promise.all([
        supabase
          .from('tests')
          .select('id, title, school_name, grade, total_questions')
          .eq('id', classData.test_id)
          .single(),
        supabase
          .from('students')
          .select('id, student_name, student_code')
          .eq('class_id', classId)
          .order('student_code'),
      ]);

      if (!testRes.data) {
        setNotFound(true);
        setPageLoading(false);
        return;
      }
      setTest(testRes.data);
      const studentsData = studentsRes.data ?? [];
      setStudents(studentsData);

      // 3. 문항
      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, question_number, answer, score')
        .eq('test_id', classData.test_id)
        .order('question_number');

      const qs = questionsData ?? [];
      setQuestions(qs);

      // 4. 학생별 답안 수 로드
      const studentIds = studentsData.map((s) => s.id);
      const questionIds = qs.map((q) => q.id);
      await reloadCounts(studentIds, questionIds);

      // 첫 번째 학생 자동 선택
      if (studentsData.length > 0) setSelectedStudentId(studentsData[0].id);

      setPageLoading(false);
    }
    load();
  }, [classId, reloadCounts]);

  // ── 선택된 학생의 답안 로드
  useEffect(() => {
    if (!selectedStudentId || !questions.length) return;

    setAnswersLoading(true);
    setSaveError(null);
    setSaveSuccess(false);

    const questionIds = questions.map((q) => q.id);

    supabase
      .from('student_answers')
      .select('question_id, selected_answer, is_guessed, is_blank')
      .eq('student_id', selectedStudentId)
      .in('question_id', questionIds)
      .then(({ data }) => {
        const map: AnswerMap = {};
        questions.forEach((q) => { map[q.id] = defaultForm(); });
        (data ?? []).forEach((row) => {
          map[row.question_id] = {
            selected_answer: row.selected_answer ?? '',
            is_guessed: row.is_guessed ?? false,
            is_blank: row.is_blank ?? false,
          };
        });
        setAnswerMap(map);
        setAnswersLoading(false);
      });
  }, [selectedStudentId, questions]);

  // ── 답안 한 칸 업데이트
  const updateAnswer = useCallback(
    (questionId: number, patch: Partial<AnswerForm>) => {
      setAnswerMap((prev) => {
        const cur = prev[questionId] ?? defaultForm();
        const updated = { ...cur, ...patch };
        if (patch.is_blank === true) updated.selected_answer = '';
        if (patch.selected_answer !== undefined && patch.selected_answer !== '') {
          updated.is_blank = false;
        }
        return { ...prev, [questionId]: updated };
      });
    },
    []
  );

  // ── 저장 (DELETE → INSERT)
  const handleSave = useCallback(async () => {
    if (!selectedStudentId || !questions.length) return;
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);

    const questionIds = questions.map((q) => q.id);

    const { error: delErr } = await supabase
      .from('student_answers')
      .delete()
      .eq('student_id', selectedStudentId)
      .in('question_id', questionIds);

    if (delErr) {
      setSaveError(`기존 답안 삭제 실패: ${delErr.message}`);
      setSaving(false);
      return;
    }

    const rows = questions.map((q) => {
      const form = answerMap[q.id] ?? defaultForm();
      const { is_correct, earned_score } = computeResult(form, q.answer, q.score);
      return {
        student_id:      selectedStudentId,
        question_id:     q.id,
        selected_answer: form.selected_answer.trim() || null,
        is_guessed:      form.is_guessed,
        is_blank:        form.is_blank,
        is_correct,
        earned_score,
      };
    });

    const { error: insErr } = await supabase
      .from('student_answers')
      .insert(rows);

    if (insErr) {
      setSaveError(`저장 실패: ${insErr.message}`);
      setSaving(false);
      return;
    }

    setAnswerCounts((prev) => ({
      ...prev,
      [selectedStudentId]: questions.length,
    }));
    setSaveSuccess(true);
    setSaving(false);
  }, [selectedStudentId, questions, answerMap]);

  // ── 저장 후 다음 학생
  const handleSaveAndNext = useCallback(async () => {
    await handleSave();
    setSelectedStudentId((prev) => {
      const idx = students.findIndex((s) => s.id === prev);
      return idx >= 0 && idx < students.length - 1
        ? students[idx + 1].id
        : prev;
    });
  }, [handleSave, students]);

  // ── 실시간 요약 계산
  const summary = (() => {
    let answered = 0, correct = 0, wrong = 0, blank = 0, guessed = 0, score = 0;
    questions.forEach((q) => {
      const form = answerMap[q.id];
      if (!form) return;
      if (form.is_blank) { blank++; return; }
      if (!form.selected_answer.trim()) return;
      answered++;
      if (form.is_guessed) guessed++;
      const { is_correct, earned_score } = computeResult(form, q.answer, q.score);
      if (is_correct) { correct++; score += earned_score; }
      else wrong++;
    });
    const unanswered = questions.length - answered - blank;
    return { answered, correct, wrong, blank: blank + unanswered, guessed, score };
  })();

  const totalScore = questions.reduce((s, q) => s + q.score, 0);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const noStudents  = students.length === 0;
  const noQuestions = questions.length === 0;

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────

  if (pageLoading) {
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
        <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>존재하지 않거나 삭제된 반입니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록으로</Button></Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3">
          <Link href={`/classes/${classId}/students`} className="mt-0.5">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} /> 학생 목록
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{test.title}</span>
              <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
              <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
                {cls.class_name || '반'}
              </span>
              <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                답안 입력
              </span>
            </div>
            {[cls.teacher_name, cls.academy_name].filter(Boolean).length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                {[cls.teacher_name, cls.academy_name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {selectedStudentId && !noQuestions && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAndNext}
              loading={saving}
              disabled={saving}
            >
              저장 후 다음 학생 →
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={handleSave}
              loading={saving}
              disabled={saving}
            >
              <Save size={15} />
              {saveSuccess ? '저장됨 ✓' : '저장'}
            </Button>
          </div>
        )}
      </div>

      {/* ── 정보 요약 바 ── */}
      <div
        className="rounded-xl border px-5 py-3 mb-4 flex flex-wrap gap-x-6 gap-y-1"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {[
          { label: '테스트',    value: test.title },
          { label: '반명',      value: cls.class_name || '–' },
          { label: '총 문항',   value: `${questions.length}문항` },
          { label: '학생 수',   value: `${students.length}명` },
          {
            label: '입력 완료',
            value: `${
              Object.values(answerCounts).filter((c) => c >= questions.length).length
            }명`,
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
            <span className="font-medium" style={{ color: 'var(--fg-main)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── 학생 없음 안내 ── */}
      {noStudents && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--fg-muted)' }}>
              등록된 학생이 없습니다. 먼저 학생을 등록해주세요.
            </p>
            <Link href={`/classes/${classId}/students`}>
              <Button variant="accent" size="sm">학생 등록하러 가기</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── 문항 없음 안내 ── */}
      {!noStudents && noQuestions && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--fg-muted)' }}>
              등록된 문항이 없습니다. 먼저 문항 정보를 입력해주세요.
            </p>
            <Link href={`/tests/${test.id}/questions`}>
              <Button variant="accent" size="sm">문항 입력하러 가기</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!noStudents && !noQuestions && (
        <>
          {/* ── 학생 선택 패널 ── */}
          <div
            className="rounded-xl border mb-4 overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div
              className="px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
                학생 선택
              </span>
              <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {Object.values(answerCounts).filter((c) => c >= questions.length).length} /{' '}
                {students.length}명 입력 완료
              </span>
            </div>
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {students.map((s) => {
                const count  = answerCounts[s.id] ?? 0;
                const status = getStatus(count, questions.length);
                const isSel  = s.id === selectedStudentId;

                const bgColor =
                  isSel ? 'var(--accent)' :
                  status === 'complete' ? '#f0fdf4' :
                  status === 'partial'  ? '#fefce8' : 'var(--bg-base)';
                const borderColor =
                  isSel ? 'var(--accent)' :
                  status === 'complete' ? '#86efac' :
                  status === 'partial'  ? '#fde047' : 'var(--border)';
                const textColor =
                  isSel ? '#fff' :
                  status === 'complete' ? '#15803d' :
                  status === 'partial'  ? '#713f12' : 'var(--fg-main)';

                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudentId(s.id); setSaveSuccess(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                    style={{ background: bgColor, borderColor, color: textColor }}
                  >
                    {s.student_code && (
                      <span className="font-mono text-xs opacity-60">{s.student_code}</span>
                    )}
                    {s.student_name}
                    {!isSel && status !== 'none' && (
                      <span className="text-xs ml-0.5">
                        {status === 'complete' ? '✓' : `${count}/${questions.length}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 범례 */}
            <div
              className="px-5 py-2 border-t flex gap-4 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
            >
              {(Object.entries(STATUS_LABEL) as [StudentStatus, string][]).map(([key, label]) => (
                <span key={key} className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background:
                        key === 'complete' ? '#86efac' :
                        key === 'partial'  ? '#fde047' : 'var(--border)',
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── 선택된 학생 답안 입력 ── */}
          {selectedStudentId && (
            <>
              {/* 현재 학생 요약 카드 */}
              <div
                className="rounded-xl border px-5 py-3 mb-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
                    {selectedStudent?.student_name}
                    {selectedStudent?.student_code && (
                      <span className="ml-1.5 font-mono text-xs font-normal" style={{ color: 'var(--fg-muted)' }}>
                        ({selectedStudent.student_code})
                      </span>
                    )}
                  </span>

                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span style={{ color: '#16a34a' }}>
                      ✓ 정답 <strong>{summary.correct}</strong>개
                    </span>
                    <span style={{ color: '#dc2626' }}>
                      ✗ 오답 <strong>{summary.wrong}</strong>개
                    </span>
                    <span style={{ color: 'var(--fg-muted)' }}>
                      – 미응답 <strong>{summary.blank}</strong>개
                    </span>
                    <span style={{ color: '#d97706' }}>
                      🎲 찍음 <strong>{summary.guessed}</strong>개
                    </span>
                    <span className="font-semibold" style={{ color: 'var(--fg-main)' }}>
                      현재 점수{' '}
                      <strong style={{ color: 'var(--accent)' }}>
                        {summary.score}
                      </strong>
                      {' '}/ {totalScore}점
                    </span>
                  </div>
                </div>

                {saveError && (
                  <div
                    className="flex items-start gap-2 mt-3 text-sm"
                    style={{ color: '#dc2626' }}
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    {saveError}
                  </div>
                )}
                {saveSuccess && (
                  <p className="mt-2 text-sm font-medium" style={{ color: '#16a34a' }}>
                    ✓ 저장 완료!
                  </p>
                )}
              </div>

              {/* 답안 입력 테이블 */}
              {answersLoading ? (
                <div className="flex items-center justify-center py-14">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
                </div>
              ) : (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <div className="overflow-x-auto">
                    <table
                      style={{ minWidth: 760, borderCollapse: 'collapse', width: '100%' }}
                    >
                      <thead style={{ background: 'var(--bg-base)' }}>
                        <tr>
                          {[
                            { label: '번호',      w: 56  },
                            { label: '정답',      w: 64  },
                            { label: '배점',      w: 56  },
                            { label: '학생 답안', w: 240 },
                            { label: '찍음',      w: 56  },
                            { label: '미응답',    w: 64  },
                            { label: '결과',      w: 60  },
                            { label: '획득 점수', w: 80  },
                          ].map((col) => (
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
                        {questions.map((q, i) => {
                          const form = answerMap[q.id] ?? defaultForm();
                          const { is_correct, earned_score } = computeResult(
                            form, q.answer, q.score
                          );
                          const hasAnswer =
                            !form.is_blank && form.selected_answer.trim() !== '';
                          const rowBg = i % 2 === 0 ? '#ffffff' : '#fafaf9';

                          return (
                            <tr
                              key={q.id}
                              style={{
                                background: rowBg,
                                borderTop: '1px solid var(--border)',
                              }}
                            >
                              {/* 번호 */}
                              <td className="px-3 py-2 text-center">
                                <span
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                                  style={{
                                    background: 'var(--accent-lt)',
                                    color: 'var(--accent)',
                                  }}
                                >
                                  {q.question_number}
                                </span>
                              </td>

                              {/* 정답 */}
                              <td className="px-3 py-2 text-center">
                                <span
                                  className="font-semibold text-sm"
                                  style={{ color: 'var(--fg-main)' }}
                                >
                                  {q.answer ?? '–'}
                                </span>
                              </td>

                              {/* 배점 */}
                              <td
                                className="px-3 py-2 text-center text-sm"
                                style={{ color: 'var(--fg-sub)' }}
                              >
                                {q.score}점
                              </td>

                              {/* 학생 답안: 1~5 버튼 */}
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  {CHOICES.map((n) => {
                                    const isSel = form.selected_answer === n;
                                    const disabled = form.is_blank;
                                    return (
                                      <button
                                        key={n}
                                        onClick={() =>
                                          updateAnswer(q.id, {
                                            selected_answer:
                                              form.selected_answer === n ? '' : n,
                                            is_blank: false,
                                          })
                                        }
                                        disabled={disabled}
                                        className="w-8 h-8 rounded-full text-sm font-bold border-2 transition-all"
                                        style={{
                                          background: isSel
                                            ? 'var(--accent)'
                                            : '#fff',
                                          borderColor: isSel
                                            ? 'var(--accent)'
                                            : 'var(--border)',
                                          color: isSel
                                            ? '#fff'
                                            : disabled
                                            ? 'var(--fg-muted)'
                                            : 'var(--fg-sub)',
                                          opacity: disabled ? 0.4 : 1,
                                          cursor: disabled ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {n}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* 찍음 */}
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={form.is_guessed}
                                  onChange={(e) =>
                                    updateAnswer(q.id, { is_guessed: e.target.checked })
                                  }
                                  className="w-4 h-4 cursor-pointer accent-orange-500"
                                />
                              </td>

                              {/* 미응답 */}
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={form.is_blank}
                                  onChange={(e) =>
                                    updateAnswer(q.id, {
                                      is_blank: e.target.checked,
                                      selected_answer: e.target.checked
                                        ? ''
                                        : form.selected_answer,
                                    })
                                  }
                                  className="w-4 h-4 cursor-pointer accent-orange-500"
                                />
                              </td>

                              {/* 결과 */}
                              <td className="px-3 py-2 text-center">
                                {!hasAnswer && !form.is_blank ? (
                                  <MinusCircle
                                    size={16}
                                    className="mx-auto"
                                    style={{ color: 'var(--fg-muted)' }}
                                  />
                                ) : form.is_blank ? (
                                  <MinusCircle
                                    size={16}
                                    className="mx-auto"
                                    style={{ color: '#94a3b8' }}
                                  />
                                ) : is_correct ? (
                                  <CheckCircle2
                                    size={16}
                                    className="mx-auto"
                                    style={{ color: '#16a34a' }}
                                  />
                                ) : (
                                  <XCircle
                                    size={16}
                                    className="mx-auto"
                                    style={{ color: '#dc2626' }}
                                  />
                                )}
                              </td>

                              {/* 획득 점수 */}
                              <td
                                className="px-3 py-2 text-center text-sm font-semibold"
                                style={{
                                  color:
                                    hasAnswer && is_correct ? '#16a34a' : 'var(--fg-muted)',
                                }}
                              >
                                {hasAnswer ? `${earned_score}점` : '–'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 하단 버튼 ── */}
              <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                  <Link href={`/students/${selectedStudentId}/report`}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!answerCounts[selectedStudentId]}
                    >
                      <FileBarChart size={14} /> 학생별 분석표 보기
                    </Button>
                  </Link>
                  <Link href={`/classes/${classId}/analysis`}>
                    <Button variant="outline" size="sm">
                      <BarChart3 size={14} /> 반 전체 분석 보기
                    </Button>
                  </Link>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveAndNext}
                    loading={saving}
                    disabled={saving}
                  >
                    저장 후 다음 학생 →
                  </Button>
                  <Button
                    variant="accent"
                    onClick={handleSave}
                    loading={saving}
                    disabled={saving}
                  >
                    <Save size={15} />
                    {saveSuccess ? '저장됨 ✓' : '저장'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

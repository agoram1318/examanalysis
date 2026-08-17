'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, AlertCircle, Loader2, ChevronRight,
  BarChart3, FileBarChart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass } from '@/lib/class-tests';
import { formatScoreValue, scoreOrFallback } from '@/lib/report-utils';
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
};

type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  total_questions: number;
};

type QuestionRow = {
  id: number;
  question_number: number;
  question_format: 'objective' | 'subjective';
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
  is_correct: boolean;
  is_guessed: boolean;
  is_blank: boolean;
};

type AnswerMap = Record<number, AnswerForm>; // key: question.id
type GradingMode = 'quick' | 'detailed';

// ─────────────────────────────────────────────
// 상수 및 헬퍼
// ─────────────────────────────────────────────
const CHOICES = ['1', '2', '3', '4', '5'] as const;

function defaultForm(): AnswerForm {
  return { selected_answer: '', is_correct: false, is_guessed: false, is_blank: false };
}

function correctForm(question: QuestionRow): AnswerForm {
  return {
    selected_answer: question.question_format === 'objective' ? (question.answer ?? '').trim() : '',
    is_correct: true,
    is_guessed: false,
    is_blank: false,
  };
}

function computeResult(form: AnswerForm, score: number) {
  if (form.is_blank) {
    return { is_correct: false, earned_score: 0 };
  }
  return { is_correct: form.is_correct, earned_score: form.is_correct ? score : 0 };
}

function parseQuestionNumbers(value: string, validNumbers: Set<number>) {
  const numbers = new Set<number>();
  const invalid: string[] = [];

  value
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => {
      const number = Number(token);
      if (Number.isInteger(number) && validNumbers.has(number)) numbers.add(number);
      else invalid.push(token);
    });

  return { numbers, invalid };
}

function formatQuestionNumbers(numbers: number[]) {
  return numbers.sort((a, b) => a - b).join(', ');
}

function questionFormatLabel(format: QuestionRow['question_format']): string {
  return format === 'subjective' ? '주관식' : '객관식';
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
  params: Promise<{ id: string; testId: string }>;
}) {
  const { id: classIdStr, testId: testIdStr } = use(params);
  const classId = Number(classIdStr);
  const testId = Number(testIdStr);

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
  const [gradingMode, setGradingMode]     = useState<GradingMode>('quick');
  const [wrongInput, setWrongInput]       = useState('');
  const [blankInput, setBlankInput]       = useState('');
  const [wrongInputError, setWrongInputError] = useState<string | null>(null);
  const [blankInputError, setBlankInputError] = useState<string | null>(null);
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);

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
    if (isNaN(classId) || isNaN(testId)) {
      setNotFound(true);
      setPageLoading(false);
      return;
    }

    async function load() {
      // 1. 반 정보
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .eq('id', classId)
        .single();

      if (classErr || !classData) {
        setNotFound(true);
        setPageLoading(false);
        return;
      }
      setCls(classData);

      const assigned = await fetchTestsForClass(classId);
      if (!assigned.some((t) => t.id === testId)) {
        setNotFound(true);
        setPageLoading(false);
        return;
      }

      // 2. 테스트 + 학생 (병렬)
      const [testRes, studentsRes] = await Promise.all([
        supabase
          .from('tests')
          .select('id, title, grade, total_questions')
          .eq('id', testId)
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
        .select('id, question_number, question_format, answer, score')
        .eq('test_id', testId)
        .order('question_number');

      const questionCount = questionsData?.length ?? 0;
      const qs = (questionsData ?? []).map((q) => ({
        ...q,
        question_format: q.question_format === 'subjective' ? 'subjective' : 'objective',
        score: scoreOrFallback(q.score, questionCount),
      })) as QuestionRow[];
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
  }, [classId, testId, reloadCounts]);

  // ── 선택된 학생의 답안 로드
  useEffect(() => {
    if (!selectedStudentId || !questions.length) return;

    setAnswersLoading(true);
    setSaveError(null);
    setSaveSuccess(false);
    setNavigationMessage(null);

    const questionIds = questions.map((q) => q.id);

    supabase
      .from('student_answers')
      .select('question_id, selected_answer, is_correct, is_guessed, is_blank')
      .eq('student_id', selectedStudentId)
      .in('question_id', questionIds)
      .then(({ data }) => {
        const map: AnswerMap = {};
        questions.forEach((q) => { map[q.id] = correctForm(q); });
        (data ?? []).forEach((row) => {
          map[row.question_id] = {
            selected_answer: row.selected_answer ?? '',
            is_correct: row.is_correct ?? false,
            is_guessed: row.is_guessed ?? false,
            is_blank: row.is_blank ?? false,
          };
        });
        setAnswerMap(map);
        const questionById = new Map(questions.map((q) => [q.id, q]));
        setWrongInput(formatQuestionNumbers(
          (data ?? [])
            .filter((row) => !row.is_correct && !row.is_blank)
            .map((row) => questionById.get(row.question_id)?.question_number)
            .filter((number): number is number => number !== undefined)
        ));
        setBlankInput(formatQuestionNumbers(
          (data ?? [])
            .filter((row) => row.is_blank)
            .map((row) => questionById.get(row.question_id)?.question_number)
            .filter((number): number is number => number !== undefined)
        ));
        setWrongInputError(null);
        setBlankInputError(null);
        setAnswersLoading(false);
      });
  }, [selectedStudentId, questions]);

  // ── 답안 한 칸 업데이트
  const updateAnswer = useCallback(
    (questionId: number, patch: Partial<AnswerForm>) => {
      setAnswerMap((prev) => {
        const cur = prev[questionId] ?? defaultForm();
        const updated = { ...cur, ...patch };
        if (patch.is_blank === true) {
          updated.selected_answer = '';
          updated.is_correct = false;
        }
        if (patch.selected_answer !== undefined && patch.selected_answer !== '') {
          updated.is_blank = false;
        }
        return { ...prev, [questionId]: updated };
      });
    },
    []
  );

  const syncQuickInputs = useCallback((map: AnswerMap) => {
    setWrongInput(formatQuestionNumbers(
      questions.filter((q) => map[q.id] && !map[q.id].is_correct && !map[q.id].is_blank)
        .map((q) => q.question_number)
    ));
    setBlankInput(formatQuestionNumbers(
      questions.filter((q) => map[q.id]?.is_blank).map((q) => q.question_number)
    ));
    setWrongInputError(null);
    setBlankInputError(null);
  }, [questions]);

  const setQuickStatus = useCallback((question: QuestionRow, status: 'correct' | 'wrong' | 'blank') => {
    const current = answerMap[question.id] ?? correctForm(question);
    const next = { ...answerMap };
    next[question.id] = status === 'correct'
      ? correctForm(question)
      : status === 'blank'
        ? { ...current, selected_answer: '', is_correct: false, is_blank: true }
        : {
            ...current,
            selected_answer: current.is_correct ? '' : current.selected_answer,
            is_correct: false,
            is_blank: false,
          };
    setAnswerMap(next);
    syncQuickInputs(next);
    setSaveSuccess(false);
    setNavigationMessage(null);
  }, [answerMap, syncQuickInputs]);

  const applyQuickInput = useCallback((kind: 'wrong' | 'blank', value: string) => {
    const validNumbers = new Set(questions.map((q) => q.question_number));
    const { numbers, invalid } = parseQuestionNumbers(value, validNumbers);
    if (kind === 'wrong') {
      setWrongInput(value);
      setWrongInputError(invalid.length ? `존재하지 않는 문항: ${invalid.join(', ')}` : null);
    } else {
      setBlankInput(value);
      setBlankInputError(invalid.length ? `존재하지 않는 문항: ${invalid.join(', ')}` : null);
    }

    const next = { ...answerMap };
    questions.forEach((question) => {
      const current = next[question.id] ?? correctForm(question);
      const isCurrentKind = kind === 'wrong'
        ? !current.is_correct && !current.is_blank
        : current.is_blank;
      const shouldSelect = numbers.has(question.question_number);

      if (shouldSelect) {
        next[question.id] = kind === 'blank'
          ? { ...current, selected_answer: '', is_correct: false, is_blank: true }
          : {
              ...current,
              selected_answer: current.is_correct ? '' : current.selected_answer,
              is_correct: false,
              is_blank: false,
            };
      } else if (isCurrentKind) {
        next[question.id] = correctForm(question);
      }
    });

    const otherNumbers = questions
      .filter((question) => {
        const form = next[question.id];
        return kind === 'wrong'
          ? form?.is_blank
          : form && !form.is_correct && !form.is_blank;
      })
      .map((question) => question.question_number);
    if (kind === 'wrong') setBlankInput(formatQuestionNumbers(otherNumbers));
    else setWrongInput(formatQuestionNumbers(otherNumbers));
    setAnswerMap(next);
    setSaveSuccess(false);
    setNavigationMessage(null);
  }, [answerMap, questions]);

  // ── 저장 (전체 문항을 동일한 student_answers 구조로 upsert)
  const handleSave = useCallback(async () => {
    if (!selectedStudentId || !questions.length || answersLoading) return false;
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);

    const rows = questions.map((q) => {
      const form = answerMap[q.id] ?? correctForm(q);
      const { is_correct, earned_score } = computeResult(form, q.score);
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
      .upsert(rows, { onConflict: 'student_id,question_id' });

    if (insErr) {
      setSaveError(`저장 실패: ${insErr.message}`);
      setSaving(false);
      return false;
    }

    setAnswerCounts((prev) => ({
      ...prev,
      [selectedStudentId]: questions.length,
    }));
    setSaveSuccess(true);
    setSaving(false);
    return true;
  }, [selectedStudentId, questions, answerMap, answersLoading]);

  // ── 저장 후 다음 학생
  const handleSaveAndNext = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    const idx = students.findIndex((s) => s.id === selectedStudentId);
    if (idx < 0 || idx >= students.length - 1) {
      setNavigationMessage('마지막 학생입니다.');
      return;
    }
    setSelectedStudentId(students[idx + 1].id);
  }, [handleSave, selectedStudentId, students]);

  // ── 실시간 요약 계산
  const summary = (() => {
    let correct = 0, wrong = 0, blank = 0, guessed = 0, score = 0;
    questions.forEach((q) => {
      const form = answerMap[q.id] ?? correctForm(q);
      if (form.is_blank) { blank++; return; }
      if (form.is_guessed) guessed++;
      const { is_correct, earned_score } = computeResult(form, q.score);
      if (is_correct) { correct++; score += earned_score; }
      else wrong++;
    });
    return { correct, wrong, blank, guessed, score };
  })();

  const totalScore = questions.reduce((s, q) => s + q.score, 0);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const noStudents  = students.length === 0;
  const noQuestions = questions.length === 0;
  const quickQuestions = questions.filter((q) => {
    const form = answerMap[q.id] ?? correctForm(q);
    return form.is_blank || !form.is_correct || form.is_guessed;
  });
  const displayedQuestions = gradingMode === 'quick' ? quickQuestions : questions;

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
          <Link href={`/classes/${classId}/answers`} className="mt-0.5">
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
              disabled={saving || answersLoading}
            >
              저장 후 다음 학생 →
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={handleSave}
              loading={saving}
              disabled={saving || answersLoading}
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
              {/* 채점 모드 */}
              <div
                className="rounded-xl border p-4 mb-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>채점 방식</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                      빠른 채점은 오답과 미응답만 선택합니다.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
                    {([
                      { value: 'quick' as const, label: '오답만 입력' },
                      { value: 'detailed' as const, label: '전체 답안 입력' },
                    ]).map((item) => {
                      const selected = gradingMode === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setGradingMode(item.value);
                            if (item.value === 'quick') syncQuickInputs(answerMap);
                          }}
                          className="rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                          style={{
                            background: selected ? 'var(--accent)' : 'transparent',
                            color: selected ? '#fff' : 'var(--fg-sub)',
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {gradingMode === 'quick' && !answersLoading && (
                <div className="grid gap-4 lg:grid-cols-2 mb-4">
                  {([
                    {
                      kind: 'wrong' as const,
                      title: '오답 문항',
                      description: '쉼표 또는 공백으로 여러 번호를 입력할 수 있습니다.',
                      value: wrongInput,
                      error: wrongInputError,
                      color: '#dc2626',
                      selectedBg: '#fef2f2',
                    },
                    {
                      kind: 'blank' as const,
                      title: '미응답 문항',
                      description: '오답과 구분하여 미응답 번호를 선택하세요.',
                      value: blankInput,
                      error: blankInputError,
                      color: '#64748b',
                      selectedBg: '#f1f5f9',
                    },
                  ]).map((section) => (
                    <div
                      key={section.kind}
                      className="rounded-xl border p-4"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                    >
                      <label className="block text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
                        {section.title}
                      </label>
                      <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--fg-muted)' }}>
                        {section.description}
                      </p>
                      <input
                        value={section.value}
                        onChange={(event) => applyQuickInput(section.kind, event.target.value)}
                        onBlur={() => syncQuickInputs(answerMap)}
                        placeholder={section.kind === 'wrong' ? '예: 4, 7, 12, 18' : '예: 20'}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        style={{ borderColor: section.error ? '#dc2626' : 'var(--border)' }}
                      />
                      {section.error && (
                        <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{section.error}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {questions.map((question) => {
                          const form = answerMap[question.id] ?? correctForm(question);
                          const selected = section.kind === 'wrong'
                            ? !form.is_correct && !form.is_blank
                            : form.is_blank;
                          return (
                            <button
                              key={question.id}
                              type="button"
                              onClick={() => setQuickStatus(question, selected ? 'correct' : section.kind)}
                              className="h-8 min-w-8 rounded-lg border px-2 text-xs font-bold transition-colors"
                              style={{
                                background: selected ? section.selectedBg : '#fff',
                                borderColor: selected ? section.color : 'var(--border)',
                                color: selected ? section.color : 'var(--fg-sub)',
                              }}
                              aria-pressed={selected}
                            >
                              {question.question_number}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                    <span style={{ color: 'var(--fg-sub)' }}>
                      총 <strong>{questions.length}</strong>문항
                    </span>
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
                      예상 점수{' '}
                      <strong style={{ color: 'var(--accent)' }}>
                        {formatScoreValue(summary.score)}
                      </strong>
                      {' '}/ {formatScoreValue(totalScore)}점
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
                {navigationMessage && (
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--fg-sub)' }}>
                    {navigationMessage}
                  </p>
                )}
              </div>

              {/* 답안 입력 테이블 */}
              {answersLoading ? (
                <div className="flex items-center justify-center py-14">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
                </div>
              ) : (
                <div>
                  {gradingMode === 'quick' && displayedQuestions.length === 0 && (
                    <div
                      className="rounded-xl border px-5 py-10 text-center mb-4"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                    >
                      <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>
                        모든 문항이 정답으로 선택되어 있습니다.
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
                        오답 또는 미응답 문항을 위에서 선택하면 상세 입력란이 표시됩니다.
                      </p>
                    </div>
                  )}
                  {displayedQuestions.length > 0 && (
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  >
                    {gradingMode === 'quick' && (
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
                          오답·미응답·찍음 상세 입력
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                          학생 답안은 선택사항입니다. 오답 번호만 선택해도 저장할 수 있습니다.
                        </p>
                      </div>
                    )}
                  <div className="overflow-x-auto">
                    <table
                      style={{ minWidth: 760, borderCollapse: 'collapse', width: '100%' }}
                    >
                      <thead style={{ background: 'var(--bg-base)' }}>
                        <tr>
                          {[
                            { label: '번호',      w: 56  },
                            { label: '문항 형식', w: 84  },
                            { label: '정답',      w: 64  },
                            { label: '배점',      w: 56  },
                            { label: '학생 답안', w: 240 },
                            { label: '채점 결과', w: 112 },
                            { label: '찍음',      w: 56  },
                            { label: '미응답',    w: 64  },
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
                        {displayedQuestions.map((q, i) => {
                          const form = answerMap[q.id] ?? correctForm(q);
                          const { is_correct, earned_score } = computeResult(form, q.score);
                          const hasAnswer = !form.is_blank;
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

                              {/* 문항 형식 */}
                              <td className="px-3 py-2 text-center">
                                <span
                                  className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                                  style={{
                                    background: q.question_format === 'subjective' ? '#eef2ff' : 'var(--accent-lt)',
                                    color: q.question_format === 'subjective' ? '#4338ca' : 'var(--accent)',
                                  }}
                                >
                                  {questionFormatLabel(q.question_format)}
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
                                {formatScoreValue(q.score)}점
                              </td>

                              {/* 학생 답안 */}
                              <td className="px-3 py-2">
                                {q.question_format === 'objective' ? (
                                  <div className="flex items-center gap-1.5">
                                    {CHOICES.map((n) => {
                                      const isSel = form.selected_answer === n;
                                      const disabled = form.is_blank;
                                      const nextAnswer = form.selected_answer === n ? '' : n;
                                      return (
                                        <button
                                          key={n}
                                          onClick={() =>
                                            updateAnswer(q.id, {
                                              selected_answer: nextAnswer,
                                              is_correct: gradingMode === 'quick'
                                                ? false
                                                : nextAnswer !== '' && nextAnswer.trim() === (q.answer ?? '').trim(),
                                              is_blank: false,
                                            })
                                          }
                                          disabled={disabled}
                                          className="w-8 h-8 rounded-full text-sm font-bold border-2 transition-all"
                                          style={{
                                            background: isSel ? 'var(--accent)' : '#fff',
                                            borderColor: isSel ? 'var(--accent)' : 'var(--border)',
                                            color: isSel ? '#fff' : disabled ? 'var(--fg-muted)' : 'var(--fg-sub)',
                                            opacity: disabled ? 0.4 : 1,
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {n}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <input
                                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                                    style={{ borderColor: 'var(--border)' }}
                                    placeholder="학생 답안 입력"
                                    value={form.selected_answer}
                                    disabled={form.is_blank}
                                    onChange={(e) =>
                                      updateAnswer(q.id, {
                                        selected_answer: e.target.value,
                                        is_blank: false,
                                      })
                                    }
                                  />
                                )}
                              </td>

                              {/* 채점 결과 */}
                              <td className="px-3 py-2">
                                {gradingMode === 'quick' ? (
                                  <span
                                    className="inline-flex rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                                    style={{ background: form.is_correct ? '#16a34a' : '#dc2626' }}
                                  >
                                    {form.is_correct ? 'O' : 'X'}
                                  </span>
                                ) : (
                                <div className="inline-flex overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                                  {[
                                    { label: 'O', value: true, color: '#16a34a' },
                                    { label: 'X', value: false, color: '#dc2626' },
                                  ].map((item) => {
                                    const selected = form.is_correct === item.value && !form.is_blank;
                                    return (
                                      <button
                                        key={item.label}
                                        type="button"
                                        disabled={form.is_blank}
                                        onClick={() => updateAnswer(q.id, { is_correct: item.value, is_blank: false })}
                                        className="px-3 py-1.5 text-xs font-bold transition-all"
                                        style={{
                                          background: selected ? item.color : '#fff',
                                          color: selected ? '#fff' : form.is_blank ? 'var(--fg-muted)' : item.color,
                                          opacity: form.is_blank ? 0.45 : 1,
                                        }}
                                      >
                                        {item.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                )}
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
                                  onChange={(e) => {
                                    if (gradingMode === 'quick') {
                                      setQuickStatus(q, e.target.checked ? 'blank' : 'wrong');
                                      return;
                                    }
                                    updateAnswer(q.id, {
                                      is_blank: e.target.checked,
                                      selected_answer: e.target.checked ? '' : form.selected_answer,
                                      is_correct: e.target.checked ? false : form.is_correct,
                                    });
                                  }}
                                  className="w-4 h-4 cursor-pointer accent-orange-500"
                                />
                              </td>

                              {/* 획득 점수 */}
                              <td
                                className="px-3 py-2 text-center text-sm font-semibold"
                                style={{
                                  color:
                                    hasAnswer && is_correct ? '#16a34a' : 'var(--fg-muted)',
                                }}
                              >
                                {hasAnswer ? `${formatScoreValue(earned_score)}점` : '–'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                  )}
                </div>
              )}

              {/* ── 하단 버튼 ── */}
              <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                  <Link href={`/students/${selectedStudentId}/tests/${testId}/report`}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!answerCounts[selectedStudentId]}
                    >
                      <FileBarChart size={14} /> 학생별 분석표 보기
                    </Button>
                  </Link>
                  <Link href={`/classes/${classId}/tests/${testId}/analysis`}>
                    <Button variant="outline" size="sm">
                      <BarChart3 size={14} /> 반 전체 분석 보기
                    </Button>
                  </Link>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {gradingMode === 'quick' && (
                    <p className="text-xs text-right" style={{ color: 'var(--fg-muted)' }}>
                      오답 또는 미응답으로 선택하지 않은 문항은 모두 정답으로 저장됩니다.
                    </p>
                  )}
                  <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveAndNext}
                    loading={saving}
                    disabled={saving || answersLoading}
                  >
                    저장 후 다음 학생 →
                  </Button>
                  <Button
                    variant="accent"
                    onClick={handleSave}
                    loading={saving}
                    disabled={saving || answersLoading}
                  >
                    <Save size={15} />
                    {saveSuccess ? '저장됨 ✓' : '저장'}
                  </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

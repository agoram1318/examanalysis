'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass } from '@/lib/class-tests';
import {
  pickUnitName,
  difficultyGroup,
  DIFF_ORDER,
  formatReportDate,
  type GroupStat,
} from '@/lib/report-utils';
import ReportPage from '@/components/reports/ReportPage';
import ReportHeader from '@/components/reports/ReportHeader';
import ReportSection from '@/components/reports/ReportSection';
import ReportTable, { ReportTd, ReportTr } from '@/components/reports/ReportTable';
import PrintToolbar from '@/components/reports/PrintToolbar';
import ReportSummaryGrid from '@/components/reports/ReportSummaryGrid';
import ReportComment from '@/components/reports/ReportComment';
import GroupStatTable from '@/components/reports/GroupStatTable';
import Button from '@/components/ui/Button';

type QA = {
  id: number;
  question_number: number;
  answer: string | null;
  score: number;
  difficulty: number | null;
  major_unit_name: string | null;
  middle_unit_name: string | null;
  small_unit_name: string | null;
  ans: {
    selected_answer: string | null;
    is_guessed: boolean;
    is_blank: boolean;
    is_correct: boolean;
    earned_score: number;
  } | null;
};

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

  if (scoreRate >= 90) parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  else if (scoreRate >= 70) parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  else if (scoreRate >= 50) parts.push('개념 이해와 문제 적용 훈련이 함께 필요합니다.');
  else parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');

  if (guessRate < 10) parts.push('풀이 확신도가 비교적 안정적입니다.');
  else if (guessRate < 25) parts.push('일부 문항에서 확신 부족이 나타났습니다.');
  else if (guessRate < 40) parts.push('중상 난도 문항에서 접근 불안정성이 보입니다.');
  else parts.push('문제 접근력과 시간 관리 훈련이 필요합니다.');

  if (guessedCount > 0 && guessedCorrect / guessedCount > 0.5) {
    parts.push('맞힌 문항도 풀이 과정을 점검할 필요가 있습니다.');
  }

  const lastQ = qaRows.slice(Math.floor(qaRows.length * 0.75));
  const blankAtEnd = lastQ.filter((qa) => qa.ans?.is_blank || !qa.ans?.selected_answer).length;
  if (blankAtEnd >= 2) parts.push('시간 배분 훈련과 변별 문항 접근 전략이 필요합니다.');

  return parts.join(' ');
}

export default function StudentPrintPage({
  params,
}: {
  params: Promise<{ studentId: string; testId: string }>;
}) {
  const { studentId: sid, testId: tid } = use(params);
  const studentId = Number(sid);
  const testId = Number(tid);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [classId, setClassId] = useState(0);
  const [meta, setMeta] = useState<{ label: string; value: string }[]>([]);
  const [qaRows, setQaRows] = useState<QA[]>([]);

  useEffect(() => {
    if (isNaN(studentId) || isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
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

      setStudentName(studentData.student_name);
      setStudentCode(studentData.student_code);
      setClassId(studentData.class_id);

      const { data: classData } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .eq('id', studentData.class_id)
        .single();

      const assigned = await fetchTestsForClass(studentData.class_id);
      if (!assigned.some((t) => t.id === testId)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: testRaw } = await supabase
        .from('tests')
        .select('id, title, grade, subjects(name)')
        .eq('id', testId)
        .single();

      if (!testRaw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const subjectName = pickUnitName(testRaw.subjects);
      setMeta([
        { label: '학생명', value: studentData.student_name },
        { label: '학생 코드', value: studentData.student_code || '–' },
        { label: '테스트명', value: testRaw.title },
        { label: '학년', value: testRaw.grade || '–' },
        { label: '과목', value: subjectName || '–' },
        { label: '강사명', value: classData?.teacher_name || '–' },
        { label: '학원명', value: classData?.academy_name || '–' },
        { label: '반명', value: classData?.class_name || '–' },
      ]);

      const { data: questionsRaw } = await supabase
        .from('questions')
        .select(`
          id, question_number, answer, score, difficulty,
          units_major:major_unit_id(name),
          units_middle:middle_unit_id(name),
          units_small:small_unit_id(name)
        `)
        .eq('test_id', testId)
        .order('question_number');

      const questions = (questionsRaw ?? []).map((q) => ({
        id: q.id,
        question_number: q.question_number,
        answer: q.answer,
        score: Number(q.score),
        difficulty: q.difficulty,
        major_unit_name: pickUnitName(q.units_major),
        middle_unit_name: pickUnitName(q.units_middle),
        small_unit_name: pickUnitName(q.units_small),
      }));

      if (!questions.length) {
        setQaRows([]);
        setLoading(false);
        return;
      }

      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .eq('student_id', studentId)
        .in('question_id', questions.map((q) => q.id));

      const answerMap = new Map(
        (answersRaw ?? []).map((a) => [
          a.question_id,
          {
            selected_answer: a.selected_answer,
            is_guessed: a.is_guessed,
            is_blank: a.is_blank,
            is_correct: a.is_correct,
            earned_score: Number(a.earned_score),
          },
        ])
      );

      setQaRows(questions.map((q) => ({ ...q, ans: answerMap.get(q.id) ?? null })));
      setLoading(false);
    }

    load();
  }, [studentId, testId]);

  const totalPossible = qaRows.reduce((s, qa) => s + qa.score, 0);
  const totalScore = qaRows.reduce((s, qa) => s + (qa.ans?.earned_score ?? 0), 0);
  const correctCount = qaRows.filter((qa) => qa.ans?.is_correct).length;
  const wrongCount = qaRows.filter(
    (qa) => qa.ans && !qa.ans.is_correct && !qa.ans.is_blank && qa.ans.selected_answer
  ).length;
  const blankCount = qaRows.filter((qa) => !qa.ans || qa.ans.is_blank || !qa.ans.selected_answer).length;
  const guessedCount = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessedWrong = qaRows.filter((qa) => qa.ans?.is_guessed && !qa.ans?.is_correct).length;
  const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const guessRate =
    qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length > 0
      ? (guessedCount /
          qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length) *
        100
      : 0;

  const majorStats = groupStats(qaRows, (qa) => qa.major_unit_name || '미분류');
  const middleStats = groupStats(qaRows, (qa) =>
    qa.middle_unit_name ? `${qa.major_unit_name ?? ''} > ${qa.middle_unit_name}` : '미분류'
  );
  const diffStats = [...groupStats(qaRows, (qa) => difficultyGroup(qa.difficulty))].sort(
    (a, b) => DIFF_ORDER.indexOf(a.name) - DIFF_ORDER.indexOf(b.name)
  );

  const comment = qaRows.length > 0 ? generateComment(qaRows, totalScore, totalPossible) : '';
  const today = formatReportDate();
  const backHref = `/students/${studentId}/tests/${testId}/report`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-4">학생 리포트를 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록</Button></Link>
      </div>
    );
  }

  return (
    <>
      <PrintToolbar backHref={backHref} backLabel="학생별 분석으로" title="학생별 인쇄용 리포트" />
      <ReportPage>
        <ReportHeader
          title="학생별 학습 진단 리포트"
          subtitle={meta.find((m) => m.label === '테스트명')?.value}
          highlight={studentName}
          highlightSub={studentCode ?? undefined}
          meta={meta}
          generatedAt={today}
        />
        <div className="report-page-body">
          <ReportSection title="종합 결과">
            <ReportSummaryGrid
              cards={[
                { label: '총점', value: `${totalScore}점`, accent: true },
                { label: '총 배점', value: `${totalPossible}점` },
                { label: '정답 수', value: `${correctCount}개` },
                { label: '오답 수', value: `${wrongCount}개` },
                { label: '미응답', value: `${blankCount}개` },
                { label: '찍음', value: `${guessedCount}개` },
                { label: '찍어서 맞음', value: `${guessedCorrect}개` },
                { label: '찍어서 틀림', value: `${guessedWrong}개` },
                { label: '정답률', value: `${scoreRate.toFixed(1)}%`, accent: true },
                { label: '찍음 비율', value: `${guessRate.toFixed(1)}%` },
              ]}
            />
          </ReportSection>

          {comment && (
            <ReportSection title="종합 학습 코멘트">
              <ReportComment>{comment}</ReportComment>
            </ReportSection>
          )}

          <ReportSection title="단원별 성취도">
            {majorStats.length === 0 ? (
              <p className="report-empty">단원 정보가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                <GroupStatTable stats={majorStats.map((s) => ({ ...s, name: `▶ ${s.name}` }))} nameHeader="대단원" compact />
                {middleStats.length > 0 && (
                  <GroupStatTable stats={middleStats} nameHeader="중단원" compact />
                )}
              </div>
            )}
          </ReportSection>

          <ReportSection title="난이도별 성취도">
            {diffStats.length === 0 ? (
              <p className="report-empty">난이도 정보가 없습니다.</p>
            ) : (
              <GroupStatTable stats={diffStats} nameHeader="난이도 구간" compact />
            )}
          </ReportSection>

          <ReportSection title="문항별 결과" pageBreakBefore>
            {qaRows.length === 0 ? (
              <p className="report-empty">문항이 없습니다.</p>
            ) : (
              <ReportTable
                headers={['번호', '정답', '학생 답', '결과', '점수', '찍음', '미응답', '난이도']}
                compact
              >
                {qaRows.map((qa, i) => {
                  const ans = qa.ans;
                  const hasAnswer = ans && !ans.is_blank && ans.selected_answer;
                  const result = !ans || (!ans.is_blank && !ans.selected_answer)
                    ? '–'
                    : ans.is_blank
                      ? '미응답'
                      : ans.is_correct
                        ? '정답'
                        : '오답';
                  return (
                    <ReportTr key={qa.id} stripedIndex={i}>
                      <ReportTd align="center">{qa.question_number}</ReportTd>
                      <ReportTd align="center">{qa.answer ?? '–'}</ReportTd>
                      <ReportTd align="center">
                        {ans?.is_blank ? '미응답' : ans?.selected_answer ?? '–'}
                      </ReportTd>
                      <ReportTd align="center" className={ans?.is_correct ? 'text-green-700 font-semibold' : ans && hasAnswer ? 'text-red-600 font-semibold' : ''}>
                        {result}
                      </ReportTd>
                      <ReportTd align="center">{ans ? `${ans.earned_score}` : '–'}</ReportTd>
                      <ReportTd align="center">{ans?.is_guessed ? 'O' : '–'}</ReportTd>
                      <ReportTd align="center">{ans?.is_blank ? 'O' : '–'}</ReportTd>
                      <ReportTd align="center">{qa.difficulty ?? '–'}</ReportTd>
                    </ReportTr>
                  );
                })}
              </ReportTable>
            )}
          </ReportSection>
        </div>
      </ReportPage>
    </>
  );
}

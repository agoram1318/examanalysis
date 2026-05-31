'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass } from '@/lib/class-tests';
import { pickUnitName, formatReportDate, formatSubjectList, getQuestionSubjectName, scoreOrFallback, formatScoreValue, type GroupStat } from '@/lib/report-utils';
import ReportPage from '@/components/reports/ReportPage';
import ReportHeader from '@/components/reports/ReportHeader';
import ReportSection from '@/components/reports/ReportSection';
import ReportTable, { ReportTd, ReportTr } from '@/components/reports/ReportTable';
import PrintToolbar from '@/components/reports/PrintToolbar';
import ReportSummaryGrid from '@/components/reports/ReportSummaryGrid';
import ReportComment from '@/components/reports/ReportComment';
import GroupStatTable from '@/components/reports/GroupStatTable';
import Button from '@/components/ui/Button';

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

function featureComment(q: QuestionRow): string | null {
  const comment = q.question_comment?.trim();
  return comment || null;
}

type StudentRow = { id: number; student_name: string; student_code: string | null };

function generateClassComment(avgRate: number, avgGuessRate: number, highDiffLow: boolean): string {
  const parts: string[] = [];
  if (avgRate >= 80) parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  else if (avgRate >= 60) parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  else if (avgRate >= 40) parts.push('개념 이해와 유형 적용 훈련이 함께 필요합니다.');
  else parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');
  if (avgGuessRate >= 20) parts.push('풀이 확신도와 시간 관리 점검이 필요합니다.');
  if (highDiffLow) parts.push('중상 난도 변별 문항 접근 전략이 필요합니다.');
  return parts.join(' ');
}

export default function ClassPrintPage({
  params,
}: {
  params: Promise<{ id: string; testId: string }>;
}) {
  const { id: classIdStr, testId: testIdStr } = use(params);
  const classId = Number(classIdStr);
  const testId = Number(testIdStr);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [clsName, setClsName] = useState('');
  const [meta, setMeta] = useState<{ label: string; value: string }[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  useEffect(() => {
    if (isNaN(classId) || isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .eq('id', classId)
        .single();

      if (classErr || !classData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setClsName(classData.class_name || '반');
      const assigned = await fetchTestsForClass(classId);
      if (!assigned.some((t) => t.id === testId)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: testRaw } = await supabase
        .from('tests')
        .select('id, title, grade')
        .eq('id', testId)
        .single();

      if (!testRaw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [studentsRes, questionsRes] = await Promise.all([
        supabase.from('students').select('id, student_name, student_code').eq('class_id', classId).order('student_code'),
        supabase.from('questions').select(`
          id, question_number, answer, score, difficulty, question_comment,
          subjects:subject_id(name),
          units_major:major_unit_id(name),
          units_middle:middle_unit_id(name),
          units_small:small_unit_id(name)
        `).eq('test_id', testId).order('question_number'),
      ]);

      const studentsData = studentsRes.data ?? [];
      setStudents(studentsData);

      const questionCount = questionsRes.data?.length ?? 0;
      const qs: QuestionRow[] = (questionsRes.data ?? []).map((q) => ({
        id: q.id,
        question_number: q.question_number,
        answer: q.answer,
        score: scoreOrFallback(q.score, questionCount),
        difficulty: q.difficulty,
        question_comment: q.question_comment ?? null,
        subject_name: getQuestionSubjectName(q.subjects),
        major_unit_name: pickUnitName(q.units_major),
        middle_unit_name: pickUnitName(q.units_middle),
        small_unit_name: pickUnitName(q.units_small),
      }));
      setQuestions(qs);

      setMeta([
        { label: '테스트명', value: testRaw.title },
        { label: '학년', value: testRaw.grade || '–' },
        { label: '과목', value: formatSubjectList(qs.map((q) => q.subject_name)) },
        { label: '강사명', value: classData.teacher_name || '–' },
        { label: '학원명', value: classData.academy_name || '–' },
        { label: '반명', value: classData.class_name || '–' },
      ]);

      if (!studentsData.length || !qs.length) {
        setLoading(false);
        return;
      }

      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('student_id, question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .in('student_id', studentsData.map((s) => s.id))
        .in('question_id', qs.map((q) => q.id));

      setAllAnswers((answersRaw ?? []).map((a) => ({ ...a, earned_score: Number(a.earned_score) })));
      setLoading(false);
    }

    load();
  }, [classId, testId]);

  const totalPossible = questions.reduce((s, q) => s + q.score, 0);
  const studentStats = students
    .map((s) => {
      const answers = allAnswers.filter((a) => a.student_id === s.id);
      const totalScore = answers.reduce((sum, a) => sum + a.earned_score, 0);
      const correctCount = answers.filter((a) => a.is_correct).length;
      const blankCount = answers.filter((a) => a.is_blank || !a.selected_answer).length;
      const wrongCount = answers.length - correctCount - blankCount;
      const guessedCount = answers.filter((a) => a.is_guessed).length;
      const answeredCount = answers.filter((a) => !a.is_blank && a.selected_answer).length;
      const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
      return {
        student: s,
        totalScore,
        correctCount,
        wrongCount,
        blankCount,
        guessedCount,
        answeredCount,
        scoreRate,
        active: answeredCount > 0 || totalScore > 0,
      };
    })
    .filter((s) => s.active);

  const scores = studentStats.map((s) => s.totalScore);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const avgRate = totalPossible > 0 ? (avgScore / totalPossible) * 100 : 0;
  const totalGuessed = allAnswers.filter((a) => a.is_guessed).length;
  const totalBlank = allAnswers.filter((a) => a.is_blank || !a.selected_answer).length;
  const avgGuessRate = (() => {
    const rates = studentStats.map((s) =>
      s.answeredCount > 0 ? (s.guessedCount / s.answeredCount) * 100 : 0
    );
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  })();

  const qStats = questions.map((q) => {
    const ans = allAnswers.filter((a) => a.question_id === q.id);
    const correctCount = ans.filter((a) => a.is_correct).length;
    const blankCount = ans.filter((a) => a.is_blank || !a.selected_answer).length;
    const wrongCount = ans.length - correctCount - blankCount;
    const guessedCount = ans.filter((a) => a.is_guessed).length;
    const n = students.length;
    const correctRate = n > 0 ? (correctCount / n) * 100 : 0;
    const guessRate = ans.length > 0 ? (guessedCount / ans.length) * 100 : 0;
    return { q, correctCount, wrongCount, blankCount, guessedCount, correctRate, guessRate };
  });

  const top5Wrong = [...qStats].sort((a, b) => a.correctRate - b.correctRate).slice(0, 5);
  const top5Guess = [...qStats].filter((s) => s.guessedCount > 0).sort((a, b) => b.guessRate - a.guessRate).slice(0, 5);

  const majorMap = new Map<string, GroupStat>();
  allAnswers.forEach((a) => {
    const q = questions.find((qq) => qq.id === a.question_id);
    if (!q) return;
    const key = q.major_unit_name || '미분류';
    const e = majorMap.get(key) ?? { name: key, total: 0, correct: 0 };
    e.total++;
    if (a.is_correct) e.correct++;
    majorMap.set(key, e);
  });

  const highDiffAns = allAnswers.filter((a) => {
    const q = questions.find((qq) => qq.id === a.question_id);
    return (q?.difficulty ?? 0) >= 5;
  });
  const highDiffLow =
    highDiffAns.length > 0 &&
    highDiffAns.filter((a) => a.is_correct).length / highDiffAns.length < 0.4;

  const comment = allAnswers.length > 0 ? generateClassComment(avgRate, avgGuessRate, highDiffLow) : '';
  const today = formatReportDate();
  const backHref = `/classes/${classId}/tests/${testId}/analysis`;

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
        <p className="font-semibold mb-4">반 분석을 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록</Button></Link>
      </div>
    );
  }

  return (
    <>
      <PrintToolbar backHref={backHref} backLabel="반 전체 분석으로" title="반 전체 인쇄용 리포트" />
      <ReportPage>
        <ReportHeader
          title="반 전체 학습 분석 리포트"
          subtitle={meta.find((m) => m.label === '테스트명')?.value}
          highlight={clsName}
          highlightSub={`${students.length}명`}
          meta={meta}
          generatedAt={today}
        />
        <div className="report-page-body">
          <ReportSection title="전체 요약">
            <ReportSummaryGrid
              cards={[
                { label: '응시 인원', value: `${students.length}명` },
                { label: '평균 점수', value: `${formatScoreValue(avgScore)}점`, accent: true },
                { label: '최고점', value: `${formatScoreValue(scores.length ? Math.max(...scores) : 0)}점` },
                { label: '최저점', value: `${formatScoreValue(scores.length ? Math.min(...scores) : 0)}점` },
                { label: '평균 정답률', value: `${avgRate.toFixed(1)}%`, accent: true },
                { label: '총 찍음', value: `${totalGuessed}개` },
                { label: '평균 찍음 비율', value: `${avgGuessRate.toFixed(1)}%` },
                { label: '미응답 총합', value: `${totalBlank}개` },
              ]}
            />
          </ReportSection>

          {comment && (
            <ReportSection title="반 전체 학습 코멘트">
              <ReportComment>{comment}</ReportComment>
            </ReportSection>
          )}

          <div className="report-two-col">
            <ReportSection title="오답률 TOP 5">
              {top5Wrong.map((s, i) => (
                <div key={s.q.id} className="report-top5-item">
                  <span className="report-top5-num" style={{ background: '#fee2e2', color: '#dc2626' }}>{s.q.question_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: '#dc2626' }}>정답률 {s.correctRate.toFixed(1)}% · 오답 {s.wrongCount}명</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{s.q.major_unit_name ?? '–'}</p>
                    {featureComment(s.q) && <p className="text-xs mt-0.5" style={{ color: 'var(--fg-sub)' }}>문항 특징: {featureComment(s.q)}</p>}
                  </div>
                  <span className="report-top5-rank">{i + 1}위</span>
                </div>
              ))}
            </ReportSection>
            <ReportSection title="찍음 비율 TOP 5">
              {top5Guess.length === 0 ? (
                <p className="report-empty">찍음 데이터 없음</p>
              ) : (
                top5Guess.map((s, i) => (
                  <div key={s.q.id} className="report-top5-item">
                    <span className="report-top5-num" style={{ background: '#fff7ed', color: '#ea580c' }}>{s.q.question_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: '#ea580c' }}>찍음 {s.guessRate.toFixed(1)}% · 정답률 {s.correctRate.toFixed(1)}%</p>
                      {featureComment(s.q) && <p className="text-xs mt-0.5" style={{ color: 'var(--fg-sub)' }}>문항 특징: {featureComment(s.q)}</p>}
                    </div>
                    <span className="report-top5-rank">{i + 1}위</span>
                  </div>
                ))
              )}
            </ReportSection>
          </div>

          <ReportSection title="학생별 점수" pageBreakBefore>
            {studentStats.length === 0 ? (
              <p className="report-empty">답안 데이터가 없습니다.</p>
            ) : (
              <ReportTable
                headers={['코드', '학생명', '총점', '정답', '오답', '미응답', '찍음', '정답률']}
                compact
              >
                {[...studentStats].sort((a, b) => b.totalScore - a.totalScore).map((s, i) => (
                  <ReportTr key={s.student.id} stripedIndex={i}>
                    <ReportTd>{s.student.student_code || '–'}</ReportTd>
                    <ReportTd>{s.student.student_name}</ReportTd>
                    <ReportTd align="center" className="font-semibold text-orange-600">{formatScoreValue(s.totalScore)}</ReportTd>
                    <ReportTd align="center">{s.correctCount}</ReportTd>
                    <ReportTd align="center">{s.wrongCount}</ReportTd>
                    <ReportTd align="center">{s.blankCount}</ReportTd>
                    <ReportTd align="center">{s.guessedCount}</ReportTd>
                    <ReportTd align="center">{s.scoreRate.toFixed(1)}%</ReportTd>
                  </ReportTr>
                ))}
              </ReportTable>
            )}
          </ReportSection>

          <ReportSection title="문항별 정답률">
            <ReportTable
              headers={['번호', '정답', '배점', '정답', '오답', '미응답', '정답률', '찍음', '문항 특징']}
              compact
            >
              {qStats.map((s, i) => (
                <ReportTr key={s.q.id} stripedIndex={i} highlight={s.correctRate < 40 ? 'danger' : undefined}>
                  <ReportTd align="center">{s.q.question_number}</ReportTd>
                  <ReportTd align="center">{s.q.answer ?? '–'}</ReportTd>
                  <ReportTd align="center">{formatScoreValue(s.q.score)}</ReportTd>
                  <ReportTd align="center">{s.correctCount}</ReportTd>
                  <ReportTd align="center">{s.wrongCount}</ReportTd>
                  <ReportTd align="center">{s.blankCount}</ReportTd>
                  <ReportTd align="center">{s.correctRate.toFixed(1)}%</ReportTd>
                  <ReportTd align="center">{s.guessedCount}</ReportTd>
                  <ReportTd>{featureComment(s.q) ?? '–'}</ReportTd>
                </ReportTr>
              ))}
            </ReportTable>
          </ReportSection>

          {majorMap.size > 0 && (
            <ReportSection title="단원별 정답률">
              <GroupStatTable stats={[...majorMap.values()]} nameHeader="대단원" compact />
            </ReportSection>
          )}
        </div>
      </ReportPage>
    </>
  );
}

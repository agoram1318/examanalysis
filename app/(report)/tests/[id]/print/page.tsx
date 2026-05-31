'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchClassIdsForTest } from '@/lib/class-tests';
import {
  buildScoreDistribution,
  computeMedian,
  computePercentile,
  computeEstimatedGrade,
  generateTestWideComment,
} from '@/lib/test-wide-analysis';
import { formatReportDate, formatSubjectList, getQuestionSubjectName, scoreOrFallback, formatScoreValue } from '@/lib/report-utils';
import ReportPage from '@/components/reports/ReportPage';
import ReportHeader from '@/components/reports/ReportHeader';
import ReportSection from '@/components/reports/ReportSection';
import ReportTable, { ReportTd, ReportTr } from '@/components/reports/ReportTable';
import PrintToolbar from '@/components/reports/PrintToolbar';
import ReportSummaryGrid from '@/components/reports/ReportSummaryGrid';
import ReportComment from '@/components/reports/ReportComment';
import Button from '@/components/ui/Button';

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
  question_comment: string | null;
  subject_name: string | null;
};

type AnswerRow = {
  student_id: number;
  question_id: number;
  is_guessed: boolean;
  is_blank: boolean;
  is_correct: boolean;
  earned_score: number;
  selected_answer: string | null;
};

function featureComment(q: QuestionRow): string | null {
  const comment = q.question_comment?.trim();
  return comment || null;
}

export default function TestPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testIdStr } = use(params);
  const testId = Number(testIdStr);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [meta, setMeta] = useState<{ label: string; value: string }[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  useEffect(() => {
    if (isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      const { data: testRaw, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, total_questions')
        .eq('id', testId)
        .single();

      if (testErr || !testRaw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTestTitle(testRaw.title);
      const classIds = await fetchClassIdsForTest(testId);

      const { data: classesRaw } = classIds.length
        ? await supabase.from('classes').select('id, class_name, teacher_name, academy_name').in('id', classIds)
        : { data: [] };

      setClasses(classesRaw ?? []);

      const { data: questionsRaw } = await supabase
        .from('questions')
        .select('id, question_number, answer, score, question_comment, subjects:subject_id(name)')
        .eq('test_id', testId)
        .order('question_number');

      const questionCount = questionsRaw?.length ?? 0;
      const qs = (questionsRaw ?? []).map((q) => ({
        id: q.id,
        question_number: q.question_number,
        answer: q.answer,
        score: scoreOrFallback(q.score, questionCount),
        question_comment: q.question_comment ?? null,
        subject_name: getQuestionSubjectName(q.subjects),
      }));
      setQuestions(qs);

      setMeta([
        { label: '테스트명', value: testRaw.title },
        { label: '학년', value: testRaw.grade || '–' },
        { label: '과목', value: formatSubjectList(qs.map((q) => q.subject_name)) },
        { label: '총 문항 수', value: `${qs.length}문항` },
        { label: '부여된 반 수', value: `${(classesRaw ?? []).length}개` },
      ]);

      if (!classIds.length || !qs.length) {
        setLoading(false);
        return;
      }

      const { data: studentsRaw } = await supabase
        .from('students')
        .select('id, student_name, student_code, class_id')
        .in('class_id', classIds);

      const studentsData = studentsRaw ?? [];
      setStudents(studentsData);

      if (!studentsData.length) {
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
  }, [testId]);

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const totalPossible = questions.reduce((s, q) => s + q.score, 0);

  const completedStats = students
    .map((s) => {
      const answers = allAnswers.filter((a) => a.student_id === s.id);
      const totalScore = answers.reduce((sum, a) => sum + a.earned_score, 0);
      const correctCount = answers.filter((a) => a.is_correct).length;
      const blankCount = answers.filter((a) => a.is_blank || !a.selected_answer).length;
      const wrongCount = answers.length - correctCount - blankCount;
      const guessedCount = answers.filter((a) => a.is_guessed).length;
      const answeredCount = answers.filter((a) => !a.is_blank && a.selected_answer).length;
      const isComplete = answeredCount > 0 || totalScore > 0;
      return {
        student: s,
        cls: classMap.get(s.class_id),
        totalScore,
        correctCount,
        wrongCount,
        blankCount,
        guessedCount,
        scoreRate: totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0,
        isComplete,
      };
    })
    .filter((s) => s.isComplete);

  const scores = completedStats.map((s) => s.totalScore);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const avgRate = totalPossible > 0 ? (avgScore / totalPossible) * 100 : 0;
  const totalGuessed = allAnswers.filter((a) => a.is_guessed).length;
  const totalBlank = allAnswers.filter((a) => a.is_blank || !a.selected_answer).length;
  const avgGuessRateFixed = (() => {
    const rates = students
      .map((s) => {
        const answers = allAnswers.filter((a) => a.student_id === s.id);
        const answered = answers.filter((a) => !a.is_blank && a.selected_answer).length;
        const guessed = answers.filter((a) => a.is_guessed).length;
        return answered > 0 ? (guessed / answered) * 100 : null;
      })
      .filter((r): r is number => r !== null);
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  })();

  const scoreDistribution = buildScoreDistribution(scores);
  const maxDist = Math.max(...scoreDistribution.map((b) => b.count), 1);

  const ranked = [...completedStats]
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s, idx) => ({
      ...s,
      rank: idx + 1,
      percentile: computePercentile(scores, s.totalScore),
      estGrade: computeEstimatedGrade(computePercentile(scores, s.totalScore)),
    }));

  const classStats = classes.map((cls) => {
    const clsStudents = students.filter((s) => s.class_id === cls.id);
    const ids = new Set(clsStudents.map((s) => s.id));
    const clsCompleted = completedStats.filter((s) => ids.has(s.student.id));
    const clsScores = clsCompleted.map((s) => s.totalScore);
    const clsAvg = clsScores.length ? clsScores.reduce((a, b) => a + b, 0) / clsScores.length : 0;
    return {
      cls,
      count: clsStudents.length,
      avgScore: clsAvg,
      maxScore: clsScores.length ? Math.max(...clsScores) : 0,
      minScore: clsScores.length ? Math.min(...clsScores) : 0,
      avgRate: totalPossible > 0 ? (clsAvg / totalPossible) * 100 : 0,
    };
  });

  const qStats = questions.map((q) => {
    const ans = allAnswers.filter((a) => a.question_id === q.id);
    const correctCount = ans.filter((a) => a.is_correct).length;
    const blankCount = ans.filter((a) => a.is_blank || !a.selected_answer).length;
    const wrongCount = ans.length - correctCount - blankCount;
    const correctRate = students.length > 0 ? (correctCount / students.length) * 100 : 0;
    return { q, correctCount, wrongCount, blankCount, correctRate };
  });

  const comment =
    allAnswers.length > 0
      ? generateTestWideComment({
          avgRate,
          avgGuessRate: avgGuessRateFixed,
          highDiffRate: null,
          lowUnitNames: [],
          highGuessQuestionCount: 0,
        })
      : '';

  const today = formatReportDate();
  const backHref = `/tests/${testId}/analysis`;

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
        <p className="font-semibold mb-4">테스트를 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록</Button></Link>
      </div>
    );
  }

  return (
    <>
      <PrintToolbar backHref={backHref} backLabel="테스트 전체 분석으로" title="테스트 전체 인쇄용 리포트" />
      <ReportPage>
        <ReportHeader
          title="봉샘스쿨 테스트 전체 분석 리포트"
          subtitle={testTitle}
          highlight={`${classes.length}개 반`}
          highlightSub={`${students.length}명 응시`}
          meta={[
            ...meta,
            { label: '전체 응시', value: `${students.length}명` },
            { label: '답안 완료', value: `${completedStats.length}명` },
          ]}
          generatedAt={today}
        />
        <div className="report-page-body">
          <ReportSection title="전체 요약">
            <ReportSummaryGrid
              cards={[
                { label: '응시자 수', value: `${students.length}명` },
                { label: '완료자 수', value: `${completedStats.length}명` },
                { label: '평균 점수', value: `${formatScoreValue(avgScore)}점`, accent: true },
                { label: '최고점', value: `${formatScoreValue(scores.length ? Math.max(...scores) : 0)}점` },
                { label: '최저점', value: `${formatScoreValue(scores.length ? Math.min(...scores) : 0)}점` },
                { label: '중앙값', value: `${formatScoreValue(computeMedian(scores))}점` },
                { label: '평균 정답률', value: `${avgRate.toFixed(1)}%`, accent: true },
                { label: '전체 찍음', value: `${totalGuessed}개` },
                { label: '평균 찍음 비율', value: `${avgGuessRateFixed.toFixed(1)}%` },
                { label: '미응답', value: `${totalBlank}개` },
              ]}
            />
          </ReportSection>

          <ReportSection title="점수 분포">
            {scores.length === 0 ? (
              <p className="report-empty">분포 데이터 없음</p>
            ) : (
              <ReportTable headers={['구간', '인원', '비율', '분포']} compact>
                {scoreDistribution.map((band, i) => (
                  <ReportTr key={band.label} stripedIndex={i}>
                    <ReportTd>{band.label}</ReportTd>
                    <ReportTd align="center">{band.count}명</ReportTd>
                    <ReportTd align="center">{band.percentage.toFixed(1)}%</ReportTd>
                    <ReportTd>
                      <div className="report-dist-bar">
                        <div
                          className="report-dist-bar-fill"
                          style={{ width: `${(band.count / maxDist) * 100}%` }}
                        />
                      </div>
                    </ReportTd>
                  </ReportTr>
                ))}
              </ReportTable>
            )}
          </ReportSection>

          {comment && (
            <ReportSection title="테스트 전체 자동 코멘트">
              <ReportComment>{comment}</ReportComment>
            </ReportSection>
          )}

          <ReportSection title="반별 비교" pageBreakBefore>
            <ReportTable
              headers={['반명', '학원', '강사', '인원', '평균', '최고', '최저', '정답률']}
              compact
            >
              {classStats.map((c, i) => (
                <ReportTr key={c.cls.id} stripedIndex={i}>
                  <ReportTd>{c.cls.class_name || '–'}</ReportTd>
                  <ReportTd>{c.cls.academy_name || '–'}</ReportTd>
                  <ReportTd>{c.cls.teacher_name || '–'}</ReportTd>
                  <ReportTd align="center">{c.count}</ReportTd>
                  <ReportTd align="center">{formatScoreValue(c.avgScore)}</ReportTd>
                  <ReportTd align="center">{formatScoreValue(c.maxScore)}</ReportTd>
                  <ReportTd align="center">{formatScoreValue(c.minScore)}</ReportTd>
                  <ReportTd align="center">{c.avgRate.toFixed(1)}%</ReportTd>
                </ReportTr>
              ))}
            </ReportTable>
          </ReportSection>

          <ReportSection title="학생 전체 순위">
            <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
              추정 등급: 봉샘스쿨 내부 데이터 기준이며 실제 학교 내신 등급과 다를 수 있습니다.
            </p>
            <ReportTable
              headers={['순위', '학생', '반', '총점', '정답', '오답', '미응답', '찍음', '정답률', '백분위', '등급']}
              compact
            >
              {ranked.map((s, i) => (
                <ReportTr key={s.student.id} stripedIndex={i}>
                  <ReportTd align="center">{s.rank}</ReportTd>
                  <ReportTd>{s.student.student_name}</ReportTd>
                  <ReportTd>{s.cls?.class_name || '–'}</ReportTd>
                  <ReportTd align="center" className="font-semibold">{formatScoreValue(s.totalScore)}</ReportTd>
                  <ReportTd align="center">{s.correctCount}</ReportTd>
                  <ReportTd align="center">{s.wrongCount}</ReportTd>
                  <ReportTd align="center">{s.blankCount}</ReportTd>
                  <ReportTd align="center">{s.guessedCount}</ReportTd>
                  <ReportTd align="center">{s.scoreRate.toFixed(1)}%</ReportTd>
                  <ReportTd align="center">{s.percentile.toFixed(1)}</ReportTd>
                  <ReportTd align="center">{s.estGrade}</ReportTd>
                </ReportTr>
              ))}
            </ReportTable>
          </ReportSection>

          <ReportSection title="문항별 전체 정답률">
            <ReportTable headers={['번호', '정답', '배점', '정답', '오답', '미응답', '정답률', '문항 특징']} compact>
              {qStats.map((s, i) => (
                <ReportTr key={s.q.id} stripedIndex={i} highlight={s.correctRate < 40 ? 'danger' : undefined}>
                  <ReportTd align="center">{s.q.question_number}</ReportTd>
                  <ReportTd align="center">{s.q.answer ?? '–'}</ReportTd>
                  <ReportTd align="center">{formatScoreValue(s.q.score)}</ReportTd>
                  <ReportTd align="center">{s.correctCount}</ReportTd>
                  <ReportTd align="center">{s.wrongCount}</ReportTd>
                  <ReportTd align="center">{s.blankCount}</ReportTd>
                  <ReportTd align="center">{s.correctRate.toFixed(1)}%</ReportTd>
                  <ReportTd>{featureComment(s.q) ?? '–'}</ReportTd>
                </ReportTr>
              ))}
            </ReportTable>
          </ReportSection>
        </div>
      </ReportPage>
    </>
  );
}

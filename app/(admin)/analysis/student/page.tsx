'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Printer, BarChart3, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import {
  getTests, getTestById, getQuestionsByTest, getStudentsByClass,
  getAnswersByStudentAndTest, getAnswersByTest
} from '@/lib/store';
import { buildStudentAnalysis, getGrade, getAccuracyBadge } from '@/lib/analysis';
import { StudentAnalysis, Test, Student } from '@/lib/types';
import { formatDate, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';

function StudentAnalysisContent() {
  const searchParams = useSearchParams();
  const initTestId = searchParams.get('testId') ?? '';
  const initStudentId = searchParams.get('studentId') ?? '';

  const [selectedTestId, setSelectedTestId] = useState(initTestId);
  const [selectedStudentId, setSelectedStudentId] = useState(initStudentId);
  const [analysis, setAnalysis] = useState<StudentAnalysis | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const tests = getTests();

  useEffect(() => {
    if (!selectedTestId) return;
    const t = getTestById(selectedTestId);
    if (!t) return;
    const s = getStudentsByClass(t.class_id);
    setStudents(s);
    if (!selectedStudentId && s.length > 0) setSelectedStudentId(s[0].id);
  }, [selectedTestId]);

  useEffect(() => {
    if (!selectedTestId || !selectedStudentId) { setAnalysis(null); return; }
    const test = getTestById(selectedTestId);
    if (!test) return;
    const questions = getQuestionsByTest(selectedTestId);
    const myAnswers = getAnswersByStudentAndTest(selectedStudentId, selectedTestId);
    if (myAnswers.length === 0) { setAnalysis(null); return; }
    const allAnswers = getAnswersByTest(selectedTestId);
    const allStudents = getStudentsByClass(test.class_id);
    const student = allStudents.find(s => s.id === selectedStudentId);
    if (!student) return;

    const result = buildStudentAnalysis(student, test, questions, myAnswers, allAnswers, allStudents);
    setAnalysis(result);
  }, [selectedTestId, selectedStudentId]);

  const handlePrint = () => window.print();

  const radarData = analysis?.chapter_scores
    .filter(cs => cs.chapter)
    .slice(0, 6)
    .map(cs => ({
      subject: cs.chapter.name.length > 6 ? cs.chapter.name.slice(0, 6) + '…' : cs.chapter.name,
      accuracy: Math.round(cs.accuracy),
      fullMark: 100,
    })) ?? [];

  const questionBarData = analysis?.answers.map(a => ({
    name: `${a.question.number}번`,
    score: a.score_earned,
    max: a.question.score,
    correct: a.is_correct,
  })) ?? [];

  return (
    <div className="space-y-4">
      {/* 선택 영역 */}
      <div className="no-print">
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4">
              <Select
                label="테스트 선택"
                value={selectedTestId}
                onChange={e => setSelectedTestId(e.target.value)}
                options={tests.map(t => ({ value: t.id, label: t.title }))}
                placeholder="테스트 선택"
              />
              <Select
                label="학생 선택"
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                options={students.map(s => ({ value: s.id, label: s.name }))}
                placeholder="학생 선택"
              />
              <div className="flex items-end">
                <Button variant="outline" onClick={handlePrint} className="w-full">
                  <Printer size={16} /> 인쇄 / PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!analysis ? (
        <Card>
          <CardContent className="text-center py-16 text-slate-400">
            <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
            {!selectedTestId
              ? <p>테스트를 선택해주세요</p>
              : !selectedStudentId
              ? <p>학생을 선택해주세요</p>
              : <p>해당 학생의 답안 데이터가 없습니다. 답안을 먼저 입력해주세요.</p>
            }
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" id="print-area">
          {/* 헤더 리포트 */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">봉샘스쿨 개인 성적 분석표</p>
                <h2 className="text-2xl font-bold">{analysis.student.name}</h2>
                <p className="text-slate-300 mt-1">
                  {analysis.test.title} · {formatDate(analysis.test.test_date)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-white">{analysis.total_score}</div>
                <div className="text-slate-300 text-sm">/ {analysis.test.total_score}점</div>
                <div className="mt-1">
                  <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full font-bold">
                    {getGrade(analysis.percentage)}등급
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-700">
              <div>
                <p className="text-slate-400 text-xs">정답률</p>
                <p className="text-white font-bold text-lg">{formatPercentage(analysis.percentage)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">반 등수</p>
                <p className="text-white font-bold text-lg">{analysis.rank}등 / {analysis.total_students}명</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">맞은 문항</p>
                <p className="text-white font-bold text-lg">
                  {analysis.answers.filter(a => a.is_correct).length}개 / {analysis.answers.length}개
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">등급</p>
                <p className="text-white font-bold text-lg">{getGrade(analysis.percentage)}등급</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 문항별 채점 결과 */}
            <Card>
              <CardHeader><CardTitle>문항별 채점 결과</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-1.5">
                  {analysis.answers.map(a => {
                    const correct = a.is_correct;
                    const empty = a.answer.trim() === '';
                    return (
                      <div
                        key={a.question_id}
                        className={cn(
                          'flex flex-col items-center justify-center p-2 rounded-lg border text-xs',
                          correct ? 'bg-green-50 border-green-200' :
                          empty ? 'bg-slate-50 border-slate-200' :
                          'bg-red-50 border-red-200'
                        )}
                      >
                        <span className="font-bold text-slate-600">{a.question.number}</span>
                        <span className={cn(
                          'font-medium',
                          correct ? 'text-green-600' : empty ? 'text-slate-400' : 'text-red-600'
                        )}>
                          {correct ? '○' : empty ? '-' : '✗'}
                        </span>
                        <span className="text-slate-400">{a.question.score}점</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded inline-block"></span>정답</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded inline-block"></span>오답</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-100 border border-slate-300 rounded inline-block"></span>미작성</span>
                </div>
              </CardContent>
            </Card>

            {/* 단원별 분석 레이더 차트 */}
            <Card>
              <CardHeader><CardTitle>단원별 이해도</CardTitle></CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <Radar dataKey="accuracy" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm">단원 정보가 없습니다</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 단원별 성취도 상세 */}
          <Card>
            <CardHeader><CardTitle>단원별 성취도 분석</CardTitle></CardHeader>
            <CardContent>
              {analysis.chapter_scores.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">단원 연결 정보가 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {analysis.chapter_scores.map(cs => {
                    const badge = getAccuracyBadge(cs.accuracy);
                    return (
                      <div key={cs.chapter.id} className="flex items-center gap-4">
                        <div className="w-40 shrink-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{cs.chapter.name}</p>
                          <p className="text-xs text-slate-400">{cs.total_questions}문항</p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div
                                className={cn(
                                  'h-2 rounded-full transition-all',
                                  cs.accuracy >= 80 ? 'bg-blue-500' :
                                  cs.accuracy >= 60 ? 'bg-green-500' :
                                  cs.accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                )}
                                style={{ width: `${cs.accuracy}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-700 w-10 text-right">
                              {Math.round(cs.accuracy)}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {cs.correct_questions}/{cs.total_questions} 정답 · {cs.score_earned}/{cs.max_score}점
                          </p>
                        </div>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', badge.color)}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {/* 취약 단원 */}
            {analysis.weak_chapters.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingDown size={18} className="text-red-500" />
                    <CardTitle className="text-red-700">집중 보완 필요 단원</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.weak_chapters.map(c => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-red-700">
                        <XCircle size={14} className="text-red-500 shrink-0" />
                        {c.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-red-500">
                    위 단원들은 정답률 70% 미만으로 집중 학습이 필요합니다.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 강점 단원 */}
            {analysis.strong_chapters.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-500" />
                    <CardTitle className="text-blue-700">강점 단원</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.strong_chapters.map(c => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-blue-700">
                        <CheckCircle size={14} className="text-blue-500 shrink-0" />
                        {c.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-blue-500">
                    위 단원들은 정답률 80% 이상으로 잘 이해하고 있습니다.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 상담 메모 */}
          <Card className="no-print">
            <CardHeader>
              <CardTitle>강사용 상담 메모 (인쇄 포함 안 됨)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                placeholder="학생 상담 시 활용할 메모를 입력하세요..."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function StudentAnalysisPage() {
  return (
    <Suspense>
      <StudentAnalysisContent />
    </Suspense>
  );
}

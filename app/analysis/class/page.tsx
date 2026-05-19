'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Printer, BarChart3, TrendingUp, TrendingDown, Users, Award } from 'lucide-react';
import {
  getTests, getTestById, getQuestionsByTest, getAnswersByTest, getClasses
} from '@/lib/store';
import { buildClassAnalysis, getGrade, getAccuracyBadge } from '@/lib/analysis';
import { ClassAnalysis } from '@/lib/types';
import { formatDate, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  PieChart, Pie, Legend
} from 'recharts';

const SCORE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4'];

function ClassAnalysisContent() {
  const searchParams = useSearchParams();
  const initTestId = searchParams.get('testId') ?? '';

  const [selectedTestId, setSelectedTestId] = useState(initTestId);
  const [analysis, setAnalysis] = useState<ClassAnalysis | null>(null);

  const tests = getTests();
  const classes = getClasses();

  useEffect(() => {
    if (!selectedTestId) return;
    const test = getTestById(selectedTestId);
    if (!test) return;
    const questions = getQuestionsByTest(selectedTestId);
    const allAnswers = getAnswersByTest(selectedTestId);
    if (allAnswers.length === 0) { setAnalysis(null); return; }
    const cls = classes.find(c => c.id === test.class_id);
    if (!cls) return;
    const result = buildClassAnalysis(test, cls, questions, allAnswers);
    setAnalysis(result);
  }, [selectedTestId]);

  const handlePrint = () => window.print();

  // 문항별 정답률 차트 (낮은 순 정렬)
  const questionAccuracyData = analysis?.question_stats
    .sort((a, b) => a.accuracy - b.accuracy)
    .map(qs => ({
      name: `${qs.question.number}번`,
      정답률: Math.round(qs.accuracy),
      color: qs.accuracy < 40 ? '#ef4444' : qs.accuracy < 70 ? '#f97316' : '#22c55e',
    })) ?? [];

  // 점수 분포 차트
  const distData = analysis?.score_distribution.map(d => ({
    name: d.range,
    명수: d.count,
  })) ?? [];

  return (
    <div className="space-y-4">
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
              : <p>해당 테스트의 답안 데이터가 없습니다. 답안을 먼저 입력해주세요.</p>
            }
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-6">
            <p className="text-slate-400 text-sm mb-1">봉샘스쿨 반 전체 성적 분석표</p>
            <h2 className="text-2xl font-bold">{analysis.test.title}</h2>
            <p className="text-slate-300 mt-1">{analysis.class.name} · {formatDate(analysis.test.test_date)}</p>
            <div className="grid grid-cols-5 gap-4 mt-5 pt-4 border-t border-slate-700">
              <div>
                <p className="text-slate-400 text-xs">응시 인원</p>
                <p className="text-white font-bold text-xl">{analysis.total_students}명</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">평균 점수</p>
                <p className="text-white font-bold text-xl">{Math.round(analysis.average_score)}점</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">평균 정답률</p>
                <p className="text-white font-bold text-xl">{formatPercentage(analysis.average_percentage)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">최고점</p>
                <p className="text-white font-bold text-xl">{analysis.max_score}점</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">최저점</p>
                <p className="text-white font-bold text-xl">{analysis.min_score}점</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 점수 분포 */}
            <Card>
              <CardHeader><CardTitle>점수 분포</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={distData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v}명`, '인원']} />
                    <Bar dataKey="명수" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 문항별 정답률 (낮은 순 TOP10) */}
            <Card>
              <CardHeader>
                <CardTitle>오답률 높은 문항 TOP 10</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.question_stats
                    .sort((a, b) => a.accuracy - b.accuracy)
                    .slice(0, 10)
                    .map((qs, idx) => {
                      const badge = getAccuracyBadge(qs.accuracy);
                      return (
                        <div key={qs.question.id} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                          <span className="text-sm font-medium text-slate-700 w-10">{qs.question.number}번</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div
                              className={cn(
                                'h-2 rounded-full',
                                qs.accuracy < 40 ? 'bg-red-500' : qs.accuracy < 70 ? 'bg-yellow-500' : 'bg-green-500'
                              )}
                              style={{ width: `${qs.accuracy}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold w-10 text-right text-slate-700">
                            {Math.round(qs.accuracy)}%
                          </span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', badge.color)}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 학생별 순위표 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>학생별 성적 순위</CardTitle>
                <Badge variant="info">{analysis.total_students}명</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-12">순위</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">이름</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">점수</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">정답률</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">등급</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">평균 대비</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 text-right">개인분석</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.student_results.map(sr => {
                      const diff = sr.total_score - analysis.average_score;
                      return (
                        <tr key={sr.student.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            {sr.rank <= 3 ? (
                              <span className={cn(
                                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                                sr.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                sr.rank === 2 ? 'bg-slate-100 text-slate-600' :
                                'bg-orange-100 text-orange-700'
                              )}>
                                {sr.rank}
                              </span>
                            ) : (
                              <span className="text-slate-500">{sr.rank}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{sr.student.name}</td>
                          <td className="px-4 py-3 font-bold text-slate-800">{sr.total_score}점</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className={cn(
                                    'h-1.5 rounded-full',
                                    sr.percentage >= 80 ? 'bg-blue-500' :
                                    sr.percentage >= 60 ? 'bg-green-500' :
                                    sr.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${sr.percentage}%` }}
                                />
                              </div>
                              <span className="font-medium">{formatPercentage(sr.percentage)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={sr.percentage >= 80 ? 'info' : sr.percentage >= 60 ? 'success' : sr.percentage >= 40 ? 'warning' : 'danger'}>
                              {getGrade(sr.percentage)}등급
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-sm font-medium',
                              diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'
                            )}>
                              {diff > 0 ? '+' : ''}{Math.round(diff)}점
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/analysis/student?testId=${selectedTestId}&studentId=${sr.student.id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              분석보기 →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 단원별 반 평균 성취도 */}
          {analysis.chapter_stats.length > 0 && (
            <Card>
              <CardHeader><CardTitle>단원별 반 평균 성취도</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.chapter_stats
                    .sort((a, b) => a.average_accuracy - b.average_accuracy)
                    .map(cs => {
                      const badge = getAccuracyBadge(cs.average_accuracy);
                      return (
                        <div key={cs.chapter.id} className="flex items-center gap-4">
                          <div className="w-40 shrink-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{cs.chapter.name}</p>
                            <p className="text-xs text-slate-400">{cs.total_questions}문항</p>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-2">
                                <div
                                  className={cn(
                                    'h-2 rounded-full',
                                    cs.average_accuracy >= 80 ? 'bg-blue-500' :
                                    cs.average_accuracy >= 60 ? 'bg-green-500' :
                                    cs.average_accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${cs.average_accuracy}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-slate-700 w-10 text-right">
                                {Math.round(cs.average_accuracy)}%
                              </span>
                            </div>
                          </div>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', badge.color)}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClassAnalysisPage() {
  return (
    <Suspense>
      <ClassAnalysisContent />
    </Suspense>
  );
}

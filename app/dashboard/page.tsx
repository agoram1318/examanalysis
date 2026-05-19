'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ClipboardList, Users, GraduationCap, BarChart3, ArrowRight, TrendingUp, BookOpen } from 'lucide-react';
import { getTests, getStudents, getClasses, getAnswersByTest } from '@/lib/store';
import { Test, Student, Class } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    setTests(getTests());
    setStudents(getStudents());
    setClasses(getClasses());
  }, []);

  const recentTests = tests.slice(-5).reverse();

  const stats = [
    {
      label: '전체 테스트',
      value: tests.length,
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-50',
      href: '/tests',
    },
    {
      label: '전체 학생',
      value: students.length,
      icon: Users,
      color: 'text-green-600 bg-green-50',
      href: '/students',
    },
    {
      label: '운영 반',
      value: classes.length,
      icon: GraduationCap,
      color: 'text-purple-600 bg-purple-50',
      href: '/classes',
    },
    {
      label: '분석 가능',
      value: tests.filter(t => {
        const answers = getAnswersByTest(t.id);
        return answers.length > 0;
      }).length,
      icon: BarChart3,
      color: 'text-orange-600 bg-orange-50',
      href: '/analysis/student',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 환영 배너 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={24} />
          <h2 className="text-xl font-bold">봉샘스쿨 테스트 분석 시스템</h2>
        </div>
        <p className="text-blue-100 text-sm">
          수학 테스트 자동 채점 후 학생별 분석 리포트와 강사용 상담 자료를 생성합니다.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/tests/new"
            className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            새 테스트 만들기
          </Link>
          <Link
            href="/answers"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-400 transition-colors border border-blue-400"
          >
            답안 입력하기
          </Link>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon size={22} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 최근 테스트 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>최근 테스트</CardTitle>
              <Link href="/tests" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                전체보기 <ArrowRight size={14} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTests.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">아직 테스트가 없습니다</p>
                <Link href="/tests/new" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                  + 테스트 만들기
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTests.map(test => {
                  const cls = classes.find(c => c.id === test.class_id);
                  const answers = getAnswersByTest(test.id);
                  const hasAnswers = answers.length > 0;
                  return (
                    <div key={test.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{test.title}</p>
                        <p className="text-xs text-slate-400">{cls?.name} · {formatDate(test.test_date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasAnswers ? (
                          <Link
                            href={`/analysis/class?testId=${test.id}`}
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 transition-colors"
                          >
                            분석보기
                          </Link>
                        ) : (
                          <Link
                            href={`/answers?testId=${test.id}`}
                            className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            답안입력
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 빠른 메뉴 */}
        <Card>
          <CardHeader>
            <CardTitle>빠른 메뉴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '테스트 생성', href: '/tests/new', icon: ClipboardList, desc: '새 테스트 문항 입력', color: 'border-blue-200 hover:bg-blue-50' },
                { label: '답안 입력', href: '/answers', icon: TrendingUp, desc: '학생 답안 수동 입력', color: 'border-green-200 hover:bg-green-50' },
                { label: '학생별 분석', href: '/analysis/student', icon: Users, desc: '개인 분석표 생성', color: 'border-purple-200 hover:bg-purple-50' },
                { label: '반 전체 분석', href: '/analysis/class', icon: BarChart3, desc: '반 성적 분포 분석', color: 'border-orange-200 hover:bg-orange-50' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border rounded-xl p-4 transition-colors ${item.color}`}
                >
                  <item.icon size={20} className="text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

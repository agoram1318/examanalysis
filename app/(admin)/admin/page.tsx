'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ClipboardList, GraduationCap, Users, BarChart3,
  ArrowRight, ClipboardCheck, PenLine, ListChecks,
  FileBarChart, BookMarked, ChevronRight, TrendingUp,
} from 'lucide-react';
import { getTests, getStudents, getClasses, getAnswersByTest } from '@/lib/store';
import { Test, Student, Class } from '@/lib/types';
import { formatDate } from '@/lib/utils';

// ── 통계 카드 데이터 타입
type StatCard = {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  accent?: boolean;
};

// ── 메뉴 카드 데이터 타입
type MenuCard = {
  label: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tag?: string;
};

const MENUS: MenuCard[] = [
  {
    icon: ClipboardList,
    label: '테스트 등록',
    desc: '테스트명, 학교명, 학년, 과목, 시험 범위를 등록합니다.',
    href: '/tests/new',
  },
  {
    icon: ListChecks,
    label: '문항 정보 입력',
    desc: '문항별 정답, 배점, 단원, 유형, 난이도를 입력합니다.',
    href: '/tests',
    tag: '문항 관리',
  },
  {
    icon: Users,
    label: '반 / 학생 등록',
    desc: '강사명, 학원명, 반명을 설정하고 학생을 등록합니다.',
    href: '/students',
  },
  {
    icon: PenLine,
    label: '답안 입력',
    desc: '학생별 문항 답안, 찍음 여부, 미응답을 입력합니다.',
    href: '/answers',
    tag: '핵심',
  },
  {
    icon: FileBarChart,
    label: '학생별 분석표',
    desc: '단원·유형·난이도별 성취도와 자동 코멘트를 생성합니다.',
    href: '/analysis/student',
  },
  {
    icon: BarChart3,
    label: '반 전체 분석표',
    desc: '오답 TOP5, 찍음 비율, 단원별 정답률을 분석합니다.',
    href: '/analysis/class',
  },
];

export default function AdminDashboardPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const t = getTests();
    const s = getStudents();
    const c = getClasses();
    setTests(t);
    setStudents(s);
    setClasses(c);
    setCompletedCount(
      t.filter((test) => getAnswersByTest(test.id).length > 0).length
    );
  }, []);

  const STATS: StatCard[] = [
    {
      icon: ClipboardList,
      label: '등록된 테스트',
      value: tests.length,
      sub: '총 테스트 수',
    },
    {
      icon: GraduationCap,
      label: '분석 중인 반',
      value: classes.length,
      sub: '운영 반 수',
    },
    {
      icon: Users,
      label: '등록 학생 수',
      value: students.length,
      sub: '전체 학생',
    },
    {
      icon: ClipboardCheck,
      label: '완료된 분석',
      value: completedCount,
      sub: '채점 완료 테스트',
      accent: true,
    },
  ];

  const recentTests = [...tests].reverse().slice(0, 5);

  return (
    <div className="space-y-7">

      {/* ── 페이지 헤더 ── */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--fg-main)' }}>
          봉샘스쿨 테스트 분석표 생성기
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-sub)' }}>
          수학 테스트 답안을 바탕으로 학생별 분석표와 반 전체 분석표를 생성하는 관리자용 프로그램
        </p>
      </div>

      {/* ── 통계 카드 4개 ── */}
      <div className="grid grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-5 border"
            style={{
              background: s.accent ? 'var(--accent)' : 'var(--bg-card)',
              borderColor: s.accent ? 'var(--accent)' : 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{
                  background: s.accent ? 'rgba(255,255,255,0.2)' : 'var(--accent-lt)',
                }}
              >
                <s.icon
                  size={18}
                  style={{ color: s.accent ? '#fff' : 'var(--accent)' }}
                />
              </div>
            </div>
            <p
              className="text-3xl font-black"
              style={{ color: s.accent ? '#fff' : 'var(--fg-main)' }}
            >
              {s.value}
            </p>
            <p
              className="text-sm font-semibold mt-0.5"
              style={{ color: s.accent ? 'rgba(255,255,255,0.9)' : 'var(--fg-main)' }}
            >
              {s.label}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: s.accent ? 'rgba(255,255,255,0.6)' : 'var(--fg-muted)' }}
            >
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── 주요 메뉴 카드 6개 + 최근 테스트 ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* 메뉴 카드 6개 (2×3 그리드로 왼쪽 2열 차지) */}
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {MENUS.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="group relative rounded-xl p-5 border transition-all hover:border-orange-300"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              {/* 태그 */}
              {menu.tag && (
                <span
                  className="absolute top-4 right-4 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                >
                  {menu.tag}
                </span>
              )}

              {/* 아이콘 */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-colors group-hover:bg-orange-100"
                style={{ background: 'var(--accent-lt)' }}
              >
                <menu.icon size={18} style={{ color: 'var(--accent)' }} />
              </div>

              {/* 텍스트 */}
              <p className="font-semibold text-sm mb-1.5" style={{ color: 'var(--fg-main)' }}>
                {menu.label}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-sub)' }}>
                {menu.desc}
              </p>

              {/* 화살표 */}
              <div
                className="flex items-center gap-1 mt-4 text-xs font-semibold transition-colors group-hover:text-orange-500"
                style={{ color: 'var(--fg-muted)' }}
              >
                바로가기 <ChevronRight size={12} />
              </div>
            </Link>
          ))}
        </div>

        {/* 최근 테스트 패널 */}
        <div
          className="rounded-xl border flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="font-semibold text-sm" style={{ color: 'var(--fg-main)' }}>
              최근 테스트
            </span>
            <Link
              href="/tests"
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              전체보기 <ArrowRight size={12} />
            </Link>
          </div>

          <div className="flex-1 flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentTests.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 px-5 text-center">
                <ClipboardList size={28} className="mb-2 opacity-20" style={{ color: 'var(--fg-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  아직 테스트가 없습니다
                </p>
                <Link
                  href="/tests/new"
                  className="mt-3 text-xs font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  + 테스트 만들기
                </Link>
              </div>
            ) : (
              recentTests.map((test) => {
                const cls = classes.find((c) => c.id === test.class_id);
                const answered = getAnswersByTest(test.id).length > 0;
                return (
                  <div key={test.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div
                      className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                      style={{ background: answered ? 'var(--accent)' : 'var(--border)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--fg-main)' }}
                      >
                        {test.title}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--fg-muted)' }}>
                        {cls?.name ?? '반 미지정'} · {formatDate(test.test_date)}
                      </p>
                    </div>
                    <Link
                      href={answered ? `/analysis/class?testId=${test.id}` : `/answers?testId=${test.id}`}
                      className="shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors hover:opacity-80"
                      style={
                        answered
                          ? { background: 'var(--accent-lt)', color: 'var(--accent)' }
                          : { background: '#f1f5f9', color: 'var(--fg-sub)' }
                      }
                    >
                      {answered ? '분석' : '입력'}
                    </Link>
                  </div>
                );
              })
            )}
          </div>

          {/* 빠른 실행 */}
          <div
            className="px-5 py-4 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <Link
              href="/tests/new"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              <ClipboardList size={15} />
              새 테스트 등록하기
            </Link>
          </div>
        </div>
      </div>

      {/* ── 워크플로 안내 ── */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
            분석표 생성 워크플로
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { step: '1', label: '테스트 등록', href: '/tests/new' },
            { step: '2', label: '문항 정보 입력', href: '/tests' },
            { step: '3', label: '학생 등록', href: '/students' },
            { step: '4', label: '답안 입력', href: '/answers' },
            { step: '5', label: '분석표 생성', href: '/analysis/student' },
          ].map((item, i, arr) => (
            <div key={item.step} className="flex items-center gap-2">
              <Link
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all hover:border-orange-300 hover:shadow-sm"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--fg-main)' }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  {item.step}
                </span>
                {item.label}
              </Link>
              {i < arr.length - 1 && (
                <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

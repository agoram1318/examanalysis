'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Users, PenLine, BarChart3,
  ChevronRight, AlertCircle, Loader2, GraduationCap, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchClassIdsForTest } from '@/lib/class-tests';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  total_questions: number;
};

type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
  created_at: string;
  student_count: number;
};

// ─────────────────────────────────────────────
// 페이지
// ─────────────────────────────────────────────
export default function TestClassesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: testIdStr } = use(params);
  const testId = Number(testIdStr);

  const [test, setTest]       = useState<TestRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNaN(testId)) { setNotFound(true); setLoading(false); return; }

    async function load() {
      // 테스트 정보
      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, total_questions')
        .eq('id', testId)
        .single();

      if (testErr || !testData) { setNotFound(true); setLoading(false); return; }
      setTest(testData);

      const classIds = await fetchClassIdsForTest(testId);
      if (classIds.length === 0) {
        setClasses([]);
        setLoading(false);
        return;
      }

      const { data: classesRaw } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name, created_at')
        .in('id', classIds)
        .order('created_at', { ascending: false });

      const rawList = classesRaw ?? [];

      // 각 반의 학생 수 병렬 조회
      const withCounts = await Promise.all(
        rawList.map(async (cls) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);
          return { ...cls, student_count: count ?? 0 };
        })
      );

      setClasses(withCounts);
      setLoading(false);
    }

    load();
  }, [testId]);

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>테스트를 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록으로</Button></Link>
      </div>
    );
  }

  const meta = test.grade ?? '';

  return (
    <div>
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3">
          <Link href="/tests">
            <Button variant="ghost" size="sm"><ArrowLeft size={15} /> 테스트 목록</Button>
          </Link>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{test.title}</span>
              <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
              <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>반 목록</span>
            </div>
            {meta && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{meta}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/tests/${testId}/questions`}>
            <Button variant="outline" size="sm">
              <PenLine size={14} /> 문항 입력
            </Button>
          </Link>
          <Link href={`/tests/${testId}/assign-classes`}>
            <Button variant="outline" size="sm">
              <Plus size={14} /> 반에 일괄 부여
            </Button>
          </Link>
          <Link href={`/tests/${testId}/analysis`}>
            <Button variant="outline" size="sm">
              <TrendingUp size={14} /> 테스트 전체 분석
            </Button>
          </Link>
          <Link href={`/tests/${testId}/classes/new`}>
            <Button variant="accent" size="sm">
              <Plus size={14} /> 새 반 생성
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 테스트 요약 바 ── */}
      <div
        className="rounded-xl border px-5 py-3 mb-4 flex flex-wrap gap-x-6 gap-y-1"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {[
          { label: '테스트명',  value: test.title },
          { label: '총 문항',   value: `${test.total_questions}문항` },
          { label: '등록된 반', value: `${classes.length}개` },
          { label: '전체 학생', value: `${classes.reduce((s, c) => s + c.student_count, 0)}명` },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
            <span className="font-medium" style={{ color: 'var(--fg-main)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* ── 반 목록 ── */}
      {classes.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <GraduationCap size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--fg-main)' }}>
            아직 생성된 반이 없습니다.
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
            이 테스트에 반을 추가해 학생 등록과 답안 입력을 시작하세요.
          </p>
          <Link href={`/tests/${testId}/classes/new`}>
            <Button variant="accent" size="sm">
              <Plus size={14} /> 반 생성하기
            </Button>
          </Link>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-base)' }}>
              <tr>
                {['반명', '강사명', '학원명', '학생 수', '생성일', ''].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap"
                    style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((cls, i) => (
                <tr
                  key={cls.id}
                  style={{
                    background: i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <td className="px-5 py-3">
                    <span className="font-semibold text-sm" style={{ color: 'var(--fg-main)' }}>
                      {cls.class_name || '–'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                    {cls.teacher_name || '–'}
                  </td>
                  <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                    {cls.academy_name || '–'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        background: cls.student_count > 0 ? 'var(--accent-lt)' : 'var(--bg-base)',
                        color: cls.student_count > 0 ? 'var(--accent)' : 'var(--fg-muted)',
                      }}
                    >
                      <Users size={12} />
                      {cls.student_count}명
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {formatDate(cls.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/classes/${cls.id}/students`}>
                        <Button size="sm" variant="ghost">
                          <Users size={13} /> 학생 등록
                        </Button>
                      </Link>
                      <Link href={`/classes/${cls.id}/tests/${testId}/answers`}>
                        <Button size="sm" variant="outline">
                          <PenLine size={13} /> 답안 입력
                        </Button>
                      </Link>
                      <Link href={`/classes/${cls.id}/tests/${testId}/analysis`}>
                        <Button size="sm" variant="accent">
                          <BarChart3 size={13} /> 전체 분석
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

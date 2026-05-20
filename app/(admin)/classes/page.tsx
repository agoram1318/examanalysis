'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap, Plus, Users, PenLine, BarChart3,
  Loader2, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

type TestOption = {
  id: number;
  title: string;
  grade: string | null;
  subjects: { name: string } | null;
};

type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
  created_at: string;
  test_id: number;
  tests: {
    title: string;
    grade: string | null;
    subjects: { name: string } | null;
  } | null;
  student_count: number;
};

export default function ClassesPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [classesRes, testsRes] = await Promise.all([
        supabase
          .from('classes')
          .select(
            'id, class_name, teacher_name, academy_name, created_at, test_id, tests(title, grade, subjects(name))'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('tests')
          .select('id, title, grade, subjects(name)')
          .order('created_at', { ascending: false }),
      ]);

      const rawList = classesRes.data ?? [];
      const withCounts: ClassRow[] = await Promise.all(
        rawList.map(async (cls) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);
          const row = cls as unknown as ClassRow;
          return { ...row, student_count: count ?? 0 };
        })
      );

      setClasses(withCounts);
      setTests((testsRes.data ?? []) as unknown as TestOption[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleCreateClass = () => {
    if (!selectedTestId) return;
    router.push(`/tests/${selectedTestId}/classes/new`);
  };

  const testOptions = tests.map((t) => {
    const meta = [t.grade, t.subjects?.name].filter(Boolean).join(' · ');
    return {
      value: String(t.id),
      label: meta ? `${t.title} (${meta})` : t.title,
    };
  });

  return (
    <div className="space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>
            반 관리
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {loading ? '–' : `총 ${classes.length}개 반`}
          </p>
        </div>
      </div>

      {/* ── 새 반 생성 ── */}
      <div
        className="rounded-xl border px-5 py-4 flex flex-wrap items-end gap-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {tests.length === 0 ? (
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: 'var(--fg-sub)' }}>
              반을 만들려면 먼저 테스트를 등록해야 합니다.
            </p>
            <Link href="/tests/new" className="inline-block mt-2">
              <Button variant="accent" size="sm">
                <ClipboardList size={14} /> 테스트 등록하기
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-[240px] max-w-md">
              <Select
                label="반 생성할 테스트 선택"
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                options={testOptions}
                placeholder="테스트를 선택해주세요"
              />
            </div>
            <Button
              variant="accent"
              onClick={handleCreateClass}
              disabled={!selectedTestId}
            >
              <Plus size={16} /> 새 반 생성
            </Button>
          </>
        )}
      </div>

      {/* ── 로딩 ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
        </div>
      ) : classes.length === 0 ? (
        <div
          className="rounded-xl border py-20 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <GraduationCap
            size={44}
            className="mx-auto mb-3 opacity-20"
            style={{ color: 'var(--fg-muted)' }}
          />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg-main)' }}>
            아직 생성된 반이 없습니다.
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
            먼저 테스트를 선택한 뒤 새 반을 생성해 주세요.
          </p>
          {tests.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              상단에서 테스트를 선택하고 &quot;새 반 생성&quot; 버튼을 눌러주세요.
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead style={{ background: 'var(--bg-base)' }}>
                <tr>
                  {[
                    '반명',
                    '학원명',
                    '강사명',
                    '연결 테스트명',
                    '학년',
                    '과목',
                    '학생 수',
                    '생성일',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap"
                      style={{
                        color: 'var(--fg-muted)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((cls, i) => {
                  const test = cls.tests;
                  return (
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
                        {cls.academy_name || '–'}
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                        {cls.teacher_name || '–'}
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-main)' }}>
                        <Link
                          href={`/tests/${cls.test_id}/classes`}
                          className="hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          {test?.title ?? '–'}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                        {test?.grade || '–'}
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                        {test?.subjects?.name || '–'}
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
                      <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--fg-muted)' }}>
                        {formatDate(cls.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          <Link href={`/classes/${cls.id}/students`}>
                            <Button size="sm" variant="ghost">
                              <Users size={13} /> 학생 관리
                            </Button>
                          </Link>
                          <Link href={`/classes/${cls.id}/answers`}>
                            <Button size="sm" variant="outline">
                              <PenLine size={13} /> 답안 입력
                            </Button>
                          </Link>
                          <Link href={`/classes/${cls.id}/analysis`}>
                            <Button size="sm" variant="accent">
                              <BarChart3 size={13} /> 반 전체 분석
                            </Button>
                          </Link>
                        </div>
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
  );
}

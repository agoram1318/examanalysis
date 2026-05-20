'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap, Plus, Users, PenLine, BarChart3,
  Loader2, ClipboardList, Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import Button from '@/components/ui/Button';

type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
  created_at: string;
  student_count: number;
  test_count: number;
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rawList } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name, created_at, test_id')
        .order('created_at', { ascending: false });

      const withCounts: ClassRow[] = await Promise.all(
        (rawList ?? []).map(async (cls) => {
          const [studentRes, mapRes] = await Promise.all([
            supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id),
            supabase
              .from('class_tests')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id),
          ]);

          let testCount = mapRes.count ?? 0;
          if (cls.test_id) {
            const { data: legacyMap } = await supabase
              .from('class_tests')
              .select('id')
              .eq('class_id', cls.id)
              .eq('test_id', cls.test_id)
              .maybeSingle();
            if (!legacyMap) testCount += 1;
          }

          return {
            id: cls.id,
            class_name: cls.class_name,
            teacher_name: cls.teacher_name,
            academy_name: cls.academy_name,
            created_at: cls.created_at,
            student_count: studentRes.count ?? 0,
            test_count: testCount,
          };
        })
      );

      setClasses(withCounts);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>
            반 관리
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {loading ? '–' : `총 ${classes.length}개 반`}
          </p>
        </div>
        <Link href="/classes/new">
          <Button variant="accent">
            <Plus size={16} /> 새 반 생성
          </Button>
        </Link>
      </div>

      <div
        className="rounded-xl border px-5 py-3 flex flex-wrap items-center gap-2 text-xs"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--fg-main)' }}>운영 흐름:</span>
        {['새 반 생성', '학생 등록', '테스트 부여', '답안 입력', '분석 보기'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className="px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
            >
              {s}
            </span>
            {i < arr.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
        </div>
      ) : classes.length === 0 ? (
        <div
          className="rounded-xl border py-20 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <GraduationCap size={44} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg-main)' }}>
            아직 생성된 반이 없습니다.
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
            먼저 반을 생성한 뒤 학생을 등록하고 테스트를 부여해 주세요.
          </p>
          <Link href="/classes/new">
            <Button variant="accent" size="sm">
              <Plus size={14} /> 새 반 생성
            </Button>
          </Link>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
              <thead style={{ background: 'var(--bg-base)' }}>
                <tr>
                  {['반명', '학원명', '강사명', '부여 테스트', '학생 수', '생성일', ''].map((h) => (
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
                    <td className="px-5 py-3 font-semibold text-sm" style={{ color: 'var(--fg-main)' }}>
                      {cls.class_name || '–'}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                      {cls.academy_name || '–'}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--fg-sub)' }}>
                      {cls.teacher_name || '–'}
                    </td>
                    <td className="px-5 py-3 text-center text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      {cls.test_count}개
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
                        <Link href={`/classes/${cls.id}/assign-tests`}>
                          <Button size="sm" variant="outline">
                            <Link2 size={13} /> 테스트 부여
                          </Button>
                        </Link>
                        <Link href={`/classes/${cls.id}/answers`}>
                          <Button size="sm" variant="outline">
                            <PenLine size={13} /> 답안 입력
                          </Button>
                        </Link>
                        <Link href={`/classes/${cls.id}/analysis`}>
                          <Button size="sm" variant="accent">
                            <BarChart3 size={13} /> 분석 보기
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && classes.length > 0 && (
        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--fg-muted)' }}>
          <ClipboardList size={12} />
          테스트별 반 목록은 테스트 관리 → 반 목록에서도 확인할 수 있습니다.
        </p>
      )}
    </div>
  );
}

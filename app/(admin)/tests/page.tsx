'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plus, ClipboardList, Edit2, Users, Loader2, ChevronRight, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  total_questions: number;
  created_at: string;
  subjects: { name: string } | null;
};

export default function TestsPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('tests')
      .select('id, title, grade, total_questions, created_at, subjects(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTests((data ?? []) as unknown as TestRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>
            테스트 목록
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            총 {loading ? '–' : tests.length}개의 테스트
          </p>
        </div>
        <Link href="/tests/new">
          <Button variant="accent">
            <Plus size={16} /> 새 테스트 등록
          </Button>
        </Link>
      </div>

      {/* ── 워크플로 안내 ── */}
      {!loading && tests.length > 0 && (
        <div
          className="rounded-xl border px-5 py-3 flex flex-wrap items-center gap-2 text-xs"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--fg-main)' }}>다음 단계:</span>
          {['문항 입력', '반 부여', '학생 등록', '답안 입력', '반별 분석', '테스트 전체 분석'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className="px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
              >
                {s}
              </span>
              {i < arr.length - 1 && <ChevronRight size={12} />}
            </span>
          ))}
          <span className="ml-1">버튼을 눌러 각 테스트를 관리하세요.</span>
        </div>
      )}

      {/* ── 로딩 ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
        </div>
      ) : tests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <ClipboardList
              size={40}
              className="mx-auto mb-3 opacity-20"
              style={{ color: 'var(--fg-muted)' }}
            />
            <p className="mb-3" style={{ color: 'var(--fg-muted)' }}>
              아직 등록된 테스트가 없습니다.
            </p>
            <Link href="/tests/new">
              <Button variant="accent" size="sm">
                <Plus size={14} /> 첫 번째 테스트 등록
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const meta = [test.grade, test.subjects?.name].filter(Boolean).join(' · ');
            return (
              <div
                key={test.id}
                className="rounded-xl border px-5 py-4 transition-colors hover:border-orange-200"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* 왼쪽: 테스트 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3
                        className="font-semibold text-base"
                        style={{ color: 'var(--fg-main)' }}
                      >
                        {test.title}
                      </h3>
                      {test.subjects?.name && (
                        <Badge variant="info">{test.subjects.name}</Badge>
                      )}
                      <Badge variant="outline">{test.total_questions}문항</Badge>
                    </div>
                    <div
                      className="flex items-center gap-2 text-sm flex-wrap"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {meta && <span>{meta}</span>}
                      {meta && <span>·</span>}
                      <span>{formatDate(test.created_at)}</span>
                    </div>
                  </div>

                  {/* 오른쪽: 버튼 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/tests/${test.id}/questions`}>
                      <Button size="sm" variant="ghost">
                        <Edit2 size={14} /> 문항 입력
                      </Button>
                    </Link>
                    <Link href={`/tests/${test.id}/assign-classes`}>
                      <Button size="sm" variant="outline">
                        <Users size={14} /> 반에 일괄 부여
                      </Button>
                    </Link>
                    <Link href={`/tests/${test.id}/classes`}>
                      <Button size="sm" variant="accent">
                        <Users size={14} /> 부여된 반 보기
                      </Button>
                    </Link>
                    <Link href={`/tests/${test.id}/analysis`}>
                      <Button size="sm" variant="outline">
                        <BarChart3 size={14} /> 테스트 전체 분석
                      </Button>
                    </Link>
                    <Link href={`/tests/${test.id}/classes/new`}>
                      <Button size="sm" variant="ghost">
                        <Users size={14} /> 반 생성
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

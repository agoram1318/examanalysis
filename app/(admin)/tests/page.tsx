'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plus, ClipboardList, Edit2, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

type TestRow = {
  id: number;
  title: string;
  school_name: string | null;
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
      .select('id, title, school_name, grade, total_questions, created_at, subjects(name)')
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
            const meta = [test.school_name, test.grade].filter(Boolean).join(' · ');
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
                    <Link href={`/tests/${test.id}/classes/new`}>
                      <Button size="sm" variant="outline">
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

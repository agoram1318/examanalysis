'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, AlertCircle, Loader2, ChevronRight,
  ClipboardList, PenLine, BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass, type TestSummary } from '@/lib/class-tests';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

type ClassInfo = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
};

type Mode = 'answers' | 'analysis';

const MODE_CONFIG: Record<
  Mode,
  { title: string; subtitle: string; icon: typeof PenLine; buildHref: (classId: number, testId: number) => string }
> = {
  answers: {
    title: '답안 입력',
    subtitle: '답안을 입력할 테스트를 선택하세요.',
    icon: PenLine,
    buildHref: (classId, testId) => `/classes/${classId}/tests/${testId}/answers`,
  },
  analysis: {
    title: '반 전체 분석',
    subtitle: '분석할 테스트를 선택하세요.',
    icon: BarChart3,
    buildHref: (classId, testId) => `/classes/${classId}/tests/${testId}/analysis`,
  },
};

export default function ClassTestPicker({
  classId,
  mode,
}: {
  classId: number;
  mode: Mode;
}) {
  const cfg = MODE_CONFIG[mode];
  const Icon = cfg.icon;

  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNaN(classId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      const { data: classData, error } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .eq('id', classId)
        .single();

      if (error || !classData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCls(classData);
      setTests(await fetchTestsForClass(classId));
      setLoading(false);
    }
    load();
  }, [classId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound || !cls) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>반을 찾을 수 없습니다.</p>
        <Link href="/classes"><Button variant="outline" size="sm">반 관리로</Button></Link>
      </div>
    );
  }

  const classLabel = cls.class_name || '반';

  return (
    <div className="max-w-2xl">
      <div className="flex items-start gap-3 mb-6">
        <Link href="/classes" className="mt-0.5">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={15} /> 반 관리
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{classLabel}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>{cfg.title}</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{cfg.subtitle}</p>
        </div>
      </div>

      <div
        className="rounded-xl border px-5 py-3 mb-5 flex flex-wrap gap-x-6 gap-y-1"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {[
          { label: '반명', value: classLabel },
          { label: '학원', value: cls.academy_name || '–' },
          { label: '강사', value: cls.teacher_name || '–' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
            <span className="font-medium" style={{ color: 'var(--fg-main)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {tests.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center px-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <Icon size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg-main)' }}>
            부여된 테스트가 없습니다.
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
            먼저 이 반에 테스트를 부여해 주세요.
          </p>
          <Link href={`/classes/${classId}/assign-tests`}>
            <Button variant="accent" size="sm">테스트 부여하기</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const meta = [test.grade, test.subject_name].filter(Boolean).join(' · ');
            return (
              <Link
                key={test.id}
                href={cfg.buildHref(classId, test.id)}
                className="block rounded-xl border px-5 py-4 transition-colors hover:border-orange-200"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--fg-main)' }}>
                      {test.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                      {meta ? `${meta} · ` : ''}{test.total_questions}문항
                      {test.assigned_at ? ` · 부여 ${formatDate(test.assigned_at)}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--fg-muted)' }} className="shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link href={`/classes/${classId}/assign-tests`}>
          <Button variant="outline" size="sm">
            <ClipboardList size={14} /> 테스트 부여 관리
          </Button>
        </Link>
        <Link href={`/classes/${classId}/students`}>
          <Button variant="ghost" size="sm">학생 관리</Button>
        </Link>
      </div>
    </div>
  );
}

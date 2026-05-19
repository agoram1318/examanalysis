'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type TestRow = {
  id: number;
  title: string;
  school_name: string | null;
  grade: string | null;
  total_questions: number;
  subjects: { name: string } | null;
};

type FormState = {
  class_name: string;
  teacher_name: string;
  academy_name: string;
};

export default function NewClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: testIdStr } = use(params);
  const testId = Number(testIdStr);
  const router = useRouter();

  const [test, setTest] = useState<TestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState<FormState>({
    class_name: '',
    teacher_name: '',
    academy_name: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 테스트 정보 로드
  useEffect(() => {
    if (isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    supabase
      .from('tests')
      .select('id, title, school_name, grade, total_questions, subjects(name)')
      .eq('id', testId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setTest(data as unknown as TestRow);
        setLoading(false);
      });
  }, [testId]);

  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const validate = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.class_name.trim()) errs.class_name = '반명을 입력해주세요.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!validate()) return;

    setSaving(true);

    const { data, error } = await supabase
      .from('classes')
      .insert({
        test_id: testId,
        class_name: form.class_name.trim(),
        teacher_name: form.teacher_name.trim() || null,
        academy_name: form.academy_name.trim() || null,
      })
      .select('id')
      .single();

    if (error || !data) {
      setSaveError(error?.message ?? '저장 중 알 수 없는 오류가 발생했습니다.');
      setSaving(false);
      return;
    }

    router.push(`/classes/${data.id}/students`);
  };

  // ── 로딩
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  // ── 없음
  if (notFound || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>
          테스트를 찾을 수 없습니다.
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
          존재하지 않거나 삭제된 테스트입니다.
        </p>
        <Link href="/tests">
          <Button variant="outline" size="sm">테스트 목록으로</Button>
        </Link>
      </div>
    );
  }

  const subtitle = [test.school_name, test.grade].filter(Boolean).join(' · ');

  return (
    <div className="max-w-lg">
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/tests" className="mt-0.5">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={15} /> 목록으로
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
              {test.title}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              반 생성
            </span>
          </div>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* ── 테스트 정보 요약 ── */}
      <div
        className="rounded-xl border px-5 py-3 mb-5 flex flex-wrap gap-x-6 gap-y-1"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {[
          { label: '테스트명', value: test.title },
          { label: '과목',    value: test.subjects?.name ?? '–' },
          { label: '학교',    value: test.school_name ?? '–' },
          { label: '총 문항', value: `${test.total_questions}문항` },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
            <span className="font-medium" style={{ color: 'var(--fg-main)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>반 정보 입력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="반명 *"
              placeholder="예: A반, 고1 수학반, 1교시반"
              value={form.class_name}
              onChange={handleChange('class_name')}
              error={errors.class_name}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="강사명"
                placeholder="예: 봉샘"
                value={form.teacher_name}
                onChange={handleChange('teacher_name')}
              />
              <Input
                label="학원명"
                placeholder="예: 봉샘스쿨"
                value={form.academy_name}
                onChange={handleChange('academy_name')}
              />
            </div>
          </CardContent>
        </Card>

        {saveError && (
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-lg border text-sm"
            style={{ background: '#fff5f5', borderColor: '#fca5a5', color: '#dc2626' }}
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/tests">
            <Button variant="outline" type="button" disabled={saving}>
              취소
            </Button>
          </Link>
          <Button variant="accent" type="submit" loading={saving} disabled={saving}>
            <Save size={15} /> 저장 후 학생 등록
          </Button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function NewClassPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    class_name: '',
    teacher_name: '',
    academy_name: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const validate = () => {
    const errs: Partial<Record<keyof typeof form, string>> = {};
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
        class_name: form.class_name.trim(),
        teacher_name: form.teacher_name.trim() || null,
        academy_name: form.academy_name.trim() || null,
        test_id: null,
      })
      .select('id')
      .single();

    if (error || !data) {
      setSaveError(error?.message ?? '저장 중 알 수 없는 오류가 발생했습니다.');
      setSaving(false);
      return;
    }

    router.push('/classes');
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-start gap-3 mb-6">
        <Link href="/classes" className="mt-0.5">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={15} /> 반 관리
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>
            새 반 생성
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            테스트와 무관하게 반을 먼저 만든 뒤, 나중에 테스트를 부여할 수 있습니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>반 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="반명 *"
              placeholder="예: A반, 고1 수학반"
              value={form.class_name}
              onChange={handleChange('class_name')}
              error={errors.class_name}
            />
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
          <Link href="/classes">
            <Button variant="outline" type="button" disabled={saving}>
              취소
            </Button>
          </Link>
          <Button variant="accent" type="submit" loading={saving} disabled={saving}>
            <Save size={15} /> 저장
          </Button>
        </div>
      </form>

    </div>
  );
}

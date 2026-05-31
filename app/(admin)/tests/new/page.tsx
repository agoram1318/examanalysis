'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// ── 폼 필드 키 타입
type FormKey = 'title' | 'grade' | 'exam_range_text' | 'total_questions';

type FormState = Record<FormKey, string>;

const INITIAL_FORM: FormState = {
  title: '',
  grade: '',
  exam_range_text: '',
  total_questions: '',
};

export default function NewTestPage() {
  const router = useRouter();

  // ── 폼 상태
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 필드 변경 핸들러 (에러 즉시 제거)
  const handleChange =
    (key: FormKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  // ── 유효성 검사
  const validate = (): boolean => {
    const errs: Partial<Record<FormKey, string>> = {};
    if (!form.title.trim()) errs.title = '테스트명을 입력해주세요.';
    const n = parseInt(form.total_questions, 10);
    if (!form.total_questions.trim() || isNaN(n) || n < 1) {
      errs.total_questions = '1 이상의 숫자를 입력해주세요.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── 저장 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!validate()) return;

    setSaving(true);

    const { data, error } = await supabase
      .from('tests')
      .insert({
        title: form.title.trim(),
        grade: form.grade.trim() || null,
        subject_id: null,
        exam_range_text: form.exam_range_text.trim() || null,
        total_questions: parseInt(form.total_questions, 10),
      })
      .select('id')
      .single();

    if (error || !data) {
      setSaveError(
        error?.message
          ? `저장에 실패했습니다: ${error.message}`
          : '저장 중 알 수 없는 오류가 발생했습니다.'
      );
      setSaving(false);
      return;
    }

    router.push(`/tests/${data.id}/questions`);
  };

  return (
    <div className="max-w-2xl">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tests">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            목록으로
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>
            새 테스트 등록
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            테스트 기본 정보를 입력하고 저장하면 문항 입력 화면으로 이동합니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── 기본 정보 카드 ── */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* 테스트명 */}
            <Input
              label="테스트명 *"
              placeholder="예: 2025 공통수학1 1회 기말고사"
              value={form.title}
              onChange={handleChange('title')}
              error={errors.title}
            />

            <Input
              label="학년"
              placeholder="예: 고1, 2학년"
              value={form.grade}
              onChange={handleChange('grade')}
            />

            {/* 시험 범위 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--fg-main)' }}>
                시험 범위
              </label>
              <textarea
                rows={2}
                placeholder="예: 다항식 전체, 방정식과 부등식 1~2단원"
                value={form.exam_range_text}
                onChange={handleChange('exam_range_text')}
                className="px-3 py-2 text-sm rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={{
                  border: '1px solid var(--border)',
                  background: '#fff',
                  color: 'var(--fg-main)',
                }}
              />
            </div>

            {/* 총 문항 수 */}
            <Input
              label="총 문항 수 *"
              type="number"
              min="1"
              max="200"
              placeholder="예: 25"
              value={form.total_questions}
              onChange={handleChange('total_questions')}
              error={errors.total_questions}
            />
          </CardContent>
        </Card>

        {/* ── 저장 실패 에러 ── */}
        {saveError && (
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-lg border text-sm"
            style={{ background: '#fff5f5', borderColor: '#fca5a5', color: '#dc2626' }}
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {saveError}
          </div>
        )}

        {/* ── 버튼 영역 ── */}
        <div className="flex justify-end gap-3">
          <Link href="/tests">
            <Button variant="outline" type="button" disabled={saving}>
              취소
            </Button>
          </Link>
          <Button variant="accent" type="submit" loading={saving} disabled={saving}>
            <Save size={16} />
            저장 후 문항 입력
          </Button>
        </div>
      </form>
    </div>
  );
}

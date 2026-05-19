'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { getSubjects, getClasses, saveTest, generateId } from '@/lib/store';

export default function NewTestPage() {
  const router = useRouter();
  const subjects = getSubjects();
  const classes = getClasses();

  const [form, setForm] = useState({
    title: '',
    subject_id: subjects[0]?.id ?? '',
    class_id: classes[0]?.id ?? '',
    test_date: new Date().toISOString().split('T')[0],
    total_score: '100',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = '테스트 제목을 입력해주세요';
    if (!form.subject_id) errs.subject_id = '과목을 선택해주세요';
    if (!form.class_id) errs.class_id = '반을 선택해주세요';
    if (!form.test_date) errs.test_date = '날짜를 입력해주세요';
    const score = parseInt(form.total_score);
    if (isNaN(score) || score <= 0) errs.total_score = '올바른 총점을 입력해주세요';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const newTest = {
      id: generateId(),
      title: form.title.trim(),
      subject_id: form.subject_id,
      class_id: form.class_id,
      test_date: form.test_date,
      total_score: parseInt(form.total_score),
      description: form.description.trim() || null,
      created_at: new Date().toISOString(),
    };

    saveTest(newTest);
    router.push(`/tests/${newTest.id}/questions`);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tests">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            목록으로
          </Button>
        </Link>
        <h2 className="text-lg font-semibold text-slate-800">새 테스트 만들기</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="테스트 제목 *"
              placeholder="예: 다항식 단원 테스트 1회"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              error={errors.title}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="과목 *"
                value={form.subject_id}
                onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                options={subjects.map(s => ({ value: s.id, label: s.name }))}
                error={errors.subject_id}
                placeholder="과목 선택"
              />
              <Select
                label="반 *"
                value={form.class_id}
                onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                options={classes.map(c => ({ value: c.id, label: c.name }))}
                error={errors.class_id}
                placeholder="반 선택"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="시험 날짜 *"
                type="date"
                value={form.test_date}
                onChange={e => setForm(f => ({ ...f, test_date: e.target.value }))}
                error={errors.test_date}
              />
              <Input
                label="총점 *"
                type="number"
                min="1"
                max="1000"
                value={form.total_score}
                onChange={e => setForm(f => ({ ...f, total_score: e.target.value }))}
                error={errors.total_score}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">설명 (선택)</label>
              <textarea
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="테스트에 대한 간단한 설명을 입력해주세요"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/tests">
            <Button variant="outline" type="button">취소</Button>
          </Link>
          <Button type="submit">
            <Save size={16} />
            저장 후 문항 입력
          </Button>
        </div>
      </form>
    </div>
  );
}

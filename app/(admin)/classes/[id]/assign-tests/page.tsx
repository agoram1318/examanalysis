'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, AlertCircle, Loader2, ClipboardList, CheckSquare, Square,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { assignTestsToClass, fetchSubjectNamesByTest, fetchTestsForClass } from '@/lib/class-tests';
import Button from '@/components/ui/Button';

type ClassInfo = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
};

type TestItem = {
  id: number;
  title: string;
  grade: string | null;
  total_questions: number;
  subject_name: string | null;
};

export default function AssignTestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: classIdStr } = use(params);
  const classId = Number(classIdStr);

  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [allTests, setAllTests] = useState<TestItem[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
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

      const [testsRes, assigned] = await Promise.all([
        supabase
          .from('tests')
          .select('id, title, grade, total_questions')
          .order('created_at', { ascending: false }),
        fetchTestsForClass(classId),
      ]);

      const assignedSet = new Set(assigned.map((t) => t.id));
      setAssignedIds(assignedSet);
      setSelectedIds(new Set(assignedSet));

      const rawTests = testsRes.data ?? [];
      const subjectNames = await fetchSubjectNamesByTest(rawTests.map((t) => t.id));
      const items: TestItem[] = rawTests.map((t) => ({
        id: t.id,
        title: t.title,
        grade: t.grade,
        total_questions: t.total_questions,
        subject_name: subjectNames.get(t.id) ?? '문항 입력 전',
      }));
      setAllTests(items);
      setLoading(false);
    }
    load();
  }, [classId]);

  const toggle = (testId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    const toAdd = [...selectedIds].filter((id) => !assignedIds.has(id));
    if (toAdd.length === 0) {
      setSaveError('새로 부여할 테스트를 선택해 주세요. (이미 부여된 테스트는 저장 시 건너뜁니다.)');
      return;
    }

    setSaving(true);
    const { error } = await assignTestsToClass(classId, toAdd);
    if (error) {
      setSaveError(`저장 실패: ${error}`);
      setSaving(false);
      return;
    }

    const nextAssigned = new Set([...assignedIds, ...toAdd]);
    setAssignedIds(nextAssigned);
    setSaveSuccess(true);
    setSaving(false);
  };

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

  return (
    <div className="max-w-2xl">
      <div className="flex items-start gap-3 mb-6">
        <Link href="/classes" className="mt-0.5">
          <Button variant="ghost" size="sm"><ArrowLeft size={15} /> 반 관리</Button>
        </Link>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>테스트 부여</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {cls.class_name || '반'} — 부여할 테스트를 선택하고 저장하세요.
          </p>
        </div>
      </div>

      {allTests.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <ClipboardList size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--fg-main)' }}>먼저 테스트를 등록해 주세요.</p>
          <Link href="/tests/new" className="mt-3 inline-block">
            <Button variant="accent" size="sm">테스트 등록하기</Button>
          </Link>
        </div>
      ) : (
        <>
          <div
            className="rounded-xl border overflow-hidden mb-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            {allTests.map((test, i) => {
              const checked = selectedIds.has(test.id);
              const already = assignedIds.has(test.id);
              const meta = [test.grade, test.subject_name].filter(Boolean).join(' · ');
              return (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => toggle(test.id)}
                  className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-orange-50/50"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  {checked ? (
                    <CheckSquare size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Square size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--fg-muted)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--fg-main)' }}>
                      {test.title}
                      {already && (
                        <span
                          className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                        >
                          부여됨
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                      {meta ? `${meta} · ` : ''}{test.total_questions}문항
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
            체크 해제는 저장에 반영되지 않습니다. 추가 부여만 가능합니다.
          </p>

          {saveError && (
            <div
              className="flex items-start gap-2 px-4 py-3 mb-4 rounded-lg border text-sm"
              style={{ background: '#fff5f5', borderColor: '#fca5a5', color: '#dc2626' }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div
              className="px-4 py-3 mb-4 rounded-lg border text-sm"
              style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
            >
              테스트 부여가 저장되었습니다.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/classes">
              <Button variant="outline" disabled={saving}>취소</Button>
            </Link>
            <Button variant="accent" onClick={handleSave} loading={saving} disabled={saving}>
              <Save size={15} /> 추가 부여 저장
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

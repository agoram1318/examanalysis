'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Save, AlertCircle, Loader2, GraduationCap, CheckSquare, Square,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { assignClassesToTest, fetchClassIdsForTest } from '@/lib/class-tests';
import Button from '@/components/ui/Button';

type TestInfo = {
  id: number;
  title: string;
  grade: string | null;
};

type ClassItem = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
};

export default function AssignClassesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: testIdStr } = use(params);
  const testId = Number(testIdStr);

  const [test, setTest] = useState<TestInfo | null>(null);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade')
        .eq('id', testId)
        .single();

      if (testErr || !testData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTest(testData);

      const [classesRes, assignedClassIds] = await Promise.all([
        supabase
          .from('classes')
          .select('id, class_name, teacher_name, academy_name')
          .order('created_at', { ascending: false }),
        fetchClassIdsForTest(testId),
      ]);

      const assignedSet = new Set(assignedClassIds);
      setAssignedIds(assignedSet);
      setSelectedIds(new Set(assignedSet));
      setAllClasses((classesRes.data ?? []) as ClassItem[]);
      setLoading(false);
    }
    load();
  }, [testId]);

  const toggle = (classId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    const toAdd = [...selectedIds].filter((id) => !assignedIds.has(id));
    if (toAdd.length === 0) {
      setSaveError('새로 부여할 반을 선택해 주세요. (이미 부여된 반은 저장 시 건너뜁니다.)');
      return;
    }

    setSaving(true);
    const { error } = await assignClassesToTest(testId, toAdd);
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

  if (notFound || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>테스트를 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록으로</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start gap-3 mb-6">
        <Link href="/tests" className="mt-0.5">
          <Button variant="ghost" size="sm"><ArrowLeft size={15} /> 테스트 관리</Button>
        </Link>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--fg-main)' }}>반에 일괄 부여</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{test.title}</p>
        </div>
      </div>

      {allClasses.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <GraduationCap size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--fg-main)' }}>먼저 반을 생성해 주세요.</p>
          <Link href="/classes/new" className="mt-3 inline-block">
            <Button variant="accent" size="sm">새 반 생성</Button>
          </Link>
        </div>
      ) : (
        <>
          <div
            className="rounded-xl border overflow-hidden mb-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            {allClasses.map((cls, i) => {
              const checked = selectedIds.has(cls.id);
              const already = assignedIds.has(cls.id);
              const staff = [cls.teacher_name, cls.academy_name].filter(Boolean).join(' · ');
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => toggle(cls.id)}
                  className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-orange-50/50"
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                >
                  {checked ? (
                    <CheckSquare size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Square size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--fg-muted)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--fg-main)' }}>
                      {cls.class_name || '–'}
                      {already && (
                        <span
                          className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                        >
                          부여됨
                        </span>
                      )}
                    </p>
                    {staff && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{staff}</p>
                    )}
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
              반 부여가 저장되었습니다.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href={`/tests/${testId}/classes`}>
              <Button variant="outline" disabled={saving}>부여된 반 보기</Button>
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

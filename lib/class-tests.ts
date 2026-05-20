import { supabase } from '@/lib/supabase/client';

export type TestSummary = {
  id: number;
  title: string;
  grade: string | null;
  total_questions: number;
  subject_name: string | null;
  assigned_at?: string;
};

type SubjectRaw = { name: string } | { name: string }[] | null;

function pickSubjectName(raw: SubjectRaw): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ?? null;
  return raw.name ?? null;
}

/** 반에 부여된 테스트 목록 (class_tests + 레거시 classes.test_id) */
export async function fetchTestsForClass(classId: number): Promise<TestSummary[]> {
  const [classRes, mapRes] = await Promise.all([
    supabase.from('classes').select('test_id').eq('id', classId).single(),
    supabase
      .from('class_tests')
      .select('test_id, assigned_at, tests(id, title, grade, total_questions, subjects(name))')
      .eq('class_id', classId)
      .order('assigned_at', { ascending: false }),
  ]);

  const byId = new Map<number, TestSummary>();

  for (const row of mapRes.data ?? []) {
    const t = row.tests as unknown as {
      id: number;
      title: string;
      grade: string | null;
      total_questions: number;
      subjects: SubjectRaw;
    } | null;
    if (!t) continue;
    byId.set(t.id, {
      id: t.id,
      title: t.title,
      grade: t.grade,
      total_questions: t.total_questions,
      subject_name: pickSubjectName(t.subjects),
      assigned_at: row.assigned_at,
    });
  }

  const legacyTestId = classRes.data?.test_id;
  if (legacyTestId && !byId.has(legacyTestId)) {
    const { data: legacy } = await supabase
      .from('tests')
      .select('id, title, grade, total_questions, subjects(name)')
      .eq('id', legacyTestId)
      .single();
    if (legacy) {
      byId.set(legacy.id, {
        id: legacy.id,
        title: legacy.title,
        grade: legacy.grade,
        total_questions: legacy.total_questions,
        subject_name: pickSubjectName(legacy.subjects as SubjectRaw),
      });
    }
  }

  return [...byId.values()];
}

/** 테스트에 부여된 반 ID 목록 (class_tests + 레거시 classes.test_id) */
export async function fetchClassIdsForTest(testId: number): Promise<number[]> {
  const [mapRes, legacyRes] = await Promise.all([
    supabase.from('class_tests').select('class_id').eq('test_id', testId),
    supabase.from('classes').select('id').eq('test_id', testId),
  ]);

  const ids = new Set<number>();
  (mapRes.data ?? []).forEach((r) => ids.add(r.class_id));
  (legacyRes.data ?? []).forEach((r) => ids.add(r.id));
  return [...ids];
}

/** class_tests에 관계 추가 (중복 무시) */
export async function assignTestsToClass(
  classId: number,
  testIds: number[]
): Promise<{ error: string | null }> {
  if (testIds.length === 0) return { error: null };

  const rows = testIds.map((testId) => ({
    class_id: classId,
    test_id: testId,
    assigned_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('class_tests')
    .upsert(rows, { onConflict: 'class_id,test_id', ignoreDuplicates: true });

  return { error: error?.message ?? null };
}

/** class_tests에 관계 추가 (중복 무시) */
export async function assignClassesToTest(
  testId: number,
  classIds: number[]
): Promise<{ error: string | null }> {
  if (classIds.length === 0) return { error: null };

  const rows = classIds.map((classId) => ({
    class_id: classId,
    test_id: testId,
    assigned_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('class_tests')
    .upsert(rows, { onConflict: 'class_id,test_id', ignoreDuplicates: true });

  return { error: error?.message ?? null };
}

/** 반 생성 + 테스트 부여 (테스트 기준 반 생성 흐름) */
export async function createClassWithTestAssignment(
  testId: number,
  fields: { class_name: string; teacher_name: string | null; academy_name: string | null }
): Promise<{ classId: number | null; error: string | null }> {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      test_id: testId,
      class_name: fields.class_name,
      teacher_name: fields.teacher_name,
      academy_name: fields.academy_name,
    })
    .select('id')
    .single();

  if (error || !data) return { classId: null, error: error?.message ?? '반 생성에 실패했습니다.' };

  const assign = await assignTestsToClass(data.id, [testId]);
  if (assign.error) {
    return { classId: data.id, error: `반은 생성되었으나 테스트 부여에 실패했습니다: ${assign.error}` };
  }

  return { classId: data.id, error: null };
}

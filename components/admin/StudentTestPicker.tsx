'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, AlertCircle, Loader2, ChevronRight, FileBarChart, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass, type TestSummary } from '@/lib/class-tests';
import Button from '@/components/ui/Button';
import { getSubjectDisplayName } from '@/lib/report-utils';

type StudentInfo = {
  id: number;
  student_name: string;
  student_code: string | null;
  class_id: number;
};

export default function StudentTestPicker({ studentId }: { studentId: number }) {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNaN(studentId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      const { data: studentData, error } = await supabase
        .from('students')
        .select('id, student_name, student_code, class_id')
        .eq('id', studentId)
        .single();

      if (error || !studentData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setStudent(studentData);

      const assigned = await fetchTestsForClass(studentData.class_id);
      const byId = new Map(assigned.map((t) => [t.id, t]));

      const { data: answerRows } = await supabase
        .from('student_answers')
        .select('question_id, questions(test_id, tests(id, title, grade, total_questions, subjects(name)))')
        .eq('student_id', studentId);

      for (const row of answerRows ?? []) {
        const q = row.questions as unknown as {
          test_id: number;
          tests: {
            id: number;
            title: string;
            grade: string | null;
            total_questions: number;
            subjects: { name: string } | { name: string }[] | null;
          } | null;
        } | null;
        const t = q?.tests;
        if (!t || byId.has(t.id)) continue;
        const sub = t.subjects;
        const rawSubjectName = Array.isArray(sub) ? (sub[0]?.name ?? null) : (sub?.name ?? null);
        const subject_name = getSubjectDisplayName(rawSubjectName);
        byId.set(t.id, {
          id: t.id,
          title: t.title,
          grade: t.grade,
          total_questions: t.total_questions,
          subject_name,
        });
      }

      setTests([...byId.values()]);
      setLoading(false);
    }
    load();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>학생을 찾을 수 없습니다.</p>
        <Link href="/classes"><Button variant="outline" size="sm">반 관리로</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start gap-3 mb-6">
        <Link href={`/classes/${student.class_id}/students`} className="mt-0.5">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={15} /> 학생 목록
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
              {student.student_name}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              학생별 분석표
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            리포트를 볼 테스트를 선택하세요.
          </p>
        </div>
      </div>

      {tests.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center px-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <FileBarChart size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg-main)' }}>
            분석할 테스트가 없습니다.
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
            반에 테스트를 부여하거나 답안을 입력한 뒤 다시 시도해 주세요.
          </p>
          <Link href={`/classes/${student.class_id}/assign-tests`}>
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
                href={`/students/${studentId}/tests/${test.id}/report`}
                className="block rounded-xl border px-5 py-4 transition-colors hover:border-orange-200"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--fg-main)' }}>
                      {test.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                      {meta ? `${meta} · ` : ''}{test.total_questions}문항
                    </p>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--fg-muted)' }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Link href={`/classes/${student.class_id}/assign-tests`}>
          <Button variant="outline" size="sm">
            <ClipboardList size={14} /> 테스트 부여 관리
          </Button>
        </Link>
      </div>
    </div>
  );
}

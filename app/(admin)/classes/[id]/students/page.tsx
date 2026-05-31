'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Users, ChevronRight, AlertCircle, Loader2, ArrowRight, PenLine, FileBarChart, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { fetchSubjectNamesByTest } from '@/lib/class-tests';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
  test_id: number;
  tests: {
    title: string;
    grade: string | null;
    subject_name: string;
  } | null;
};

type StudentRow = {
  id: number;
  student_name: string;
  student_code: string | null;
  created_at: string;
};

// ─────────────────────────────────────────────
// 페이지
// ─────────────────────────────────────────────
export default function StudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: classIdStr } = use(params);
  const classId = Number(classIdStr);

  const [cls, setCls]         = useState<ClassRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [textarea, setTextarea]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // ── 학생 목록 새로고침
  const reloadStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('id, student_name, student_code, created_at')
      .eq('class_id', classId)
      .order('student_code');
    setStudents(data ?? []);
  }, [classId]);

  // ── 초기 로드
  useEffect(() => {
    if (isNaN(classId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      const { data, error } = await supabase
        .from('classes')
        .select(
          'id, class_name, teacher_name, academy_name, test_id, tests(title, grade)'
        )
        .eq('id', classId)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const row = data as unknown as ClassRow;
      if (row.test_id && row.tests) {
        const subjectNames = await fetchSubjectNamesByTest([row.test_id]);
        row.tests.subject_name = subjectNames.get(row.test_id) ?? '문항 입력 전';
      }
      setCls(row);
      await reloadStudents();
      setLoading(false);
    }
    load();
  }, [classId, reloadStudents]);

  // ── 학생 일괄 등록
  const handleAddStudents = async () => {
    setSaveError(null);
    setSaveSuccess(null);

    const names = textarea
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (names.length === 0) {
      setSaveError('학생명을 한 명 이상 입력해주세요.');
      return;
    }

    setSaving(true);

    // 현재 등록된 학생 수 기준으로 코드 시작 번호 결정
    const startIdx = students.length + 1;
    const rows = names.map((name, i) => ({
      class_id:     classId,
      student_name: name,
      student_code: String(startIdx + i).padStart(3, '0'),
    }));

    const { error } = await supabase.from('students').insert(rows);

    if (error) {
      setSaveError(`저장 실패: ${error.message}`);
      setSaving(false);
      return;
    }

    setTextarea('');
    await reloadStudents();
    setSaveSuccess(`${names.length}명이 등록되었습니다.`);
    setSaving(false);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      {
        const { error } = await supabase
          .from('student_answers')
          .delete()
          .eq('student_id', deleteTarget.id);
        if (error) throw error;
      }
      {
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) throw error;
      }

      setDeleteSuccess(`"${deleteTarget.student_name}" 학생을 삭제했습니다.`);
      setDeleteTarget(null);
      await reloadStudents();
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setDeleteError(`삭제에 실패했습니다. ${message} Supabase RLS를 사용 중이라면 students, student_answers 삭제 정책을 확인해 주세요.`);
    } finally {
      setDeleting(false);
    }
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
  if (notFound || !cls) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>
          반을 찾을 수 없습니다.
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
          존재하지 않거나 삭제된 반입니다.
        </p>
        <Link href="/tests">
          <Button variant="outline" size="sm">테스트 목록으로</Button>
        </Link>
      </div>
    );
  }

  const test = cls.tests;
  const classLabel = cls.class_name || '반 이름 없음';
  const staffLabel = [cls.teacher_name, cls.academy_name].filter(Boolean).join(' · ');

  return (
    <div className="max-w-2xl">
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/tests" className="mt-0.5">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={15} /> 목록으로
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {test && (
              <>
                <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>
                  {test.title}
                </span>
                <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
              </>
            )}
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
              {classLabel}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              학생 등록
            </span>
          </div>
          {staffLabel && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              {staffLabel}
            </p>
          )}
        </div>
      </div>

      {/* ── 반 + 테스트 정보 요약 ── */}
      <div
        className="rounded-xl border px-5 py-3 mb-5 flex flex-wrap gap-x-6 gap-y-1"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {[
          { label: '반명',    value: classLabel },
          { label: '테스트', value: test?.title ?? '–' },
          { label: '과목',   value: test?.subject_name ?? '–' },
          { label: '학생 수', value: `${students.length}명` },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
            <span className="font-medium" style={{ color: 'var(--fg-main)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* ── 학생 일괄 등록 카드 ── */}
        <Card>
          <CardHeader>
            <CardTitle>학생 일괄 등록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              학생 이름을 한 줄에 한 명씩 입력하세요. 빈 줄은 무시됩니다.
              학생 코드(001, 002…)는 자동 생성됩니다.
            </p>
            <textarea
              rows={8}
              placeholder={'김민준\n이서연\n박지후\n최예린'}
              value={textarea}
              onChange={(e) => {
                setTextarea(e.target.value);
                setSaveError(null);
                setSaveSuccess(null);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-orange-400"
              style={{
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--fg-main)',
                minHeight: 120,
              }}
            />

            {saveError && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm"
                style={{ background: '#fff5f5', borderColor: '#fca5a5', color: '#dc2626' }}
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div
                className="px-3 py-2.5 rounded-lg border text-sm"
                style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
              >
                ✓ {saveSuccess}
              </div>
            )}
            {deleteSuccess && (
              <div
                className="px-3 py-2.5 rounded-lg border text-sm"
                style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
              >
                {deleteSuccess}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="accent"
                onClick={handleAddStudents}
                loading={saving}
                disabled={saving}
              >
                <UserPlus size={15} /> 학생 등록
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── 등록된 학생 목록 카드 ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>등록된 학생 목록</CardTitle>
              <span className="text-sm font-normal" style={{ color: 'var(--fg-muted)' }}>
                {students.length}명
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {students.length === 0 ? (
              <div className="py-12 text-center">
                <Users
                  size={32}
                  className="mx-auto mb-2 opacity-20"
                  style={{ color: 'var(--fg-muted)' }}
                />
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  아직 등록된 학생이 없습니다.
                </p>
              </div>
            ) : (
                <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-base)' }}>
                  <tr>
                    {['코드', '학생명', '등록일', ''].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold"
                        style={{
                          color: 'var(--fg-muted)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr
                      key={s.id}
                      style={{
                        background: i % 2 === 0 ? '#fff' : '#fafaf9',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <td className="px-5 py-2.5">
                        <span
                          className="font-mono text-xs px-2 py-0.5 rounded"
                          style={{
                            background: 'var(--accent-lt)',
                            color: 'var(--accent)',
                          }}
                        >
                          {s.student_code ?? '–'}
                        </span>
                      </td>
                      <td
                        className="px-5 py-2.5 font-medium"
                        style={{ color: 'var(--fg-main)' }}
                      >
                        {s.student_name}
                      </td>
                      <td
                        className="px-5 py-2.5 text-xs"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/classes/${classId}/answers`}>
                            <Button size="sm" variant="ghost">
                              <PenLine size={13} /> 답안 입력
                            </Button>
                          </Link>
                          <Link href={`/students/${s.id}/report`}>
                            <Button size="sm" variant="outline">
                              <FileBarChart size={13} /> 리포트
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteTarget(s);
                              setDeleteError(null);
                              setDeleteSuccess(null);
                            }}
                          >
                            <Trash2 size={13} /> 삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── 다음 단계 이동 ── */}
        <div
          className="rounded-xl border px-5 py-4 flex items-center justify-between"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
              다음 단계: 답안 입력
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              학생 등록 후 답안 입력 화면으로 이동합니다.
            </p>
          </div>
          <Link href={`/classes/${classId}/answers`}>
            <Button
              variant="accent"
              disabled={students.length === 0}
            >
              답안 입력으로 이동
              <ArrowRight size={15} />
            </Button>
          </Link>
        </div>
      </div>

      <Modal open={!!deleteTarget} onClose={closeDeleteModal} title="학생 삭제 확인" size="md">
        <div className="space-y-4">
          <div
            className="rounded-lg border px-4 py-3 text-sm leading-relaxed"
            style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#7c2d12' }}
          >
            이 학생을 삭제하면 해당 학생의 답안과 분석 데이터가 함께 삭제됩니다. 정말 삭제하시겠습니까?
          </div>
          <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span className="font-semibold">학생명:</span> {deleteTarget?.student_name}
          </div>
          {deleteError && (
            <p
              className="rounded-lg border px-3 py-2 text-sm leading-relaxed"
              style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}
            >
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDeleteModal} disabled={deleting}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDeleteStudent} loading={deleting} disabled={deleting}>
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

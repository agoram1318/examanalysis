'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { getStudents, getClasses, saveStudent, deleteStudent, generateId } from '@/lib/store';
import { Student, Class } from '@/lib/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ name: '', class_id: '', student_number: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = () => {
    setStudents(getStudents());
    setClasses(getClasses());
  };
  useEffect(() => { load(); }, []);

  const filtered = filterClass ? students.filter(s => s.class_id === filterClass) : students;

  const openModal = (student?: Student) => {
    if (student) {
      setEditing(student);
      setForm({ name: student.name, class_id: student.class_id, student_number: student.student_number });
    } else {
      setEditing(null);
      setForm({ name: '', class_id: classes[0]?.id ?? '', student_number: '' });
    }
    setErrors({});
    setModalOpen(true);
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = '이름을 입력해주세요';
    if (!form.class_id) errs.class_id = '반을 선택해주세요';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    saveStudent({
      id: editing?.id ?? generateId(),
      name: form.name.trim(),
      class_id: form.class_id,
      student_number: form.student_number.trim(),
      created_at: editing?.created_at ?? new Date().toISOString(),
    });
    load();
    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`${name} 학생을 삭제하시겠습니까?`)) {
      deleteStudent(id);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">학생 관리</h2>
          <p className="text-sm text-slate-500 mt-0.5">총 {students.length}명</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus size={16} /> 학생 추가
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterClass('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !filterClass ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          전체 ({students.length})
        </button>
        {classes.map(cls => (
          <button
            key={cls.id}
            onClick={() => setFilterClass(cls.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterClass === cls.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cls.name} ({students.filter(s => s.class_id === cls.id).length})
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400">학생이 없습니다</p>
              <Button className="mt-3" size="sm" onClick={() => openModal()}>
                <Plus size={14} /> 학생 추가
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">반</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">출석번호</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s, idx) => {
                  const cls = classes.find(c => c.id === s.class_id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{cls?.name ?? '미배정'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.student_number || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openModal(s)}>
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(s.id, s.name)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '학생 수정' : '학생 추가'}>
        <div className="space-y-4">
          <Input
            label="이름 *"
            placeholder="학생 이름"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name}
          />
          <Select
            label="반 *"
            value={form.class_id}
            onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            error={errors.class_id}
            placeholder="반 선택"
          />
          <Input
            label="출석번호"
            placeholder="예: 001"
            value={form.student_number}
            onChange={e => setForm(f => ({ ...f, student_number: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

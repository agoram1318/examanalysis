'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Plus, Pencil, Trash2, GraduationCap } from 'lucide-react';
import { getClasses, getStudents, saveClass, deleteClass, generateId } from '@/lib/store';
import { Class } from '@/lib/types';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [form, setForm] = useState({ name: '', grade: '', year: new Date().getFullYear().toString() });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = () => {
    const cls = getClasses();
    setClasses(cls);
    const students = getStudents();
    const counts: Record<string, number> = {};
    cls.forEach(c => {
      counts[c.id] = students.filter(s => s.class_id === c.id).length;
    });
    setStudentCounts(counts);
  };
  useEffect(() => { load(); }, []);

  const openModal = (cls?: Class) => {
    if (cls) {
      setEditing(cls);
      setForm({ name: cls.name, grade: cls.grade, year: cls.year.toString() });
    } else {
      setEditing(null);
      setForm({ name: '', grade: '', year: new Date().getFullYear().toString() });
    }
    setErrors({});
    setModalOpen(true);
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = '반 이름을 입력해주세요';
    const year = parseInt(form.year);
    if (isNaN(year)) errs.year = '올바른 연도를 입력해주세요';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    saveClass({
      id: editing?.id ?? generateId(),
      name: form.name.trim(),
      grade: form.grade.trim(),
      year,
      created_at: editing?.created_at ?? new Date().toISOString(),
    });
    load();
    setModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (studentCounts[id] > 0) {
      alert(`${name} 반에 학생이 있어 삭제할 수 없습니다. 학생을 먼저 이동하거나 삭제해주세요.`);
      return;
    }
    if (confirm(`${name} 반을 삭제하시겠습니까?`)) {
      deleteClass(id);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">반 관리</h2>
          <p className="text-sm text-slate-500 mt-0.5">총 {classes.length}개 반</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus size={16} /> 반 추가
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {classes.length === 0 ? (
          <div className="col-span-3">
            <Card>
              <CardContent className="text-center py-16">
                <GraduationCap size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">반이 없습니다</p>
                <Button className="mt-3" size="sm" onClick={() => openModal()}>
                  <Plus size={14} /> 반 추가
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          classes.map(cls => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap size={18} className="text-blue-500" />
                      <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {cls.grade && <Badge variant="outline">{cls.grade}</Badge>}
                      <Badge variant="info">{cls.year}년</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      학생 {studentCounts[cls.id] ?? 0}명
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openModal(cls)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(cls.id, cls.name)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '반 수정' : '반 추가'}>
        <div className="space-y-4">
          <Input
            label="반 이름 *"
            placeholder="예: 고등 수학(상) A반"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            error={errors.name}
          />
          <Input
            label="학년"
            placeholder="예: 중3, 고1"
            value={form.grade}
            onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
          />
          <Input
            label="연도 *"
            type="number"
            value={form.year}
            onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
            error={errors.year}
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

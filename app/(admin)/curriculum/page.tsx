'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Plus, Pencil, Trash2, BookMarked, ChevronRight } from 'lucide-react';
import { getSubjects, getChapters, saveSubject, deleteSubject, saveChapter, deleteChapter, generateId } from '@/lib/store';
import { Subject, Chapter } from '@/lib/types';
import { getLevelLabel } from '@/lib/utils';
import { getSubjectDisplayName } from '@/lib/report-utils';

const LEVEL_COLORS = {
  major: 'bg-blue-50 border-blue-200',
  middle: 'bg-slate-50 border-slate-200',
  minor: 'bg-white border-slate-100',
};

const LEVEL_BADGE: Record<string, 'info' | 'outline' | 'default'> = {
  major: 'info',
  middle: 'outline',
  minor: 'default',
};

export default function CurriculumPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');

  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjForm, setSubjForm] = useState({ name: '', code: '' });

  const [chapterModal, setChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapForm, setChapForm] = useState({
    name: '', subject_id: '', level: 'major' as Chapter['level'],
    parent_id: '', order_index: '1',
  });

  const load = () => {
    const s = getSubjects();
    setSubjects(s);
    setChapters(getChapters());
    if (!selectedSubject && s.length > 0) setSelectedSubject(s[0].id);
  };
  useEffect(() => { load(); }, []);

  const subjectChapters = chapters
    .filter(c => c.subject_id === selectedSubject)
    .sort((a, b) => a.order_index - b.order_index);

  const majorChapters = subjectChapters.filter(c => c.level === 'major');

  const openSubjectModal = (s?: Subject) => {
    if (s) { setEditingSubject(s); setSubjForm({ name: s.name, code: s.code }); }
    else { setEditingSubject(null); setSubjForm({ name: '', code: '' }); }
    setSubjectModal(true);
  };

  const handleSaveSubject = () => {
    if (!subjForm.name.trim()) return;
    saveSubject({
      id: editingSubject?.id ?? generateId(),
      name: subjForm.name.trim(),
      code: subjForm.code.trim(),
      created_at: editingSubject?.created_at ?? new Date().toISOString(),
    });
    load();
    setSubjectModal(false);
  };

  const openChapterModal = (c?: Chapter, parentId?: string, level?: Chapter['level']) => {
    if (c) {
      setEditingChapter(c);
      setChapForm({ name: c.name, subject_id: c.subject_id, level: c.level, parent_id: c.parent_id ?? '', order_index: c.order_index.toString() });
    } else {
      setEditingChapter(null);
      setChapForm({ name: '', subject_id: selectedSubject, level: level ?? 'major', parent_id: parentId ?? '', order_index: '1' });
    }
    setChapterModal(true);
  };

  const handleSaveChapter = () => {
    if (!chapForm.name.trim()) return;
    saveChapter({
      id: editingChapter?.id ?? generateId(),
      subject_id: chapForm.subject_id || selectedSubject,
      level: chapForm.level,
      name: chapForm.name.trim(),
      parent_id: chapForm.parent_id || null,
      order_index: parseInt(chapForm.order_index) || 1,
      created_at: editingChapter?.created_at ?? new Date().toISOString(),
    });
    load();
    setChapterModal(false);
  };

  const handleDeleteChapter = (id: string, name: string) => {
    const hasChildren = chapters.some(c => c.parent_id === id);
    if (hasChildren) { alert(`"${name}" 아래에 하위 단원이 있어 삭제할 수 없습니다.`); return; }
    if (confirm(`"${name}" 단원을 삭제하시겠습니까?`)) { deleteChapter(id); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">단원 관리</h2>
          <p className="text-sm text-slate-500">과목 및 단원 체계를 관리합니다 (대단원 → 중단원 → 소단원)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openSubjectModal()}>
            <Plus size={14} /> 과목 추가
          </Button>
          <Button size="sm" onClick={() => openChapterModal()}>
            <Plus size={14} /> 대단원 추가
          </Button>
        </div>
      </div>

      {/* 과목 탭 */}
      <div className="flex gap-2 items-center">
        {subjects.map(s => (
          <div
            key={s.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
              selectedSubject === s.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => setSelectedSubject(s.id)}
          >
            {getSubjectDisplayName(s.name) ?? s.name}
            <Button
              size="sm"
              variant="ghost"
              className={`p-0.5 w-5 h-5 ${selectedSubject === s.id ? 'hover:bg-blue-700 text-white' : ''}`}
              onClick={e => { e.stopPropagation(); openSubjectModal(s); }}
            >
              <Pencil size={10} />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => openSubjectModal()}>
          <Plus size={14} />
        </Button>
      </div>

      {/* 단원 트리 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{getSubjectDisplayName(subjects.find(s => s.id === selectedSubject)?.name) ?? '과목'} 단원 구조</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openChapterModal(undefined, undefined, 'major')}>
              <Plus size={14} /> 대단원 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {majorChapters.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BookMarked size={32} className="mx-auto mb-2 opacity-30" />
              <p>단원이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {majorChapters.map(major => {
                const middles = subjectChapters.filter(c => c.parent_id === major.id && c.level === 'middle');
                return (
                  <div key={major.id} className={`border rounded-xl p-4 ${LEVEL_COLORS.major}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={LEVEL_BADGE.major}>대단원</Badge>
                        <span className="font-semibold text-slate-800">{major.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openChapterModal(undefined, major.id, 'middle')}>
                          <Plus size={12} /> 중단원
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openChapterModal(major)}>
                          <Pencil size={12} />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteChapter(major.id, major.name)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>

                    {middles.length > 0 && (
                      <div className="mt-3 ml-4 space-y-2">
                        {middles.map(middle => {
                          const minors = subjectChapters.filter(c => c.parent_id === middle.id && c.level === 'minor');
                          return (
                            <div key={middle.id} className={`border rounded-lg p-3 ${LEVEL_COLORS.middle}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ChevronRight size={14} className="text-slate-400" />
                                  <Badge variant={LEVEL_BADGE.middle}>중단원</Badge>
                                  <span className="text-sm font-medium text-slate-700">{middle.name}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => openChapterModal(undefined, middle.id, 'minor')}>
                                    <Plus size={11} /> 소단원
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => openChapterModal(middle)}>
                                    <Pencil size={11} />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteChapter(middle.id, middle.name)}>
                                    <Trash2 size={11} />
                                  </Button>
                                </div>
                              </div>

                              {minors.length > 0 && (
                                <div className="mt-2 ml-6 flex flex-wrap gap-2">
                                  {minors.map(minor => (
                                    <div key={minor.id} className={`flex items-center gap-1 border rounded-lg px-2 py-1 ${LEVEL_COLORS.minor}`}>
                                      <span className="text-xs text-slate-600">{minor.name}</span>
                                      <button
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                        onClick={() => handleDeleteChapter(minor.id, minor.name)}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 과목 모달 */}
      <Modal open={subjectModal} onClose={() => setSubjectModal(false)} title={editingSubject ? '과목 수정' : '과목 추가'}>
        <div className="space-y-4">
          <Input
            label="과목명 *"
            placeholder="예: 수학(상)"
            value={subjForm.name}
            onChange={e => setSubjForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="코드"
            placeholder="예: MATH-A"
            value={subjForm.code}
            onChange={e => setSubjForm(f => ({ ...f, code: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSubjectModal(false)}>취소</Button>
            <Button onClick={handleSaveSubject}>저장</Button>
          </div>
        </div>
      </Modal>

      {/* 단원 모달 */}
      <Modal open={chapterModal} onClose={() => setChapterModal(false)} title={editingChapter ? '단원 수정' : '단원 추가'}>
        <div className="space-y-4">
          <Select
            label="단원 레벨"
            value={chapForm.level}
            onChange={e => setChapForm(f => ({ ...f, level: e.target.value as Chapter['level'] }))}
            options={[
              { value: 'major', label: '대단원' },
              { value: 'middle', label: '중단원' },
              { value: 'minor', label: '소단원' },
            ]}
          />
          <Input
            label="단원명 *"
            placeholder="단원 이름"
            value={chapForm.name}
            onChange={e => setChapForm(f => ({ ...f, name: e.target.value }))}
          />
          {chapForm.level !== 'major' && (
            <Select
              label="상위 단원"
              value={chapForm.parent_id}
              onChange={e => setChapForm(f => ({ ...f, parent_id: e.target.value }))}
              options={chapters
                .filter(c => c.subject_id === (chapForm.subject_id || selectedSubject) &&
                  (chapForm.level === 'middle' ? c.level === 'major' : c.level === 'middle'))
                .map(c => ({ value: c.id, label: c.name }))}
              placeholder="상위 단원 선택"
            />
          )}
          <Input
            label="순서"
            type="number"
            min="1"
            value={chapForm.order_index}
            onChange={e => setChapForm(f => ({ ...f, order_index: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setChapterModal(false)}>취소</Button>
            <Button onClick={handleSaveChapter}>저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

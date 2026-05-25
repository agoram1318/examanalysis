'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Pencil, Check, X, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import { getSubjectDisplayName } from '@/lib/report-utils';

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type Subject    = { id: number; name: string };
type UnitMajor  = { id: number; name: string; subject_id: number };
type UnitMiddle = { id: number; name: string; major_unit_id: number };
type UnitSmall  = { id: number; name: string; middle_unit_id: number };

// ─────────────────────────────────────────────
// 공통 서브 컴포넌트
// ─────────────────────────────────────────────

/** 한 열의 제목 + 선택된 상위 항목 브레드크럼 */
function ColumnHeader({
  title,
  breadcrumb,
  count,
}: {
  title: string;
  breadcrumb?: string;
  count: number;
}) {
  return (
    <div
      className="px-4 py-3 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: 'var(--fg-main)' }}>
          {title}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
        >
          {count}개
        </span>
      </div>
      {breadcrumb && (
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--fg-muted)' }}>
          {breadcrumb}
        </p>
      )}
    </div>
  );
}

/** 추가 폼 (한 줄 input + 저장 버튼) */
function AddForm({
  placeholder,
  onAdd,
  disabled,
  disabledMsg,
}: {
  placeholder: string;
  onAdd: (name: string) => Promise<string | null>;
  disabled?: boolean;
  disabledMsg?: string;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [ok, setOk]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    setOk(false);
    const err = await onAdd(trimmed);
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setValue('');
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    }
  }

  return (
    <div
      className="px-4 py-3 border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
    >
      {disabled ? (
        <p className="text-xs text-center py-1" style={{ color: 'var(--fg-muted)' }}>
          {disabledMsg ?? '상위 항목을 먼저 선택하세요.'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none transition-all"
            style={{
              background: 'var(--bg-base)',
              borderColor: 'var(--border)',
              color: 'var(--fg-main)',
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = 'var(--accent)')
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border)')
            }
          />
          <button
            type="submit"
            disabled={saving || !value.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', whiteSpace: 'nowrap' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            추가
          </button>
        </form>
      )}
      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#dc2626' }}>
          <AlertCircle size={12} />
          {error}
        </div>
      )}
      {ok && (
        <p className="mt-1.5 text-xs font-semibold" style={{ color: '#16a34a' }}>
          ✓ 저장되었습니다.
        </p>
      )}
    </div>
  );
}

/** 항목 행 (선택 + 인라인 수정) */
function ItemRow<T extends { id: number; name: string }>({
  item,
  selected,
  onSelect,
  onRename,
  hasChildren,
}: {
  item: T;
  selected: boolean;
  onSelect: () => void;
  onRename: (id: number, name: string) => Promise<string | null>;
  hasChildren?: boolean;
}) {
  const [editing, setEditing]   = useState(false);
  const [editVal, setEditVal]   = useState(item.name);
  const [saving, setSaving]     = useState(false);
  const [renameErr, setRenameErr] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = editVal.trim();
    if (!trimmed || trimmed === item.name) { setEditing(false); return; }
    setSaving(true);
    const err = await onRename(item.id, trimmed);
    setSaving(false);
    if (err) {
      setRenameErr(err);
    } else {
      setEditing(false);
      setRenameErr(null);
    }
  }

  function handleCancel() {
    setEditVal(item.name);
    setEditing(false);
    setRenameErr(null);
  }

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all border-b last:border-b-0"
      style={{
        borderColor: 'var(--border)',
        background: selected ? 'var(--accent-lt)' : 'transparent',
      }}
      onClick={() => { if (!editing) onSelect(); }}
    >
      {editing ? (
        <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <input
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            className="flex-1 text-sm px-2 py-0.5 rounded border outline-none"
            style={{
              background: '#fff',
              borderColor: 'var(--accent)',
              color: 'var(--fg-main)',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: '#16a34a' }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button
            onClick={handleCancel}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: '#dc2626' }}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <span
            className="flex-1 text-sm truncate"
            style={{ color: selected ? 'var(--accent)' : 'var(--fg-main)', fontWeight: selected ? 600 : 400 }}
          >
            {item.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-orange-100"
            style={{ color: 'var(--fg-muted)' }}
            title="이름 수정"
          >
            <Pencil size={12} />
          </button>
          {hasChildren && (
            <ChevronRight size={13} style={{ color: selected ? 'var(--accent)' : 'var(--fg-muted)' }} />
          )}
        </>
      )}
      {renameErr && (
        <p className="text-xs" style={{ color: '#dc2626' }}>{renameErr}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function UnitsPage() {
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [majors,      setMajors]      = useState<UnitMajor[]>([]);
  const [middles,     setMiddles]     = useState<UnitMiddle[]>([]);
  const [smalls,      setSmalls]      = useState<UnitSmall[]>([]);

  const [selSubject,  setSelSubject]  = useState<number | null>(null);
  const [selMajor,    setSelMajor]    = useState<number | null>(null);
  const [selMiddle,   setSelMiddle]   = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  // ── 초기 로드
  useEffect(() => {
    supabase
      .from('subjects')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setSubjects(data ?? []);
        setLoading(false);
      });
  }, []);

  // ── 과목 선택 → 대단원 로드
  const selectSubject = useCallback(async (id: number) => {
    setSelSubject(id);
    setSelMajor(null);
    setSelMiddle(null);
    setMiddles([]);
    setSmalls([]);
    const { data } = await supabase
      .from('units_major')
      .select('id, name, subject_id')
      .eq('subject_id', id)
      .order('name');
    setMajors(data ?? []);
  }, []);

  // ── 대단원 선택 → 중단원 로드
  const selectMajor = useCallback(async (id: number) => {
    setSelMajor(id);
    setSelMiddle(null);
    setSmalls([]);
    const { data } = await supabase
      .from('units_middle')
      .select('id, name, major_unit_id')
      .eq('major_unit_id', id)
      .order('name');
    setMiddles(data ?? []);
  }, []);

  // ── 중단원 선택 → 소단원 로드
  const selectMiddle = useCallback(async (id: number) => {
    setSelMiddle(id);
    const { data } = await supabase
      .from('units_small')
      .select('id, name, middle_unit_id')
      .eq('middle_unit_id', id)
      .order('name');
    setSmalls(data ?? []);
  }, []);

  // ─────────────────────────────────────────────
  // 추가 핸들러
  // ─────────────────────────────────────────────

  async function addSubject(name: string): Promise<string | null> {
    const dup = subjects.find((s) => s.name === name);
    if (dup) return '이미 존재하는 과목명입니다.';
    const { data, error } = await supabase
      .from('subjects')
      .insert({ name })
      .select('id, name')
      .single();
    if (error) return error.message;
    setSubjects((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return null;
  }

  async function addMajor(name: string): Promise<string | null> {
    if (!selSubject) return '과목을 먼저 선택하세요.';
    const { data, error } = await supabase
      .from('units_major')
      .insert({ name, subject_id: selSubject })
      .select('id, name, subject_id')
      .single();
    if (error) return error.message;
    setMajors((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return null;
  }

  async function addMiddle(name: string): Promise<string | null> {
    if (!selMajor) return '대단원을 먼저 선택하세요.';
    const { data, error } = await supabase
      .from('units_middle')
      .insert({ name, major_unit_id: selMajor })
      .select('id, name, major_unit_id')
      .single();
    if (error) return error.message;
    setMiddles((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return null;
  }

  async function addSmall(name: string): Promise<string | null> {
    if (!selMiddle) return '중단원을 먼저 선택하세요.';
    const { data, error } = await supabase
      .from('units_small')
      .insert({ name, middle_unit_id: selMiddle })
      .select('id, name, middle_unit_id')
      .single();
    if (error) return error.message;
    setSmalls((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return null;
  }

  // ─────────────────────────────────────────────
  // 수정 핸들러
  // ─────────────────────────────────────────────

  async function renameSubject(id: number, name: string): Promise<string | null> {
    const dup = subjects.find((s) => s.name === name && s.id !== id);
    if (dup) return '이미 존재하는 과목명입니다.';
    const { error } = await supabase.from('subjects').update({ name }).eq('id', id);
    if (error) return error.message;
    setSubjects((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
    return null;
  }

  async function renameMajor(id: number, name: string): Promise<string | null> {
    const { error } = await supabase.from('units_major').update({ name }).eq('id', id);
    if (error) return error.message;
    setMajors((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
    return null;
  }

  async function renameMiddle(id: number, name: string): Promise<string | null> {
    const { error } = await supabase.from('units_middle').update({ name }).eq('id', id);
    if (error) return error.message;
    setMiddles((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
    return null;
  }

  async function renameSmall(id: number, name: string): Promise<string | null> {
    const { error } = await supabase.from('units_small').update({ name }).eq('id', id);
    if (error) return error.message;
    setSmalls((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
    return null;
  }

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────

  const selSubjectName = getSubjectDisplayName(subjects.find((s) => s.id === selSubject)?.name);
  const selMajorName   = majors.find((m) => m.id === selMajor)?.name;
  const selMiddleName  = middles.find((m) => m.id === selMiddle)?.name;

  const columns = [
    {
      title:       '과목',
      breadcrumb:  undefined as string | undefined,
      count:       subjects.length,
      placeholder: '새 과목명 입력',
      onAdd:       addSubject,
      disabled:    false,
      disabledMsg: undefined as string | undefined,
      items: subjects.map((s) => ({
        item:       { ...s, name: getSubjectDisplayName(s.name) ?? s.name },
        selected:   s.id === selSubject,
        onSelect:   () => selectSubject(s.id),
        onRename:   renameSubject,
        hasChildren: true,
      })),
    },
    {
      title:       '대단원',
      breadcrumb:  selSubjectName ? `과목: ${selSubjectName}` : undefined,
      count:       majors.length,
      placeholder: '새 대단원명 입력',
      onAdd:       addMajor,
      disabled:    !selSubject,
      disabledMsg: '과목을 먼저 선택하세요.',
      items: majors.map((m) => ({
        item:       m,
        selected:   m.id === selMajor,
        onSelect:   () => selectMajor(m.id),
        onRename:   renameMajor,
        hasChildren: true,
      })),
    },
    {
      title:       '중단원',
      breadcrumb:  selMajorName ? `대단원: ${selMajorName}` : undefined,
      count:       middles.length,
      placeholder: '새 중단원명 입력',
      onAdd:       addMiddle,
      disabled:    !selMajor,
      disabledMsg: '대단원을 먼저 선택하세요.',
      items: middles.map((m) => ({
        item:       m,
        selected:   m.id === selMiddle,
        onSelect:   () => selectMiddle(m.id),
        onRename:   renameMiddle,
        hasChildren: true,
      })),
    },
    {
      title:       '소단원',
      breadcrumb:  selMiddleName ? `중단원: ${selMiddleName}` : undefined,
      count:       smalls.length,
      placeholder: '새 소단원명 입력',
      onAdd:       addSmall,
      disabled:    !selMiddle,
      disabledMsg: '중단원을 먼저 선택하세요.',
      items: smalls.map((s) => ({
        item:       s,
        selected:   false,
        onSelect:   () => {},
        onRename:   renameSmall,
        hasChildren: false,
      })),
    },
  ];

  return (
    <div>
      {/* ── 페이지 헤더 ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--fg-main)' }}>
            과목 / 단원 관리
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--fg-sub)' }}>
          과목과 대·중·소단원 체계를 설정합니다. 항목 이름 위에 마우스를 올리면 수정 버튼이 나타납니다.
        </p>
      </div>

      {/* 사용 안내 */}
      <div
        className="rounded-xl px-5 py-3 mb-5 flex items-start gap-3"
        style={{ background: 'var(--accent-lt)', border: '1px solid #fed7aa' }}
      >
        <BookOpen size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
        <p className="text-sm leading-relaxed" style={{ color: '#7c2d12' }}>
          <strong>사용 방법:</strong> 과목 선택 → 대단원 선택 → 중단원 선택 순으로 진행하면 하위 단원이 표시됩니다.
          각 열 하단의 입력창에서 새 항목을 추가하고, 기존 항목에 마우스를 올려 ✏️ 버튼으로 이름을 수정할 수 있습니다.
          삭제 기능은 문항 데이터와의 연결 문제 방지를 위해 제공하지 않습니다.
        </p>
      </div>

      {/* ── 4단 패널 ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {columns.map((col) => (
            <div
              key={col.title}
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
                minHeight: 400,
              }}
            >
              <ColumnHeader
                title={col.title}
                breadcrumb={col.breadcrumb}
                count={col.count}
              />

              {/* 항목 목록 */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
                {col.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <BookOpen
                      size={28}
                      className="mb-2 opacity-20"
                      style={{ color: 'var(--fg-muted)' }}
                    />
                    <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {col.disabled
                        ? col.disabledMsg
                        : '항목이 없습니다. 아래에서 추가하세요.'}
                    </p>
                  </div>
                ) : (
                  col.items.map((row) => (
                    <ItemRow
                      key={row.item.id}
                      item={row.item}
                      selected={row.selected}
                      onSelect={row.onSelect}
                      onRename={row.onRename}
                      hasChildren={row.hasChildren}
                    />
                  ))
                )}
              </div>

              {/* 추가 폼 */}
              <AddForm
                placeholder={col.placeholder}
                onAdd={col.onAdd}
                disabled={col.disabled}
                disabledMsg={col.disabledMsg}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

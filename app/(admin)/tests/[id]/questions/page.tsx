'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import {
  getTestById, getQuestionsByTest, getChapters, saveQuestions,
  deleteQuestionsByTest, generateId
} from '@/lib/store';
import { Test, Question, Chapter } from '@/lib/types';

type QuestionForm = Omit<Question, 'created_at'>;

export default function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = getTestById(testId);
    if (!t) { router.push('/tests'); return; }
    setTest(t);
    setChapters(getChapters());
    const existing = getQuestionsByTest(testId);
    if (existing.length > 0) {
      setQuestions(existing.map(q => ({ ...q })));
    } else {
      setQuestions(createDefaultQuestions(testId, 25));
    }
  }, [testId, router]);

  function createDefaultQuestions(tid: string, count: number): QuestionForm[] {
    return Array.from({ length: count }, (_, i) => ({
      id: generateId(),
      test_id: tid,
      number: i + 1,
      chapter_id: '',
      correct_answer: '',
      score: i < 20 ? 4 : (i < 24 ? 5 : 9),
      question_type: i < 20 ? 'multiple' as const : 'short' as const,
      difficulty: 'medium' as const,
    }));
  }

  const updateQuestion = (idx: number, field: keyof QuestionForm, value: string | number) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const addQuestion = () => {
    setQuestions(qs => [...qs, {
      id: generateId(),
      test_id: testId,
      number: qs.length + 1,
      chapter_id: '',
      correct_answer: '',
      score: 4,
      question_type: 'multiple',
      difficulty: 'medium',
    }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, number: i + 1 })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      deleteQuestionsByTest(testId);
      const toSave: Question[] = questions.map(q => ({
        ...q,
        chapter_id: q.chapter_id || null,
        created_at: new Date().toISOString(),
      }));
      saveQuestions(toSave);
      router.push('/tests');
    } finally {
      setSaving(false);
    }
  };

  const totalScore = questions.reduce((s, q) => s + q.score, 0);

  const chapterOptions = [
    { value: '', label: '단원 선택 안함' },
    ...chapters.map(c => ({
      value: c.id,
      label: `${{ major: '▶', middle: '  ▷', minor: '    ·' }[c.level]} ${c.name}`,
    })),
  ];

  if (!test) return null;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/tests">
          <Button variant="ghost" size="sm"><ArrowLeft size={15} />목록으로</Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg-main)' }}>
            {test.title} — 문항 입력
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-sub)' }}>
            {questions.length}문항 · 합계{' '}
            <span style={{ color: totalScore === test.total_score ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {totalScore}점
            </span>
            {' '}/ {test.total_score}점
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={15} />저장
        </Button>
      </div>

      {totalScore !== test.total_score && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#fefce8', border: '1px solid #fde047', color: '#713f12' }}>
          ⚠️ 문항 배점 합계({totalScore}점)가 총점({test.total_score}점)과 다릅니다.
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>문항 목록</span>
          <Button size="sm" variant="outline" onClick={addQuestion}>
            <Plus size={13} /> 문항 추가
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--bg-base)' }}>
              <tr>
                {['번호', '정답', '배점', '유형', '난이도', '단원', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: 'var(--fg-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => (
                <tr key={q.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--bg-base)', color: 'var(--fg-sub)' }}>
                      {q.number}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-24 px-2 py-1.5 rounded-lg text-sm border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
                      placeholder={q.question_type === 'multiple' ? '1~5' : '숫자'}
                      value={q.correct_answer}
                      onChange={e => updateQuestion(idx, 'correct_answer', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number" min="1" max="100"
                      className="w-16 px-2 py-1.5 rounded-lg text-sm border focus:outline-none focus:ring-2"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
                      value={q.score}
                      onChange={e => updateQuestion(idx, 'score', parseInt(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="px-2 py-1.5 rounded-lg text-sm border focus:outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
                      value={q.question_type}
                      onChange={e => updateQuestion(idx, 'question_type', e.target.value)}
                    >
                      <option value="multiple">객관식</option>
                      <option value="short">단답형</option>
                      <option value="essay">서술형</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="px-2 py-1.5 rounded-lg text-sm border focus:outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
                      value={q.difficulty}
                      onChange={e => updateQuestion(idx, 'difficulty', e.target.value)}
                    >
                      <option value="easy">하</option>
                      <option value="medium">중</option>
                      <option value="hard">상</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="w-40 px-2 py-1.5 rounded-lg text-sm border focus:outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
                      value={q.chapter_id ?? ''}
                      onChange={e => updateQuestion(idx, 'chapter_id', e.target.value)}
                    >
                      {chapterOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeQuestion(idx)}
                      className="p-1 rounded transition-colors hover:bg-red-50"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <Button size="sm" variant="outline" onClick={addQuestion}>
          <Plus size={13} /> 문항 추가
        </Button>
        <div className="flex gap-2">
          <Link href="/tests"><Button variant="outline">취소</Button></Link>
          <Button onClick={handleSave} loading={saving}>
            <Save size={15} />저장 완료
          </Button>
        </div>
      </div>
    </div>
  );
}

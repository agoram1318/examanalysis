'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getTestById, getQuestionsByTest, getChapters, saveQuestions,
  deleteQuestionsByTest, generateId
} from '@/lib/store';
import { Test, Question, Chapter } from '@/lib/types';
import { getDifficultyLabel, getQuestionTypeLabel } from '@/lib/utils';

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
    setQuestions(qs => {
      const next = qs.filter((_, i) => i !== idx);
      return next.map((q, i) => ({ ...q, number: i + 1 }));
    });
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

  // 단원 옵션 (소단원 우선, 없으면 중단원/대단원)
  const chapterOptions = [
    { value: '', label: '단원 선택 안함' },
    ...chapters
      .sort((a, b) => {
        const levelOrder = { major: 0, middle: 1, minor: 2 };
        return levelOrder[a.level] - levelOrder[b.level];
      })
      .map(c => ({
        value: c.id,
        label: `${{ major: '▶', middle: '  ▷', minor: '    ·' }[c.level]} ${c.name}`,
      })),
  ];

  if (!test) return null;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/tests">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} />목록으로</Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-800">{test.title} — 문항 입력</h2>
          <p className="text-sm text-slate-500">
            {questions.length}문항 · 현재 합계 <span className={totalScore === test.total_score ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{totalScore}점</span> / {test.total_score}점
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          저장
        </Button>
      </div>

      {totalScore !== test.total_score && (
        <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          ⚠️ 문항 배점 합계({totalScore}점)가 총점({test.total_score}점)과 다릅니다. 저장 전 확인해주세요.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>문항 목록</CardTitle>
            <Button size="sm" variant="outline" onClick={addQuestion}>
              <Plus size={14} /> 문항 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-12">번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-32">정답</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-16">배점</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-28">유형</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-20">난이도</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">단원</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">
                        {q.number}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={q.question_type === 'multiple' ? '1~5' : '숫자 입력'}
                        value={q.correct_answer}
                        onChange={e => updateQuestion(idx, 'correct_answer', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={q.score}
                        onChange={e => updateQuestion(idx, 'score', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-between items-center">
        <Button size="sm" variant="outline" onClick={addQuestion}>
          <Plus size={14} /> 문항 추가
        </Button>
        <div className="flex gap-3">
          <Link href="/tests"><Button variant="outline">취소</Button></Link>
          <Button onClick={handleSave} loading={saving}>
            <Save size={16} />저장 완료
          </Button>
        </div>
      </div>
    </div>
  );
}

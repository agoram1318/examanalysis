'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Save, CheckCircle, XCircle, MinusCircle, ArrowRight, Users } from 'lucide-react';
import {
  getTests, getTestById, getQuestionsByTest, getStudentsByClass,
  getAnswersByStudentAndTest, saveAnswers, deleteAnswersByStudentAndTest,
  getClasses
} from '@/lib/store';
import { gradeStudentAnswers } from '@/lib/analysis';
import { Test, Question, Student, Class } from '@/lib/types';

function AnswerInputContent() {
  const searchParams = useSearchParams();
  const initTestId = searchParams.get('testId') ?? '';

  const [selectedTestId, setSelectedTestId] = useState(initTestId);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedStudents, setSavedStudents] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const tests = getTests();
  const classes = getClasses();

  useEffect(() => {
    if (!selectedTestId) return;
    const t = getTestById(selectedTestId);
    setTest(t ?? null);
    if (t) {
      const qs = getQuestionsByTest(selectedTestId);
      setQuestions(qs);
      const cls_students = getStudentsByClass(t.class_id);
      setStudents(cls_students);
      // 이미 답안 입력된 학생 목록
      const saved = new Set(
        cls_students
          .filter(s => getAnswersByStudentAndTest(s.id, selectedTestId).length > 0)
          .map(s => s.id)
      );
      setSavedStudents(saved);
      if (cls_students.length > 0) setSelectedStudentId(cls_students[0].id);
    }
  }, [selectedTestId]);

  useEffect(() => {
    if (!selectedStudentId || !selectedTestId) return;
    const existing = getAnswersByStudentAndTest(selectedStudentId, selectedTestId);
    if (existing.length > 0) {
      const map: Record<string, string> = {};
      existing.forEach(a => { map[a.question_id] = a.answer; });
      setAnswers(map);
    } else {
      setAnswers({});
    }
    setSaveSuccess(false);
  }, [selectedStudentId, selectedTestId]);

  const handleSave = async () => {
    if (!selectedStudentId || !test) return;
    setSaving(true);
    try {
      deleteAnswersByStudentAndTest(selectedStudentId, selectedTestId);
      const graded = gradeStudentAnswers(questions, answers, selectedStudentId, selectedTestId);
      saveAnswers(graded);
      setSavedStudents(prev => new Set([...prev, selectedStudentId]));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    await handleSave();
    const currentIdx = students.findIndex(s => s.id === selectedStudentId);
    if (currentIdx < students.length - 1) {
      setSelectedStudentId(students[currentIdx + 1].id);
    }
  };

  const totalEarned = questions.reduce((sum, q) => {
    const ans = answers[q.id] ?? '';
    const correct = ans.trim().toLowerCase() === q.correct_answer.trim().toLowerCase() && ans.trim() !== '';
    return sum + (correct ? q.score : 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">답안 입력</h2>
          <p className="text-sm text-slate-500">학생 답안을 입력하면 자동으로 채점됩니다</p>
        </div>
      </div>

      {/* 테스트/학생 선택 */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="테스트 선택"
              value={selectedTestId}
              onChange={e => setSelectedTestId(e.target.value)}
              options={tests.map(t => ({ value: t.id, label: t.title }))}
              placeholder="테스트를 선택하세요"
            />
            {students.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">학생 선택</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedStudentId === s.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : savedStudents.has(s.id)
                          ? 'bg-green-50 text-green-700 border-green-300'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {savedStudents.has(s.id) && selectedStudentId !== s.id && (
                        <span className="mr-1">✓</span>
                      )}
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {test && (
            <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
              <span>총점 {test.total_score}점</span>
              <span>·</span>
              <span>{questions.length}문항</span>
              <span>·</span>
              <span className="text-green-600 font-medium">{savedStudents.size}/{students.length}명 입력 완료</span>
            </div>
          )}
        </CardContent>
      </Card>

      {test && selectedStudentId && questions.length > 0 ? (
        <>
          {/* 현재 학생 미리보기 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-slate-800">
                {students.find(s => s.id === selectedStudentId)?.name} 학생 답안
              </h3>
              <Badge variant="info">
                예상 점수: {totalEarned}점 / {test.total_score}점 ({Math.round((totalEarned / test.total_score) * 100)}%)
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndNext}
                loading={saving}
              >
                저장 후 다음 학생 <ArrowRight size={14} />
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                className={saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <Save size={14} />
                {saveSuccess ? '저장됨!' : '저장'}
              </Button>
            </div>
          </div>

          {/* 답안 입력 그리드 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 객관식 */}
            {questions.filter(q => q.question_type === 'multiple').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>객관식 (1~5번 보기)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {questions.filter(q => q.question_type === 'multiple').map(q => {
                      const ans = answers[q.id] ?? '';
                      const isAnswered = ans.trim() !== '';
                      const isCorrect = isAnswered && ans.trim() === q.correct_answer.trim();
                      return (
                        <div key={q.id} className="flex items-center gap-3">
                          <span className="w-8 text-sm font-medium text-slate-500 text-right shrink-0">
                            {q.number}번
                          </span>
                          <div className="flex gap-1">
                            {['1', '2', '3', '4', '5'].map(n => (
                              <button
                                key={n}
                                onClick={() => setAnswers(a => ({ ...a, [q.id]: a[q.id] === n ? '' : n }))}
                                className={`w-8 h-8 rounded-full text-sm font-bold border-2 transition-all ${
                                  answers[q.id] === n
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-blue-400'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">({q.score}점)</span>
                          {isAnswered && (
                            isCorrect
                              ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                              : <XCircle size={16} className="text-red-500 shrink-0" />
                          )}
                          {!isAnswered && <MinusCircle size={16} className="text-slate-300 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 단답형/서술형 */}
            {questions.filter(q => q.question_type !== 'multiple').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>단답형 / 서술형</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {questions.filter(q => q.question_type !== 'multiple').map(q => {
                      const ans = answers[q.id] ?? '';
                      const isAnswered = ans.trim() !== '';
                      const isCorrect = isAnswered && ans.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                      return (
                        <div key={q.id} className="flex items-center gap-3">
                          <span className="w-8 text-sm font-medium text-slate-500 text-right shrink-0">
                            {q.number}번
                          </span>
                          <input
                            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="답안 입력"
                            value={ans}
                            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          />
                          <span className="text-xs text-slate-400 shrink-0">({q.score}점)</span>
                          {isAnswered && (
                            isCorrect
                              ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                              : <XCircle size={16} className="text-red-500 shrink-0" />
                          )}
                          {!isAnswered && <MinusCircle size={16} className="text-slate-300 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 전체 입력 현황 */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-6 text-sm">
                  <span className="text-green-600 font-medium">
                    ✓ 정답 {questions.filter(q => {
                      const a = answers[q.id] ?? '';
                      return a.trim() !== '' && a.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                    }).length}개
                  </span>
                  <span className="text-red-600 font-medium">
                    ✗ 오답 {questions.filter(q => {
                      const a = answers[q.id] ?? '';
                      return a.trim() !== '' && a.trim().toLowerCase() !== q.correct_answer.trim().toLowerCase();
                    }).length}개
                  </span>
                  <span className="text-slate-400">
                    - 미입력 {questions.filter(q => !answers[q.id]?.trim()).length}개
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveAndNext} loading={saving}>
                    저장 후 다음 학생 <ArrowRight size={14} />
                  </Button>
                  <Button size="sm" onClick={handleSave} loading={saving}>
                    <Save size={14} /> 저장
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-16 text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            {!selectedTestId
              ? <p>테스트를 선택해주세요</p>
              : questions.length === 0
              ? <p>
                  문항이 없습니다.{' '}
                  <Link href={`/tests/${selectedTestId}/questions`} className="text-blue-600 hover:underline">
                    문항을 먼저 입력해주세요
                  </Link>
                </p>
              : <p>학생을 선택해주세요</p>
            }
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AnswersPage() {
  return (
    <Suspense>
      <AnswerInputContent />
    </Suspense>
  );
}

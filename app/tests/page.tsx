'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plus, ClipboardList, Edit, Trash2, Eye, PenSquare } from 'lucide-react';
import { getTests, getClasses, getSubjects, getQuestionsByTest, getAnswersByTest, deleteTest } from '@/lib/store';
import { Test, Class, Subject } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const load = () => {
    setTests(getTests());
    setClasses(getClasses());
    setSubjects(getSubjects());
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id: string) => {
    if (confirm('테스트를 삭제하시겠습니까? 관련 답안도 모두 삭제됩니다.')) {
      deleteTest(id);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">테스트 목록</h2>
          <p className="text-sm text-slate-500 mt-0.5">총 {tests.length}개의 테스트</p>
        </div>
        <Link href="/tests/new">
          <Button>
            <Plus size={16} />
            새 테스트 만들기
          </Button>
        </Link>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">아직 테스트가 없습니다.</p>
            <Link href="/tests/new" className="mt-3 inline-block">
              <Button>
                <Plus size={16} /> 첫 번째 테스트 만들기
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map(test => {
            const cls = classes.find(c => c.id === test.class_id);
            const subject = subjects.find(s => s.id === test.subject_id);
            const questions = getQuestionsByTest(test.id);
            const answers = getAnswersByTest(test.id);
            const answeredStudents = new Set(answers.map(a => a.student_id)).size;

            return (
              <Card key={test.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800 text-base">{test.title}</h3>
                        <Badge variant="info">{subject?.name ?? '과목미상'}</Badge>
                        {questions.length > 0 && (
                          <Badge variant="outline">{questions.length}문항</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span>{cls?.name ?? '반 미지정'}</span>
                        <span>·</span>
                        <span>{formatDate(test.test_date)}</span>
                        <span>·</span>
                        <span>총점 {test.total_score}점</span>
                        {answeredStudents > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-green-600 font-medium">{answeredStudents}명 답안 입력됨</span>
                          </>
                        )}
                      </div>
                      {test.description && (
                        <p className="text-xs text-slate-400 mt-1">{test.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {questions.length > 0 && (
                        <Link href={`/answers?testId=${test.id}`}>
                          <Button size="sm" variant="outline">
                            <PenSquare size={14} />
                            답안입력
                          </Button>
                        </Link>
                      )}
                      {answeredStudents > 0 && (
                        <Link href={`/analysis/class?testId=${test.id}`}>
                          <Button size="sm" variant="secondary">
                            <Eye size={14} />
                            분석보기
                          </Button>
                        </Link>
                      )}
                      <Link href={`/tests/${test.id}/questions`}>
                        <Button size="sm" variant="ghost">
                          <Edit size={14} />
                          문항편집
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(test.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

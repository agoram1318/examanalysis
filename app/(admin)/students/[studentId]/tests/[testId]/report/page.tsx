'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, AlertCircle, Loader2, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, FileBarChart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass } from '@/lib/class-tests';
import { formatScoreValue, formatSubjectList, getQuestionSubjectName, scoreOrFallback } from '@/lib/report-utils';
import Button from '@/components/ui/Button';
import PrintReportLink from '@/components/reports/PrintReportLink';
import NarrativeSummarySection from '@/components/reports/NarrativeSummary';
import { generateStudentNarrativeSummary } from '@/lib/narrative-summary';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
type StudentRow = {
  id: number;
  student_name: string;
  student_code: string | null;
  class_id: number;
};

type ClassRow = {
  id: number;
  class_name: string | null;
  teacher_name: string | null;
  academy_name: string | null;
};

type TestRow = {
  id: number;
  title: string;
  grade: string | null;
  subject_name: string | null;
  exam_range_text: string | null;
  difficulty: number | null;
};

type QuestionRow = {
  id: number;
  question_number: number;
  question_format: 'objective' | 'subjective';
  answer: string | null;
  score: number;
  difficulty: number | null;
  question_comment: string | null;
  subject_name: string | null;
  major_unit_name: string | null;
  middle_unit_name: string | null;
  small_unit_name: string | null;
  subject_order: number;
  major_order: number;
  middle_order: number;
  small_order: number;
};

type AnswerRow = {
  question_id: number;
  selected_answer: string | null;
  is_guessed: boolean;
  is_blank: boolean;
  is_correct: boolean;
  earned_score: number;
};

type QA = QuestionRow & { ans: AnswerRow | null };

type CohortAnswerRow = {
  student_id: number;
  question_id: number;
  is_correct: boolean;
  earned_score: number;
};

type QuestionRate = {
  correctRate: number | null;
  correctCount: number;
  participantCount: number;
};

// ─────────────────────────────────────────────
// 유틸 함수
// ─────────────────────────────────────────────
function evalLabel(rate: number): { text: string; color: string; bg: string } {
  if (rate >= 80) return { text: '안정',      color: '#15803d', bg: '#f0fdf4' };
  if (rate >= 60) return { text: '보통',      color: '#ca8a04', bg: '#fefce8' };
  if (rate >= 40) return { text: '보완 필요', color: '#ea580c', bg: '#fff7ed' };
  return              { text: '집중 보완', color: '#dc2626', bg: '#fef2f2' };
}

function difficultyLabel(d: number | null): string {
  if (d === null) return '–';
  if (d <= 2) return `${d} (하)`;
  if (d <= 4) return `${d} (중)`;
  if (d <= 6) return `${d} (상)`;
  return `${d} (최상)`;
}

function difficultyGroup(d: number | null): string {
  if (d === null) return '미설정';
  if (d <= 2) return '난이도 하 (1~2)';
  if (d <= 4) return '난이도 중 (3~4)';
  if (d <= 6) return '난이도 상 (5~6)';
  return '난이도 최상 (7~8)';
}

function questionFormatLabel(format: QuestionRow['question_format']): string {
  return format === 'subjective' ? '주관식' : '객관식';
}

function difficultySummary(avg: number | null): string {
  if (avg === null) return '난이도 미설정';
  if (avg <= 2) return '난이도 하 중심';
  if (avg <= 4) return '난이도 중 중심';
  if (avg <= 6) return '난이도 상 중심';
  return '난이도 최상 중심';
}

function curriculumCompare(a: QuestionRow, b: QuestionRow): number {
  return (
    a.subject_order - b.subject_order ||
    a.major_order - b.major_order ||
    a.middle_order - b.middle_order ||
    a.small_order - b.small_order ||
    a.question_number - b.question_number
  );
}

function unitFallback(qa: QuestionRow): string {
  return qa.small_unit_name || qa.middle_unit_name || qa.major_unit_name || '해당 단원';
}

type QuestionStatus = 'wrong' | 'guessed_wrong' | 'guessed_correct' | 'blank';
type FeatureKind = 'condition' | 'calculation' | 'high' | 'concept' | 'visual' | 'application' | 'general';

type FeatureFocus = {
  kind: FeatureKind;
  focus: string;
  action: string;
};

function getQuestionStatus(qa: QA): QuestionStatus | null {
  if (!qa.ans || qa.ans.is_blank) return 'blank';
  if (qa.ans.is_guessed && qa.ans.is_correct) return 'guessed_correct';
  if (qa.ans.is_guessed && !qa.ans.is_correct) return 'guessed_wrong';
  if (!qa.ans.is_correct) return 'wrong';
  return null;
}

function featureFocusFromComment(comment: string): FeatureFocus {
  if (/조건|해석|읽/.test(comment)) {
    return {
      kind: 'condition',
      focus: '조건을 읽고 풀이 방향을 잡는 과정',
      action: '문제 조건을 식으로 정리하고 풀이 흐름을 먼저 세우는 연습',
    };
  }
  if (/계산|실수|검산/.test(comment)) {
    return {
      kind: 'calculation',
      focus: '계산 과정의 정확성과 검산',
      action: '중간 계산을 차분히 기록하고 검산하는 습관',
    };
  }
  if (/중상|고난|난도|변별|킬러/.test(comment)) {
    return {
      kind: 'high',
      focus: '풀이 방향을 스스로 세우는 과정',
      action: '처음 접근 전략을 세우고 필요한 개념을 연결하는 훈련',
    };
  }
  if (/개념|정의|원리/.test(comment)) {
    return {
      kind: 'concept',
      focus: '핵심 개념을 정확히 적용하는 과정',
      action: '개념의 의미와 적용 조건을 다시 확인하는 연습',
    };
  }
  if (/그래프|도형|그림|좌표/.test(comment)) {
    return {
      kind: 'visual',
      focus: '그림과 식을 연결해 해석하는 과정',
      action: '조건을 시각화하고 식과 연결하는 연습',
    };
  }
  if (/활용|응용|서술|추론/.test(comment)) {
    return {
      kind: 'application',
      focus: '개념을 새로운 상황에 적용하는 과정',
      action: '문제 상황을 단원 개념과 연결하는 훈련',
    };
  }
  return {
    kind: 'general',
    focus: '풀이 방향을 차분히 정리하는 과정',
    action: '문제에서 요구하는 조건과 풀이 단계를 정리하는 연습',
  };
}

function fallbackQuestionComment(qa: QuestionRow, status: QuestionStatus): string {
  const unit = unitFallback(qa);
  const difficulty = qa.difficulty === null ? difficultyGroup(qa.difficulty) : `난이도 ${qa.difficulty}`;

  if (status === 'guessed_correct') {
    return `${qa.question_number}번 문항은 ${unit} 단원의 ${difficulty} 문항입니다. 정답은 맞혔지만 찍음 체크가 있어 풀이 과정의 안정성을 다시 확인하는 것이 좋습니다.`;
  }
  if (status === 'guessed_wrong') {
    return `${qa.question_number}번 문항은 ${unit} 단원의 ${difficulty} 문항에서 찍음 체크와 오답이 함께 나타났습니다. 개념 적용 과정과 풀이 시작점을 다시 점검할 필요가 있습니다.`;
  }
  if (status === 'blank') {
    return `${qa.question_number}번 문항은 ${unit} 단원의 ${difficulty} 문항이 미응답으로 남았습니다. 시간 배분과 문제 접근 순서를 함께 점검해 주세요.`;
  }

  return `${qa.question_number}번 문항은 ${unit} 단원의 ${difficulty} 문항에서 오답이 발생했습니다. 해당 단원의 개념 적용 과정과 풀이 흐름을 다시 점검할 필요가 있습니다.`;
}

function questionLearningComment(qa: QA, status: QuestionStatus): string {
  const comment = qa.question_comment?.trim();
  if (!comment) {
    return fallbackQuestionComment(qa, status);
  }

  const feature = featureFocusFromComment(comment);
  const base = `${qa.question_number}번 문항은 ${feature.focus}이 중요했습니다.`;

  if (status === 'guessed_correct') {
    return `${base} 정답은 맞혔지만 찍음 체크가 있어 실력 안정성이 충분하다고 보기는 어렵습니다. ${feature.action}이 도움이 됩니다.`;
  }
  if (status === 'guessed_wrong') {
    return `${base} 찍음 체크와 오답이 함께 나타난 것으로 보아 풀이 방향을 잡기 전 단계에서 어려움이 있었을 가능성이 큽니다. ${feature.action}이 필요합니다.`;
  }
  if (status === 'blank') {
    return `${base} 미응답으로 남은 만큼 시간 배분 또는 문제 접근 단계에서 어려움이 있었을 가능성이 있습니다. ${feature.action}부터 보완해 주세요.`;
  }

  return `${base} 오답이 발생한 것으로 보아 단순 확인보다 ${feature.action}이 필요합니다.`;
}

function learningPointPreview(qa: QuestionRow): string {
  const comment = qa.question_comment?.trim();
  if (!comment) return '–';
  return featureFocusFromComment(comment).focus;
}

function summarizeQuestionCommentTrends(qaRows: QA[]): string | null {
  const targetRows = qaRows.filter((qa) => {
    const status = getQuestionStatus(qa);
    return status !== null && status !== 'guessed_correct' && qa.question_comment?.trim();
  });
  if (targetRows.length === 0) return null;

  const counts = new Map<FeatureKind, number>();
  targetRows.forEach((qa) => {
    const comment = qa.question_comment?.trim();
    if (!comment) return;
    const kind = featureFocusFromComment(comment).kind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  });

  const topKind = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general';
  const hasHighDifficulty = targetRows.some((qa) => {
    const comment = qa.question_comment?.trim() ?? '';
    return qa.difficulty !== null && qa.difficulty >= 5 || /중상|고난|난도|변별|킬러/.test(comment);
  });

  let summary: string;
  if (topKind === 'condition') {
    summary = '조건을 해석하고 식으로 정리하는 문항에서 보완이 필요합니다.';
  } else if (topKind === 'calculation') {
    summary = '계산 정확도와 풀이 과정 점검에서 실점 가능성이 보입니다.';
  } else if (topKind === 'concept') {
    summary = '핵심 개념을 문제 상황에 맞게 적용하는 연습이 필요합니다.';
  } else if (topKind === 'visual') {
    summary = '그래프나 도형 정보를 식과 연결해 해석하는 과정에서 보완이 필요합니다.';
  } else if (topKind === 'application') {
    summary = '익숙하지 않은 상황에 개념을 적용하는 문항에서 흔들림이 나타났습니다.';
  } else if (topKind === 'high') {
    summary = '풀이 방향을 먼저 세워야 하는 변별 문항에서 보완이 필요합니다.';
  } else {
    summary = '문제 조건을 정리하고 풀이 단계를 차분히 세우는 훈련이 필요합니다.';
  }

  if (hasHighDifficulty) {
    return `${summary} 특히 중상 난도 문항에서는 계산을 시작하기 전에 접근 방향을 먼저 세우는 훈련이 중요합니다.`;
  }
  return summary;
}

interface GroupStat { name: string; total: number; correct: number }

type CauseStat = {
  name: string;
  count: number;
  color: string;
};

function groupStats(items: QA[], keyFn: (qa: QA) => string): GroupStat[] {
  const map = new Map<string, GroupStat>();
  items.forEach((qa) => {
    const key = keyFn(qa);
    if (!map.has(key)) map.set(key, { name: key, total: 0, correct: 0 });
    const s = map.get(key)!;
    s.total++;
    if (qa.ans?.is_correct) s.correct++;
  });
  return [...map.values()];
}

function statRate(stat: GroupStat): number {
  return stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
}

function weakestStat(stats: GroupStat[]): GroupStat | null {
  const valid = stats.filter((stat) => stat.total > 0);
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => statRate(a) - statRate(b))[0];
}

function correctRateText(stat: GroupStat | null): string {
  if (!stat) return '–';
  return `${statRate(stat).toFixed(1)}%`;
}

function cleanStatName(name: string): string {
  return name.replace(/^▶\s*/, '');
}

function scoreTone(rate: number): { color: string; bg: string; text: string } {
  if (rate >= 80) return { color: '#15803d', bg: '#f0fdf4', text: '안정' };
  if (rate >= 60) return { color: '#f97316', bg: '#fff7ed', text: '보통' };
  if (rate >= 40) return { color: '#ea580c', bg: '#fff7ed', text: '보완 필요' };
  return { color: '#dc2626', bg: '#fef2f2', text: '집중 보완' };
}

function buildCauseStats(qaRows: QA[]): CauseStat[] {
  const causes: CauseStat[] = [
    { name: '단원 개념 보완', count: 0, color: '#f97316' },
    { name: '난이도 대응 부족', count: 0, color: '#dc2626' },
    { name: '조건 해석/풀이 방향', count: 0, color: '#7c3aed' },
    { name: '찍음/확신 부족', count: 0, color: '#ca8a04' },
    { name: '미응답/시간 관리', count: 0, color: '#64748b' },
  ];
  const byName = new Map(causes.map((cause) => [cause.name, cause]));

  qaRows.forEach((qa) => {
    const status = getQuestionStatus(qa);
    if (!status || status === 'guessed_correct') return;

    const comment = qa.question_comment?.trim() ?? '';
    let name = '단원 개념 보완';
    if (!qa.ans || qa.ans.is_blank) name = '미응답/시간 관리';
    else if (qa.ans?.is_guessed) name = '찍음/확신 부족';
    else if (/조건|해석|식\s*정리|풀이\s*방향/.test(comment)) name = '조건 해석/풀이 방향';
    else if (qa.difficulty !== null && qa.difficulty >= 5) name = '난이도 대응 부족';

    const cause = byName.get(name);
    if (cause) cause.count += 1;
  });

  return causes.filter((cause) => cause.count > 0);
}

function buildCoreDiagnoses(
  scoreRate: number,
  weakestUnit: GroupStat | null,
  weakestDiff: GroupStat | null,
  guessRate: number
): string[] {
  const lines: string[] = [];

  if (scoreRate >= 80) lines.push('기본 문항 대응은 전반적으로 안정적입니다.');
  else if (scoreRate >= 60) lines.push('기본기는 갖추었지만 일부 단원에서 개념 적용이 흔들립니다.');
  else lines.push('기본 개념 정리와 쉬운 문항부터의 반복 확인이 우선입니다.');

  if (weakestDiff && statRate(weakestDiff) < 80) {
    lines.push(`${cleanStatName(weakestDiff.name)} 구간에서 정답률이 낮아 보완이 필요합니다.`);
  } else {
    lines.push('난이도 구간별 성취도는 큰 편차 없이 유지되고 있습니다.');
  }

  if (weakestUnit && statRate(weakestUnit) < 80) {
    lines.push(`${cleanStatName(weakestUnit.name)} 단원의 오답 원인을 먼저 점검해 주세요.`);
  } else if (guessRate >= 25) {
    lines.push('정답 여부와 별개로 찍음 표시가 있어 풀이 근거를 확인하는 훈련이 필요합니다.');
  } else {
    lines.push('풀이 확신도와 단원별 균형이 비교적 안정적입니다.');
  }

  return lines.slice(0, 3);
}

function buildPrescriptions(
  weakestUnit: GroupStat | null,
  weakestDiff: GroupStat | null,
  wrongCount: number,
  blankCount: number,
  guessedCount: number
): string[] {
  const lines: string[] = [];

  if (weakestUnit && statRate(weakestUnit) < 80) {
    lines.push(`${cleanStatName(weakestUnit.name)} 단원의 기본 개념을 먼저 복습하고 대표 예제를 다시 풀어보세요.`);
  } else {
    lines.push('정답률이 안정적인 단원은 유지 학습을 하고, 틀린 문항의 풀이 흐름만 다시 확인하세요.');
  }

  if (weakestDiff && /5~6|7~8/.test(weakestDiff.name)) {
    lines.push(`${cleanStatName(weakestDiff.name)} 문항은 풀이 전 조건을 정리하고 접근 방향을 쓰는 훈련이 필요합니다.`);
  } else if (weakestDiff) {
    lines.push(`${cleanStatName(weakestDiff.name)} 문항은 개념 확인 후 같은 난이도의 유사 문항으로 정확도를 높여 주세요.`);
  }

  if (wrongCount > 0) {
    lines.push('오답 문항은 해설 확인 후 유사 문항을 3문항 이상 다시 풀어보는 것을 권장합니다.');
  }
  if (blankCount > 0) {
    lines.push('미응답 문항이 있으므로 쉬운 문항을 먼저 확보하는 시간 배분 연습을 병행해 주세요.');
  } else if (guessedCount > 0) {
    lines.push('찍음 표시가 있는 문항은 정답 여부와 관계없이 풀이 근거를 말로 설명해 보세요.');
  }

  return lines.slice(0, 4);
}

function generateComment(qaRows: QA[], totalScore: number, totalPossible: number): string {
  const parts: string[] = [];
  const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const answered = qaRows.filter((qa) => qa.ans && !qa.ans.is_blank).length;
  const guessedCount = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessRate = answered > 0 ? (guessedCount / answered) * 100 : 0;

  // 점수 기반
  if (scoreRate >= 90) {
    parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  } else if (scoreRate >= 70) {
    parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  } else if (scoreRate >= 50) {
    parts.push('개념 이해와 문제 적용 훈련이 함께 필요합니다.');
  } else {
    parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');
  }

  // 찍음 비율
  if (guessRate < 10) {
    parts.push('풀이 확신도가 비교적 안정적입니다.');
  } else if (guessRate < 25) {
    parts.push('일부 문항에서 확신 부족이 나타났습니다.');
  } else if (guessRate < 40) {
    parts.push('중상 난도 문항에서 접근 불안정성이 보입니다.');
  } else {
    parts.push('문제 접근력과 시간 관리 훈련이 필요합니다.');
  }

  // 찍어서 맞은 비율
  if (guessedCount > 0 && guessedCorrect / guessedCount > 0.5) {
    parts.push('맞힌 문항도 풀이 과정을 점검할 필요가 있습니다.');
  }

  const trendComment = summarizeQuestionCommentTrends(qaRows);
  if (trendComment) {
    parts.push(trendComment);
  }

  // 후반 미응답
  const lastQ = qaRows.slice(Math.floor(qaRows.length * 0.75));
  const blankAtEnd = lastQ.filter((qa) => !qa.ans || qa.ans.is_blank).length;
  if (blankAtEnd >= 2) {
    parts.push('시간 배분 훈련과 변별 문항 접근 전략이 필요합니다.');
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 섹션 타이틀
// ─────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-1 h-5 rounded-full"
        style={{ background: 'var(--accent)' }}
      />
      <h2 className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
        {children}
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 분석 테이블
// ─────────────────────────────────────────────
function AnalysisTable({ stats }: { stats: GroupStat[] }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bg-base)' }}>
          <tr>
            {['단원명 / 유형명', '문항 수', '정답 수', '정답률', '평가'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-semibold"
                style={{
                  color: 'var(--fg-muted)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
            const ev = evalLabel(rate);
            return (
              <tr
                key={s.name}
                style={{
                  background: i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <td
                  className="px-4 py-2.5 text-sm font-medium"
                  style={{ color: 'var(--fg-main)' }}
                >
                  {s.name}
                </td>
                <td
                  className="px-4 py-2.5 text-sm text-center"
                  style={{ color: 'var(--fg-sub)' }}
                >
                  {s.total}
                </td>
                <td
                  className="px-4 py-2.5 text-sm text-center font-semibold"
                  style={{ color: '#16a34a' }}
                >
                  {s.correct}
                </td>
                <td className="px-4 py-2.5 text-sm text-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 6, background: 'var(--border)' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${rate}%`,
                          background: rate >= 80 ? '#22c55e' : rate >= 60 ? '#eab308' : rate >= 40 ? '#f97316' : '#ef4444',
                          borderRadius: 9999,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span
                      className="font-semibold text-xs w-10 shrink-0 text-right"
                      style={{ color: 'var(--fg-main)' }}
                    >
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: ev.bg, color: ev.color }}
                  >
                    {ev.text}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatBarList({ stats, emptyText }: { stats: GroupStat[]; emptyText: string }) {
  if (stats.length === 0) return <EmptyState text={emptyText} />;

  return (
    <div className="space-y-2">
      {stats.map((stat) => {
        const rate = statRate(stat);
        const ev = evalLabel(rate);
        return (
          <div
            key={stat.name}
            className="rounded-lg border px-4 py-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg-main)' }}>
                  {cleanStatName(stat.name)}
                </p>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                  {stat.correct}/{stat.total}문항 정답
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold" style={{ color: 'var(--fg-main)' }}>
                  {rate.toFixed(1)}%
                </span>
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold"
                  style={{ background: ev.bg, color: ev.color }}
                >
                  {ev.text}
                </span>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ background: '#e7e5df' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, rate))}%`, background: ev.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccuracyGauge({
  rate,
  correct,
  total,
}: {
  rate: number;
  correct: number;
  total: number;
}) {
  const tone = scoreTone(rate);
  const clamped = Math.min(100, Math.max(0, rate));

  return (
    <div
      className="report-visual-card flex flex-col items-center justify-center rounded-xl border p-4"
      style={{ background: tone.bg, borderColor: 'var(--border)' }}
    >
      <div
        className="relative h-28 w-28 rounded-full"
        style={{
          background: `conic-gradient(${tone.color} ${clamped * 3.6}deg, #e7e5df 0deg)`,
        }}
      >
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-2xl font-bold" style={{ color: tone.color }}>
            {rate.toFixed(1)}%
          </span>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-muted)' }}>
            {tone.text}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>
        {correct}/{total}문항 정답
      </p>
      <p className="mt-1 text-xs text-center" style={{ color: 'var(--fg-muted)' }}>
        전체 문항 기준 정답률
      </p>
    </div>
  );
}

function CauseDistribution({ causes }: { causes: CauseStat[] }) {
  const total = causes.reduce((sum, cause) => sum + cause.count, 0);
  if (total === 0) {
    return <EmptyState text="오답 또는 미응답 문항이 없습니다." />;
  }

  return (
    <div className="report-visual-card rounded-xl border p-4" style={{ background: 'var(--bg-base)', borderColor: 'var(--border)' }}>
      <div className="space-y-3">
        {causes.map((cause) => {
          const rate = total > 0 ? (cause.count / total) * 100 : 0;
          return (
            <div key={cause.name}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--fg-main)' }}>{cause.name}</span>
                <span className="text-xs font-bold" style={{ color: 'var(--fg-sub)' }}>
                  {cause.count}개 · {rate.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full" style={{ background: '#e7e5df' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(6, rate)}%`, background: cause.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementCards({
  stats,
  emptyText,
  variant = 'unit',
}: {
  stats: GroupStat[];
  emptyText: string;
  variant?: 'unit' | 'difficulty';
}) {
  if (stats.length === 0) return <EmptyState text={emptyText} />;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {stats.map((stat) => {
        const rate = statRate(stat);
        const tone = scoreTone(rate);
        return (
          <div
            key={stat.name}
            className="report-visual-card rounded-xl border p-4"
            style={{ background: '#fff', borderColor: 'var(--border)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold" style={{ color: 'var(--fg-main)' }}>
                  {cleanStatName(stat.name)}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
                  {variant === 'difficulty' ? '난이도 구간' : '단원 성취도'} · {stat.correct}/{stat.total}문항
                </p>
              </div>
              <span
                className="rounded px-2 py-1 text-xs font-semibold"
                style={{ background: tone.bg, color: tone.color }}
              >
                {tone.text}
              </span>
            </div>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-2xl font-bold" style={{ color: tone.color }}>{rate.toFixed(1)}%</span>
              <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>정답률</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full" style={{ background: '#e7e5df' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, rate))}%`, background: tone.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreCompareBar({
  studentScore,
  totalPossible,
  cohortAverage,
}: {
  studentScore: number;
  totalPossible: number;
  cohortAverage: number | null;
}) {
  const studentRate = totalPossible > 0 ? (studentScore / totalPossible) * 100 : 0;
  const averageRate = cohortAverage !== null && totalPossible > 0 ? (cohortAverage / totalPossible) * 100 : 0;

  return (
    <div className="report-visual-card rounded-xl border p-4" style={{ background: '#fff', borderColor: 'var(--border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: 'var(--fg-main)' }}>내 점수 vs 전체 평균</p>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          {cohortAverage === null ? '응시 데이터 부족' : `전체 평균 ${formatScoreValue(cohortAverage)}점`}
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold" style={{ color: 'var(--fg-sub)' }}>
            <span>내 점수</span>
            <span>{formatScoreValue(studentScore)}점</span>
          </div>
          <div className="h-3 rounded-full bg-stone-200">
            <div className="h-3 rounded-full" style={{ width: `${Math.min(100, studentRate)}%`, background: 'var(--accent)' }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold" style={{ color: 'var(--fg-sub)' }}>
            <span>전체 평균</span>
            <span>{cohortAverage === null ? '산출 전' : `${formatScoreValue(cohortAverage)}점`}</span>
          </div>
          <div className="h-3 rounded-full bg-stone-200">
            <div className="h-3 rounded-full bg-slate-500" style={{ width: `${Math.min(100, averageRate)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionTimeline({ qaRows }: { qaRows: QA[] }) {
  if (qaRows.length === 0) return <EmptyState text="문항 정보가 없습니다." />;

  return (
    <div className="report-visual-card rounded-xl border p-4" style={{ background: '#fff', borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap gap-2">
        {qaRows.map((qa) => {
          const ans = qa.ans;
          const hasAnswer = ans && !ans.is_blank;
          const bg = !hasAnswer ? '#e2e8f0' : ans.is_correct ? '#dcfce7' : '#fee2e2';
          const color = !hasAnswer ? '#64748b' : ans.is_correct ? '#15803d' : '#dc2626';
          return (
            <div key={qa.id} className="relative flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold" style={{ background: bg, color, borderColor: '#d6d3d1' }}>
              {qa.question_number}
              {ans?.is_guessed && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-orange-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionAnalysisGraph({
  qaRows,
  questionRates,
}: {
  qaRows: QA[];
  questionRates: Map<number, QuestionRate>;
}) {
  if (qaRows.length === 0) return <EmptyState text="문항 정보가 없습니다." />;

  return (
    <div className="report-visual-card rounded-xl border p-4" style={{ background: '#fff', borderColor: 'var(--border)' }}>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))' }}>
        {qaRows.map((qa) => {
          const rateInfo = questionRates.get(qa.id);
          const rate = rateInfo?.correctRate ?? null;
          const ans = qa.ans;
          const hasAnswer = ans && !ans.is_blank;
          const statusLabel = !hasAnswer ? '미응답' : ans.is_correct ? '정답' : '오답';
          const statusColor = !hasAnswer ? '#64748b' : ans.is_correct ? '#16a34a' : '#dc2626';
          const highDifficulty = (qa.difficulty ?? 0) >= 6;
          const barHeight = rate === null ? 12 : Math.max(12, Math.round(rate * 0.78));

          return (
            <div key={qa.id} className="break-inside-avoid rounded-lg border bg-stone-50 px-2.5 py-3" style={{ borderColor: highDifficulty ? '#fb923c' : 'var(--border)' }}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-stone-950">{qa.question_number}번</p>
                  <p className="text-[10px] text-stone-500">난도 {qa.difficulty ?? '–'}</p>
                </div>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${statusColor}18`, color: statusColor }}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex h-24 items-end justify-center rounded-md bg-white px-2 pb-2">
                <div className="relative w-full rounded-t-md" style={{ height: `${barHeight}%`, background: rate === null ? '#cbd5e1' : highDifficulty ? '#f97316' : '#2563eb' }}>
                  {ans?.is_guessed && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-orange-500" />}
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] font-bold text-stone-900">
                정답률 {rate === null ? '산출 전' : `${rate.toFixed(0)}%`}
              </p>
              <p className="mt-0.5 text-center text-[10px] text-stone-500">
                {rateInfo ? `${rateInfo.correctCount}/${rateInfo.participantCount}명` : '응시 데이터 부족'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function StudentReportPage({
  params,
}: {
  params: Promise<{ studentId: string; testId: string }>;
}) {
  const { studentId: studentIdStr, testId: testIdStr } = use(params);
  const studentId = Number(studentIdStr);
  const testId = Number(testIdStr);

  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [cls, setCls]         = useState<ClassRow | null>(null);
  const [test, setTest]       = useState<TestRow | null>(null);
  const [qaRows, setQaRows]   = useState<QA[]>([]);
  const [cohortAnswers, setCohortAnswers] = useState<CohortAnswerRow[]>([]);

  // ── 데이터 로드
  useEffect(() => {
    if (isNaN(studentId) || isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      // 1. 학생
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('id, student_name, student_code, class_id')
        .eq('id', studentId)
        .single();

      if (studentErr || !studentData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setStudent(studentData);

      // 2. 반
      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .eq('id', studentData.class_id)
        .single();

      if (classErr || !classData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCls(classData);

      const assigned = await fetchTestsForClass(studentData.class_id);
      if (!assigned.some((t) => t.id === testId)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 3. 테스트 (과목 포함)
      const { data: testRaw, error: testErr } = await supabase
        .from('tests')
        .select('id, title, grade, exam_range_text')
        .eq('id', testId)
        .single();

      if (testErr || !testRaw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTest({
        id:           testRaw.id,
        title:        testRaw.title,
        grade:        testRaw.grade,
        subject_name: null,
        exam_range_text: testRaw.exam_range_text ?? null,
        difficulty:   null, // difficulty 컬럼은 SQL 마이그레이션 후 사용 가능
      });

      // difficulty 컬럼은 SQL 마이그레이션 후 존재 — 별도 조회로 graceful 처리
      void (async () => {
        try {
          const { data: diffData } = await supabase
            .from('tests')
            .select('difficulty')
            .eq('id', testId)
            .single();
          if (diffData) {
            setTest((prev) => prev ? { ...prev, difficulty: (diffData as { difficulty?: number | null }).difficulty ?? null } : prev);
          }
        } catch {
          // difficulty 컬럼 없으면 null 유지
        }
      })();

      // 4. 문항 (단원 조인)
      const { data: questionsRaw } = await supabase
        .from('questions')
        .select(`
          id, question_number, question_format, answer, score,
          difficulty, question_comment,
          subjects:subject_id(name, order_index),
          units_major:major_unit_id(name, order_index),
          units_middle:middle_unit_id(name, order_index),
          units_small:small_unit_id(name, order_index)
        `)
        .eq('test_id', testId)
        .order('question_number');

      type UnitRaw = { name: string } | { name: string }[] | null;
      function pickName(raw: unknown): string | null {
        const u = raw as UnitRaw;
        if (!u) return null;
        if (Array.isArray(u)) return u[0]?.name ?? null;
        return u.name ?? null;
      }
      function pickOrder(raw: unknown): number {
        const u = raw as ({ order_index?: number | null } | { order_index?: number | null }[] | null);
        const value = Array.isArray(u) ? u[0]?.order_index : u?.order_index;
        return typeof value === 'number' ? value : 9999;
      }

      const questionCount = questionsRaw?.length ?? 0;
      const questions: QuestionRow[] = (questionsRaw ?? []).map((q) => {
        return {
          id:               q.id,
          question_number:  q.question_number,
          question_format:  q.question_format === 'subjective' ? 'subjective' : 'objective',
          answer:           q.answer,
          score:            scoreOrFallback(q.score, questionCount),
          difficulty:       q.difficulty,
          question_comment: q.question_comment ?? null,
          subject_name:     getQuestionSubjectName(q.subjects),
          major_unit_name:  pickName(q.units_major),
          middle_unit_name: pickName(q.units_middle),
          small_unit_name:  pickName(q.units_small),
          subject_order:    pickOrder(q.subjects),
          major_order:      pickOrder(q.units_major),
          middle_order:     pickOrder(q.units_middle),
          small_order:      pickOrder(q.units_small),
        };
      });

      if (questions.length === 0) {
        setQaRows([]);
        setLoading(false);
        return;
      }
      setTest((prev) => prev ? {
        ...prev,
        subject_name: formatSubjectList(questions.map((q) => q.subject_name)),
      } : prev);

      // 5. 학생 답안
      const questionIds = questions.map((q) => q.id);
      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .eq('student_id', studentId)
        .in('question_id', questionIds);

      const { data: cohortRaw } = await supabase
        .from('student_answers')
        .select('student_id, question_id, is_correct, earned_score')
        .in('question_id', questionIds);

      const answerMap = new Map<number, AnswerRow>();
      (answersRaw ?? []).forEach((a) => {
        answerMap.set(a.question_id, {
          question_id:     a.question_id,
          selected_answer: a.selected_answer,
          is_guessed:      a.is_guessed,
          is_blank:        a.is_blank,
          is_correct:      a.is_correct,
          earned_score:    Number(a.earned_score),
        });
      });

      const combined: QA[] = questions.map((q) => ({
        ...q,
        ans: answerMap.get(q.id) ?? null,
      }));

      setQaRows(combined);
      setCohortAnswers((cohortRaw ?? []).map((a) => ({
        student_id: a.student_id,
        question_id: a.question_id,
        is_correct: a.is_correct,
        earned_score: Number(a.earned_score),
      })));
      setLoading(false);
    }

    load();
  }, [studentId, testId]);

  // ── 집계 계산
  const totalPossible = qaRows.reduce((s, qa) => s + qa.score, 0);
  const totalScore    = qaRows.reduce((s, qa) => s + (qa.ans?.earned_score ?? 0), 0);
  const correctCount  = qaRows.filter((qa) => qa.ans?.is_correct).length;
  const wrongCount    = qaRows.filter((qa) => qa.ans && !qa.ans.is_correct && !qa.ans.is_blank).length;
  const blankCount    = qaRows.filter((qa) => !qa.ans || qa.ans.is_blank).length;
  const guessedCount  = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessedWrong  = qaRows.filter((qa) => qa.ans?.is_guessed && !qa.ans?.is_correct).length;
  const answeredCount = qaRows.filter((qa) => qa.ans && !qa.ans.is_blank).length;
  const scoreRate     = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const guessRate     = answeredCount > 0 ? (guessedCount / answeredCount) * 100 : 0;
  const difficultyValues = qaRows.map((qa) => qa.difficulty).filter((d): d is number => typeof d === 'number');
  const questionAvgDifficulty = difficultyValues.length > 0
    ? difficultyValues.reduce((sum, d) => sum + d, 0) / difficultyValues.length
    : null;
  // 문항 평균 → 테스트 직접 설정 → null 순으로 폴백
  const averageDifficulty = questionAvgDifficulty ?? (test?.difficulty ?? null);
  const difficultySummaryText = difficultySummary(averageDifficulty);

  const questionIds = qaRows.map((qa) => qa.id);
  const answersByStudent = new Map<number, CohortAnswerRow[]>();
  cohortAnswers.forEach((answer) => {
    if (!answersByStudent.has(answer.student_id)) answersByStudent.set(answer.student_id, []);
    answersByStudent.get(answer.student_id)!.push(answer);
  });
  const completedStudentScores = [...answersByStudent.values()]
    .filter((answers) => questionIds.length > 0 && questionIds.every((id) => answers.some((a) => a.question_id === id)))
    .map((answers) => answers.reduce((sum, answer) => sum + answer.earned_score, 0));
  const cohortAverage = completedStudentScores.length > 1
    ? completedStudentScores.reduce((sum, score) => sum + score, 0) / completedStudentScores.length
    : null;
  const questionRates = new Map<number, QuestionRate>();
  qaRows.forEach((qa) => {
    const submitted = [...answersByStudent.values()].filter((answers) => answers.some((a) => a.question_id === qa.id));
    const participantCount = submitted.length;
    const correctCountForQuestion = submitted.filter((answers) => answers.find((a) => a.question_id === qa.id)?.is_correct).length;
    questionRates.set(qa.id, {
      correctRate: participantCount > 0 ? (correctCountForQuestion / participantCount) * 100 : null,
      correctCount: correctCountForQuestion,
      participantCount,
    });
  });

  // 단원별 성취도 (대단원)
  const curriculumRows = [...qaRows].sort(curriculumCompare);
  const subjectStats = groupStats(curriculumRows, (qa) => qa.subject_name || '미분류');
  const majorStats = groupStats(curriculumRows, (qa) =>
    `${qa.subject_name || '미분류'} > ${qa.major_unit_name || '미분류'}`
  );
  // 중단원별
  const middleStats = groupStats(curriculumRows, (qa) =>
    qa.middle_unit_name
      ? `${qa.subject_name || '미분류'} > ${qa.major_unit_name || '미분류'} > ${qa.middle_unit_name}`
      : `${qa.subject_name || '미분류'} > ${qa.major_unit_name || '미분류'} > 미분류`
  );
  // 난이도별
  const diffStats = groupStats(qaRows, (qa) => difficultyGroup(qa.difficulty));
  const DIFF_ORDER = ['난이도 하 (1~2)', '난이도 중 (3~4)', '난이도 상 (5~6)', '난이도 최상 (7~8)', '미설정'];
  const diffStatsSorted = [...diffStats].sort(
    (a, b) => DIFF_ORDER.indexOf(a.name) - DIFF_ORDER.indexOf(b.name)
  );
  const weakestUnit = weakestStat(majorStats);
  const weakestDiff = weakestStat(diffStatsSorted);
  const coreDiagnoses = buildCoreDiagnoses(scoreRate, weakestUnit, weakestDiff, guessRate);
  const prescriptions = buildPrescriptions(weakestUnit, weakestDiff, wrongCount, blankCount, guessedCount);
  const causeStats = buildCauseStats(qaRows);

  // 자동 코멘트
  const comment = qaRows.length > 0
    ? generateComment(qaRows, totalScore, totalPossible)
    : '';
  const narrativeSummary = generateStudentNarrativeSummary(qaRows);
  const questionCommentPoints = curriculumRows.filter((qa) => getQuestionStatus(qa));

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound || !student || !cls || !test) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--fg-main)' }}>
          학생 정보를 찾을 수 없습니다.
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
          존재하지 않거나 삭제된 학생입니다.
        </p>
        <Link href="/tests">
          <Button variant="outline" size="sm">테스트 목록으로</Button>
        </Link>
      </div>
    );
  }

  const infoItems = [
    { label: '학생명',   value: student.student_name },
    { label: '학생 코드', value: student.student_code || '–' },
    { label: '테스트명', value: test.title },
    { label: '학년',     value: test.grade || '–' },
    { label: '과목',     value: test.subject_name || '–' },
    { label: '테스트 범위', value: test.exam_range_text?.trim() || '범위 미입력' },
    {
      label: '테스트 난이도',
      value: averageDifficulty === null
        ? '난이도 미설정'
        : questionAvgDifficulty !== null
          ? `문항 평균 난이도 ${averageDifficulty.toFixed(1)} / 8 · ${difficultySummaryText}`
          : `대표 난이도 ${averageDifficulty} / 8 · ${difficultySummaryText}`,
    },
    { label: '강사명',   value: cls.teacher_name || '–' },
    { label: '학원명',   value: cls.academy_name || '–' },
    { label: '반명',     value: cls.class_name || '–' },
  ];

  const primaryCards = [
    { label: '총점', value: `${formatScoreValue(totalScore)} / ${formatScoreValue(totalPossible)}점`, sub: '획득 점수', accent: true },
    { label: '전체 응시자 평균점수', value: cohortAverage === null ? '산출 전' : `${formatScoreValue(cohortAverage)}점`, sub: cohortAverage === null ? '응시 데이터 부족' : `완료 ${completedStudentScores.length}명 기준`, accent: false },
    { label: '취약 단원', value: weakestUnit ? cleanStatName(weakestUnit.name) : '–', sub: correctRateText(weakestUnit), accent: false },
    { label: '보완 난이도', value: weakestDiff ? cleanStatName(weakestDiff.name) : '–', sub: correctRateText(weakestDiff), accent: false },
  ];
  const secondaryMetrics = [
    { label: '정답 수', value: `${correctCount}개` },
    { label: '오답 수', value: `${wrongCount}개` },
    { label: '미응답 수', value: `${blankCount}개` },
    { label: '찍음 수', value: `${guessedCount}개` },
    { label: '찍어서 맞음', value: `${guessedCorrect}개` },
    { label: '찍어서 틀림', value: `${guessedWrong}개` },
  ];

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="report-wrap" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── 페이지 헤더 (네비게이션) ── */}
      <div className="flex items-start justify-between mb-5 no-print">
        <div className="flex items-start gap-3">
          <Link href={`/classes/${cls.id}/answers`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} /> 답안 입력으로 돌아가기
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{test.title}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--fg-sub)' }}>{cls.class_name || '반'}</span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-base font-bold" style={{ color: 'var(--fg-main)' }}>
              {student.student_name}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              학생별 분석표
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/classes/${cls.id}/analysis`}>
            <Button variant="outline" size="sm">
              <BarChart3 size={14} /> 반 전체 분석 보기
            </Button>
          </Link>
          <PrintReportLink href={`/students/${studentId}/tests/${testId}/print`} />
        </div>
      </div>

      {/* ── 리포트 본문 ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >

        {/* ── 리포트 헤더 ── */}
        <div
          className="px-8 py-6"
          style={{
            background: 'var(--sidebar-bg)',
            color: '#fff',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileBarChart size={18} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold tracking-widest uppercase opacity-70">
                  봉샘스쿨
                </span>
              </div>
              <h1 className="text-xl font-bold mb-1">학생별 학습 진단 리포트</h1>
              <p className="text-sm opacity-60">{test.title}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                {student.student_name}
              </p>
              {student.student_code && (
                <p className="text-sm font-mono opacity-60 mt-0.5">{student.student_code}</p>
              )}
            </div>
          </div>

          {/* 학생 기본 정보 그리드 */}
          <div
            className="mt-5 grid gap-x-6 gap-y-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-xs opacity-50 shrink-0">{item.label}</span>
                <span className="text-sm font-medium truncate opacity-90">{item.value}</span>
              </div>
            ))}
          </div>

          {/* 생성일 — 인쇄 시만 표시 */}
          <p className="print-only mt-3 text-xs opacity-50">생성일: {today}</p>
        </div>

        {/* ── 본문 콘텐츠 ── */}
        <div className="px-8 py-6 space-y-8">

          {/* ① 종합 결과 카드 */}
          <section className="report-section">
            <SectionTitle>종합 결과</SectionTitle>
            <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
              <AccuracyGauge rate={scoreRate} correct={correctCount} total={qaRows.length} />
              <div className="grid gap-3 md:grid-cols-2">
                {primaryCards.map((card) => (
                  <div
                    key={card.label}
                    className="report-visual-card rounded-xl p-4"
                    style={{
                      background: card.accent ? 'var(--accent)' : 'var(--bg-base)',
                      border: `1px solid ${card.accent ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <p
                      className="text-xs font-medium mb-2"
                      style={{ color: card.accent ? 'rgba(255,255,255,0.8)' : 'var(--fg-muted)' }}
                    >
                      {card.label}
                    </p>
                    <p
                      className="text-xl font-bold leading-tight"
                      style={{ color: card.accent ? '#fff' : 'var(--fg-main)' }}
                    >
                      {card.value}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: card.accent ? 'rgba(255,255,255,0.75)' : 'var(--fg-muted)' }}
                    >
                      {card.sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}
            >
              {secondaryMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border px-3 py-2"
                  style={{ background: '#fafaf9', borderColor: 'var(--border)' }}
                >
                  <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{metric.label}</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--fg-main)' }}>{metric.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="report-section">
            <SectionTitle>점수 비교</SectionTitle>
            <ScoreCompareBar studentScore={totalScore} totalPossible={totalPossible} cohortAverage={cohortAverage} />
          </section>

          {/* ② 단원별 성취도 */}
          <section className="report-section">
            <SectionTitle>단원별 성취도</SectionTitle>
            {majorStats.length === 0 ? (
              <EmptyState text="문항에 단원 정보가 입력되지 않았습니다." />
            ) : (
              <div className="space-y-3">
                <AnalysisTable
                  stats={subjectStats.map((s) => ({ ...s, name: `▶ ${s.name}` }))}
                />
                <AchievementCards stats={majorStats} emptyText="단원 정보가 없습니다." />
                <AnalysisTable
                  stats={majorStats.map((s) => ({ ...s, name: `▶ ${s.name}` }))}
                />
                {middleStats.filter((s) => !s.name.includes('미분류') || majorStats.length > 1).length > 0 && (
                  <AnalysisTable stats={middleStats} />
                )}
              </div>
            )}
          </section>

          {/* ③ 난이도별 성취도 */}
          <section className="report-section">
            <SectionTitle>난이도별 성취도</SectionTitle>
            {diffStatsSorted.length === 0 ? (
              <EmptyState text="문항에 난이도 정보가 입력되지 않았습니다." />
            ) : (
              <div className="space-y-3">
                <AchievementCards stats={diffStatsSorted} emptyText="난이도 정보가 없습니다." variant="difficulty" />
                <AnalysisTable stats={diffStatsSorted} />
              </div>
            )}
          </section>

          <section className="report-section">
            <SectionTitle>문항별 O/X 타임라인</SectionTitle>
            <QuestionTimeline qaRows={qaRows} />
          </section>

          {/* ⑤ 문항별 결과표 */}
          <section className={`report-section ${qaRows.length > 10 ? 'page-break-before' : ''}`}>
            <SectionTitle>문항별 분석 그래프</SectionTitle>
            <QuestionAnalysisGraph qaRows={qaRows} questionRates={questionRates} />
          </section>

          <section className="report-section">
            <SectionTitle>문항별 결과</SectionTitle>
            <QuestionTable qaRows={qaRows} />
          </section>

          {questionCommentPoints.length > 0 && (
            <section className="report-section">
              <SectionTitle>오답 문항 해설 포인트</SectionTitle>
              <div
                className="rounded-xl px-5 py-4"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
              >
                <ul className="space-y-2">
                  {questionCommentPoints.map((qa) => (
                    <li key={qa.id} className="text-sm leading-relaxed" style={{ color: 'var(--fg-main)' }}>
                      <span className="font-semibold">{qa.question_number}번:</span>{' '}
                      {questionLearningComment(qa, getQuestionStatus(qa) ?? 'wrong')}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="report-section">
            <SectionTitle>오답 원인 분포</SectionTitle>
            <CauseDistribution causes={causeStats} />
          </section>

          <section className="report-section report-interpretation-block">
            <SectionTitle>핵심 진단</SectionTitle>
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
            >
              <ul className="space-y-2">
                {coreDiagnoses.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-relaxed" style={{ color: 'var(--fg-main)' }}>
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ⑥ 자동 코멘트 */}
          {comment && (
            <section className="report-section report-interpretation-block">
              <SectionTitle>종합 학습 코멘트</SectionTitle>
              <div
                className="rounded-xl px-6 py-5"
                style={{
                  background: 'var(--accent-lt)',
                  border: '1px solid #fed7aa',
                }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: '#7c2d12' }}
                >
                  {comment}
                </p>
              </div>
            </section>
          )}

          <section className="report-section report-interpretation-block">
            <SectionTitle>추천 학습 처방</SectionTitle>
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: '#f8fafc', border: '1px solid var(--border)' }}
            >
              <ul className="space-y-2">
                {prescriptions.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-relaxed" style={{ color: 'var(--fg-main)' }}>
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 서술형 학습 총평 */}
          <section className="report-section report-interpretation-block">
            <SectionTitle>학습 총평</SectionTitle>
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: '#fff', border: '1px solid var(--border)' }}
            >
              <NarrativeSummarySection result={narrativeSummary} />
            </div>
          </section>

        </div>

        {/* ── 리포트 하단 */}
        <div
          className="px-8 py-4 flex items-center justify-between"
          style={{
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            봉샘스쿨 학습 진단 리포트 · {student.student_name} · {test.title}
          </p>
          <div className="flex gap-2 no-print">
            <Link href={`/classes/${cls.id}/answers`}>
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} /> 답안 입력
              </Button>
            </Link>
            <Link href={`/classes/${cls.id}/analysis`}>
              <Button variant="accent" size="sm">
                <BarChart3 size={14} /> 반 전체 분석
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 빈 상태
// ─────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl px-5 py-8 text-center"
      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: 문항별 결과표
// ─────────────────────────────────────────────
function QuestionTable({ qaRows }: { qaRows: QA[] }) {
  if (qaRows.length === 0) {
    return <EmptyState text="문항 정보가 없습니다." />;
  }

  const cols = [
    { label: '번호',      w: 52 },
    { label: '문항 형식', w: 72 },
    { label: '정답',      w: 60 },
    { label: '학생 답',   w: 72 },
    { label: '결과',      w: 56 },
    { label: '획득 점수', w: 72 },
    { label: '배점',      w: 56 },
    { label: '찍음',      w: 52 },
    { label: '미응답',    w: 60 },
    { label: '과목',      w: 96 },
    { label: '대단원',    w: 100 },
    { label: '중단원',    w: 100 },
    { label: '소단원',    w: 100 },
    { label: '난이도',    w: 80 },
    { label: '학습 포인트', w: 160 },
  ];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="overflow-x-auto">
        <table style={{ minWidth: 1240, borderCollapse: 'collapse', width: '100%' }}>
          <thead style={{ background: 'var(--bg-base)' }}>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.label}
                  className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap"
                  style={{
                    color: 'var(--fg-muted)',
                    width: col.w,
                    minWidth: col.w,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {qaRows.map((qa, i) => {
              const ans = qa.ans;
              const hasAnswer = ans && !ans.is_blank;
              const rowBg = i % 2 === 0 ? 'var(--bg-card)' : '#fafaf9';

              return (
                <tr
                  key={qa.id}
                  style={{ background: rowBg, borderTop: '1px solid var(--border)' }}
                >
                  {/* 번호 */}
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}
                    >
                      {qa.question_number}
                    </span>
                  </td>

                  {/* 문항 형식 */}
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: qa.question_format === 'subjective' ? '#eef2ff' : 'var(--accent-lt)',
                        color: qa.question_format === 'subjective' ? '#4338ca' : 'var(--accent)',
                      }}
                    >
                      {questionFormatLabel(qa.question_format)}
                    </span>
                  </td>

                  {/* 정답 */}
                  <td
                    className="px-3 py-2 text-center text-sm font-semibold"
                    style={{ color: 'var(--fg-main)' }}
                  >
                    {qa.answer ?? '–'}
                  </td>

                  {/* 학생 답 */}
                  <td
                    className="px-3 py-2 text-center text-sm"
                    style={{
                      color: hasAnswer
                        ? ans.is_correct ? '#16a34a' : '#dc2626'
                        : 'var(--fg-muted)',
                      fontWeight: hasAnswer ? 600 : 400,
                    }}
                  >
                    {ans?.is_blank ? '미응답' : (ans?.selected_answer ?? '–')}
                  </td>

                  {/* 결과 */}
                  <td className="px-3 py-2 text-center">
                    {!ans ? (
                      <MinusCircle size={15} className="mx-auto" style={{ color: 'var(--fg-muted)' }} />
                    ) : ans.is_blank ? (
                      <MinusCircle size={15} className="mx-auto" style={{ color: '#94a3b8' }} />
                    ) : ans.is_correct ? (
                      <CheckCircle2 size={15} className="mx-auto" style={{ color: '#16a34a' }} />
                    ) : (
                      <XCircle size={15} className="mx-auto" style={{ color: '#dc2626' }} />
                    )}
                  </td>

                  {/* 획득 점수 */}
                  <td
                    className="px-3 py-2 text-center text-sm font-semibold"
                    style={{
                      color: hasAnswer && ans.is_correct ? '#16a34a' : 'var(--fg-muted)',
                    }}
                  >
                    {ans ? `${formatScoreValue(ans.earned_score)}점` : '–'}
                  </td>

                  {/* 배점 */}
                  <td
                    className="px-3 py-2 text-center text-sm font-semibold"
                    style={{ color: 'var(--fg-sub)' }}
                  >
                    {formatScoreValue(qa.score)}점
                  </td>

                  {/* 찍음 */}
                  <td className="px-3 py-2 text-center">
                    {ans?.is_guessed ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ background: '#fff7ed', color: '#ea580c' }}
                      >
                        찍음
                      </span>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>–</span>
                    )}
                  </td>

                  {/* 미응답 */}
                  <td className="px-3 py-2 text-center">
                    {ans?.is_blank ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        미응답
                      </span>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>–</span>
                    )}
                  </td>

                  {/* 대단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.subject_name ?? '–'}
                  </td>

                  {/* 대단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.major_unit_name ?? '–'}
                  </td>

                  {/* 중단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.middle_unit_name ?? '–'}
                  </td>

                  {/* 소단원 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {qa.small_unit_name ?? '–'}
                  </td>

                  {/* 난이도 */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--fg-sub)' }}>
                    {difficultyLabel(qa.difficulty)}
                  </td>

                  {/* 학습 포인트 */}
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--fg-sub)' }}>
                    {learningPointPreview(qa)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

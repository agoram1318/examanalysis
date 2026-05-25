'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchTestsForClass } from '@/lib/class-tests';
import {
  pickUnitName,
  difficultyGroup,
  DIFF_ORDER,
  formatReportDate,
  type GroupStat,
} from '@/lib/report-utils';
import ReportPage from '@/components/reports/ReportPage';
import ReportHeader from '@/components/reports/ReportHeader';
import ReportSection from '@/components/reports/ReportSection';
import ReportTable, { ReportTd, ReportTr } from '@/components/reports/ReportTable';
import PrintToolbar from '@/components/reports/PrintToolbar';
import ReportComment from '@/components/reports/ReportComment';
import Button from '@/components/ui/Button';

type QA = {
  id: number;
  question_number: number;
  question_format: 'objective' | 'subjective';
  answer: string | null;
  score: number;
  difficulty: number | null;
  question_comment: string | null;
  major_unit_name: string | null;
  middle_unit_name: string | null;
  small_unit_name: string | null;
  subject_order: number;
  major_order: number;
  middle_order: number;
  small_order: number;
  ans: {
    selected_answer: string | null;
    is_guessed: boolean;
    is_blank: boolean;
    is_correct: boolean;
    earned_score: number;
  } | null;
};

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

function difficultySummary(avg: number | null): string {
  if (avg === null) return '난이도 미설정';
  if (avg <= 2) return '기본 확인 중심';
  if (avg <= 4) return '기본 적용 중심';
  if (avg <= 6) return '중상 난도 중심';
  return '고난도/킬러 중심';
}

function questionFormatLabel(format: QA['question_format']): string {
  return format === 'subjective' ? '주관식' : '객관식';
}

function curriculumCompare(a: QA, b: QA): number {
  return (
    a.subject_order - b.subject_order ||
    a.major_order - b.major_order ||
    a.middle_order - b.middle_order ||
    a.small_order - b.small_order ||
    a.question_number - b.question_number
  );
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
    if (qa.ans?.is_blank || !qa.ans?.selected_answer) name = '미응답/시간 관리';
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

  if (weakestDiff && /5~6|7~8|중상|고난/.test(weakestDiff.name)) {
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

type QuestionStatus = 'wrong' | 'guessed_wrong' | 'guessed_correct' | 'blank';
type FeatureKind = 'condition' | 'calculation' | 'high' | 'concept' | 'visual' | 'application' | 'general';

type FeatureFocus = {
  kind: FeatureKind;
  focus: string;
  action: string;
};

function unitFallback(qa: QA): string {
  return qa.small_unit_name || qa.middle_unit_name || qa.major_unit_name || '해당 단원';
}

function getQuestionStatus(qa: QA): QuestionStatus | null {
  if (!qa.ans || qa.ans.is_blank || !qa.ans.selected_answer) return 'blank';
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

function fallbackQuestionComment(qa: QA, status: QuestionStatus): string {
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

function generateComment(qaRows: QA[], totalScore: number, totalPossible: number): string {
  const parts: string[] = [];
  const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const answered = qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length;
  const guessedCount = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessRate = answered > 0 ? (guessedCount / answered) * 100 : 0;

  if (scoreRate >= 90) parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  else if (scoreRate >= 70) parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  else if (scoreRate >= 50) parts.push('개념 이해와 문제 적용 훈련이 함께 필요합니다.');
  else parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');

  if (guessRate < 10) parts.push('풀이 확신도가 비교적 안정적입니다.');
  else if (guessRate < 25) parts.push('일부 문항에서 확신 부족이 나타났습니다.');
  else if (guessRate < 40) parts.push('중상 난도 문항에서 접근 불안정성이 보입니다.');
  else parts.push('문제 접근력과 시간 관리 훈련이 필요합니다.');

  if (guessedCount > 0 && guessedCorrect / guessedCount > 0.5) {
    parts.push('맞힌 문항도 풀이 과정을 점검할 필요가 있습니다.');
  }

  const trendComment = summarizeQuestionCommentTrends(qaRows);
  if (trendComment) {
    parts.push(trendComment);
  }

  const lastQ = qaRows.slice(Math.floor(qaRows.length * 0.75));
  const blankAtEnd = lastQ.filter((qa) => qa.ans?.is_blank || !qa.ans?.selected_answer).length;
  if (blankAtEnd >= 2) parts.push('시간 배분 훈련과 변별 문항 접근 전략이 필요합니다.');

  return parts.join(' ');
}

function MiniSummaryCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? 'bg-orange-500 text-white' : 'bg-stone-50'}`}
      style={{ borderColor: accent ? 'var(--accent)' : 'var(--border)' }}
    >
      <p className={`text-[11px] font-medium ${accent ? 'text-white/80' : 'text-stone-500'}`}>{label}</p>
      <p className={`mt-1 text-base font-bold leading-tight ${accent ? 'text-white' : 'text-stone-950'}`}>{value}</p>
      <p className={`mt-1 text-[11px] ${accent ? 'text-white/75' : 'text-stone-500'}`}>{sub}</p>
    </div>
  );
}

function StatBarList({ stats, emptyText }: { stats: GroupStat[]; emptyText: string }) {
  if (stats.length === 0) return <p className="report-empty">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {stats.map((stat) => {
        const rate = statRate(stat);
        const ev = rate >= 80
          ? { text: '안정', color: '#15803d', bg: '#f0fdf4' }
          : rate >= 60
            ? { text: '보통', color: '#ca8a04', bg: '#fefce8' }
            : rate >= 40
              ? { text: '보완 필요', color: '#ea580c', bg: '#fff7ed' }
              : { text: '집중 보완', color: '#dc2626', bg: '#fef2f2' };

        return (
          <div key={stat.name} className="rounded-lg border bg-stone-50 px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-stone-950">{cleanStatName(stat.name)}</p>
                <p className="text-[11px] text-stone-500">{stat.correct}/{stat.total}문항 정답</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-bold text-stone-950">{rate.toFixed(1)}%</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: ev.bg, color: ev.color }}>
                  {ev.text}
                </span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, rate))}%`, background: ev.color }} />
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
    <div className="rounded-lg border p-3 text-center" style={{ background: tone.bg, borderColor: 'var(--border)' }}>
      <div
        className="relative mx-auto h-24 w-24 rounded-full"
        style={{ background: `conic-gradient(${tone.color} ${clamped * 3.6}deg, #e7e5df 0deg)` }}
      >
        <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-xl font-bold" style={{ color: tone.color }}>{rate.toFixed(1)}%</span>
          <span className="text-[10px] font-semibold text-stone-500">{tone.text}</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-stone-900">{correct}/{total}문항 정답</p>
    </div>
  );
}

function CauseDistribution({ causes }: { causes: CauseStat[] }) {
  const total = causes.reduce((sum, cause) => sum + cause.count, 0);
  if (total === 0) return <p className="report-empty">오답 또는 미응답 문항이 없습니다.</p>;

  return (
    <div className="rounded-lg border bg-stone-50 px-3 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="space-y-2">
        {causes.map((cause) => {
          const rate = total > 0 ? (cause.count / total) * 100 : 0;
          return (
            <div key={cause.name}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-900">{cause.name}</span>
                <span className="text-[11px] font-bold text-stone-600">{cause.count}개 · {rate.toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full" style={{ width: `${Math.max(6, rate)}%`, background: cause.color }} />
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
  if (stats.length === 0) return <p className="report-empty">{emptyText}</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => {
        const rate = statRate(stat);
        const tone = scoreTone(rate);
        return (
          <div key={stat.name} className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-stone-950">{cleanStatName(stat.name)}</p>
                <p className="mt-0.5 text-[10px] text-stone-500">
                  {variant === 'difficulty' ? '난이도 구간' : '단원'} · {stat.correct}/{stat.total}문항
                </p>
              </div>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: tone.bg, color: tone.color }}>
                {tone.text}
              </span>
            </div>
            <div className="mb-1.5 flex items-end justify-between">
              <span className="text-lg font-bold" style={{ color: tone.color }}>{rate.toFixed(1)}%</span>
              <span className="text-[10px] text-stone-500">정답률</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, rate))}%`, background: tone.color }} />
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
    <div className="rounded-lg border bg-white px-3 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold text-stone-950">내 점수 vs 전체 평균</p>
        <p className="text-[11px] text-stone-500">{cohortAverage === null ? '응시 데이터 부족' : `전체 평균 ${cohortAverage.toFixed(1)}점`}</p>
      </div>
      <div className="space-y-2">
        {[
          ['내 점수', studentScore, studentRate, 'var(--accent)'],
          ['전체 평균', cohortAverage, averageRate, '#64748b'],
        ].map(([label, value, rate, color]) => (
          <div key={String(label)}>
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-stone-600">
              <span>{label}</span>
              <span>{typeof value === 'number' ? `${value.toFixed(label === '내 점수' ? 0 : 1)}점` : '산출 전'}</span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-200">
              <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, Number(rate))}%`, background: String(color) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionTimeline({ qaRows }: { qaRows: QA[] }) {
  if (qaRows.length === 0) return <p className="report-empty">문항 정보가 없습니다.</p>;

  return (
    <div className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap gap-1.5">
        {qaRows.map((qa) => {
          const ans = qa.ans;
          const hasAnswer = ans && !ans.is_blank && ans.selected_answer;
          const bg = !hasAnswer ? '#e2e8f0' : ans.is_correct ? '#dcfce7' : '#fee2e2';
          const color = !hasAnswer ? '#64748b' : ans.is_correct ? '#15803d' : '#dc2626';
          return (
            <div key={qa.id} className="relative flex h-7 w-7 items-center justify-center rounded border text-[10px] font-bold" style={{ background: bg, color, borderColor: '#d6d3d1' }}>
              {qa.question_number}
              {ans?.is_guessed && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-orange-500" />}
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
  if (qaRows.length === 0) return <p className="report-empty">문항 정보가 없습니다.</p>;

  return (
    <div className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))' }}>
        {qaRows.map((qa) => {
          const rateInfo = questionRates.get(qa.id);
          const rate = rateInfo?.correctRate ?? null;
          const ans = qa.ans;
          const hasAnswer = ans && !ans.is_blank && ans.selected_answer;
          const statusLabel = !hasAnswer ? '미응답' : ans.is_correct ? '정답' : '오답';
          const statusColor = !hasAnswer ? '#64748b' : ans.is_correct ? '#16a34a' : '#dc2626';
          const highDifficulty = (qa.difficulty ?? 0) >= 6;
          const barHeight = rate === null ? 12 : Math.max(12, Math.round(rate * 0.75));

          return (
            <div key={qa.id} className="break-inside-avoid rounded border bg-stone-50 px-2 py-2" style={{ borderColor: highDifficulty ? '#fb923c' : 'var(--border)' }}>
              <div className="mb-1 flex items-start justify-between gap-1">
                <div>
                  <p className="text-[11px] font-bold text-stone-950">{qa.question_number}번</p>
                  <p className="text-[9px] text-stone-500">난도 {qa.difficulty ?? '–'}</p>
                </div>
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ background: `${statusColor}18`, color: statusColor }}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex h-16 items-end justify-center rounded bg-white px-1 pb-1">
                <div className="relative w-full rounded-t" style={{ height: `${barHeight}%`, background: rate === null ? '#cbd5e1' : highDifficulty ? '#f97316' : '#2563eb' }}>
                  {ans?.is_guessed && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-white bg-orange-500" />}
                </div>
              </div>
              <p className="mt-1 text-center text-[10px] font-bold text-stone-900">{rate === null ? '산출 전' : `${rate.toFixed(0)}%`}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentPrintPage({
  params,
}: {
  params: Promise<{ studentId: string; testId: string }>;
}) {
  const { studentId: sid, testId: tid } = use(params);
  const studentId = Number(sid);
  const testId = Number(tid);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [classId, setClassId] = useState(0);
  const [meta, setMeta] = useState<{ label: string; value: string }[]>([]);
  const [qaRows, setQaRows] = useState<QA[]>([]);
  const [cohortAnswers, setCohortAnswers] = useState<CohortAnswerRow[]>([]);

  useEffect(() => {
    if (isNaN(studentId) || isNaN(testId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
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

      setStudentName(studentData.student_name);
      setStudentCode(studentData.student_code);
      setClassId(studentData.class_id);

      const { data: classData } = await supabase
        .from('classes')
        .select('id, class_name, teacher_name, academy_name')
        .eq('id', studentData.class_id)
        .single();

      const assigned = await fetchTestsForClass(studentData.class_id);
      if (!assigned.some((t) => t.id === testId)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: testRaw } = await supabase
        .from('tests')
        .select('id, title, grade, exam_range_text, subjects(name)')
        .eq('id', testId)
        .single();

      if (!testRaw) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const subjectName = pickUnitName(testRaw.subjects);
      setMeta([
        { label: '학생명', value: studentData.student_name },
        { label: '학생 코드', value: studentData.student_code || '–' },
        { label: '테스트명', value: testRaw.title },
        { label: '학년', value: testRaw.grade || '–' },
        { label: '과목', value: subjectName || '–' },
        { label: '테스트 범위', value: testRaw.exam_range_text?.trim() || '범위 미입력' },
        { label: '강사명', value: classData?.teacher_name || '–' },
        { label: '학원명', value: classData?.academy_name || '–' },
        { label: '반명', value: classData?.class_name || '–' },
      ]);

      const { data: questionsRaw } = await supabase
        .from('questions')
        .select(`
          id, question_number, question_format, answer, score, difficulty, question_comment,
          subjects:subject_id(order_index),
          units_major:major_unit_id(name, order_index),
          units_middle:middle_unit_id(name, order_index),
          units_small:small_unit_id(name, order_index)
        `)
        .eq('test_id', testId)
        .order('question_number');

      function pickOrder(raw: unknown): number {
        const u = raw as ({ order_index?: number | null } | { order_index?: number | null }[] | null);
        const value = Array.isArray(u) ? u[0]?.order_index : u?.order_index;
        return typeof value === 'number' ? value : 9999;
      }

      const questions: Omit<QA, 'ans'>[] = (questionsRaw ?? []).map((q) => ({
        id: q.id,
        question_number: q.question_number,
        question_format: q.question_format === 'subjective' ? 'subjective' : 'objective',
        answer: q.answer,
        score: Number(q.score),
        difficulty: q.difficulty,
        question_comment: q.question_comment ?? null,
        major_unit_name: pickUnitName(q.units_major),
        middle_unit_name: pickUnitName(q.units_middle),
        small_unit_name: pickUnitName(q.units_small),
        subject_order: pickOrder(q.subjects),
        major_order: pickOrder(q.units_major),
        middle_order: pickOrder(q.units_middle),
        small_order: pickOrder(q.units_small),
      }));

      if (!questions.length) {
        setQaRows([]);
        setLoading(false);
        return;
      }

      const { data: answersRaw } = await supabase
        .from('student_answers')
        .select('question_id, selected_answer, is_guessed, is_blank, is_correct, earned_score')
        .eq('student_id', studentId)
        .in('question_id', questions.map((q) => q.id));

      const { data: cohortRaw } = await supabase
        .from('student_answers')
        .select('student_id, question_id, is_correct, earned_score')
        .in('question_id', questions.map((q) => q.id));

      const answerMap = new Map(
        (answersRaw ?? []).map((a) => [
          a.question_id,
          {
            selected_answer: a.selected_answer,
            is_guessed: a.is_guessed,
            is_blank: a.is_blank,
            is_correct: a.is_correct,
            earned_score: Number(a.earned_score),
          },
        ])
      );

      setQaRows(questions.map((q) => ({ ...q, ans: answerMap.get(q.id) ?? null })));
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

  const totalPossible = qaRows.reduce((s, qa) => s + qa.score, 0);
  const totalScore = qaRows.reduce((s, qa) => s + (qa.ans?.earned_score ?? 0), 0);
  const correctCount = qaRows.filter((qa) => qa.ans?.is_correct).length;
  const wrongCount = qaRows.filter(
    (qa) => qa.ans && !qa.ans.is_correct && !qa.ans.is_blank && qa.ans.selected_answer
  ).length;
  const blankCount = qaRows.filter((qa) => !qa.ans || qa.ans.is_blank || !qa.ans.selected_answer).length;
  const guessedCount = qaRows.filter((qa) => qa.ans?.is_guessed).length;
  const guessedCorrect = qaRows.filter((qa) => qa.ans?.is_guessed && qa.ans?.is_correct).length;
  const guessedWrong = qaRows.filter((qa) => qa.ans?.is_guessed && !qa.ans?.is_correct).length;
  const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const guessRate =
    qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length > 0
      ? (guessedCount /
          qaRows.filter((qa) => qa.ans && !qa.ans.is_blank && qa.ans.selected_answer).length) *
        100
      : 0;
  const difficultyValues = qaRows.map((qa) => qa.difficulty).filter((d): d is number => typeof d === 'number');
  const averageDifficulty = difficultyValues.length > 0
    ? difficultyValues.reduce((sum, d) => sum + d, 0) / difficultyValues.length
    : null;
  const headerMeta = [
    ...meta,
    {
      label: '테스트 난이도',
      value: averageDifficulty === null
        ? '난이도 미설정'
        : `평균 난이도 ${averageDifficulty.toFixed(1)} / 8 · ${difficultySummary(averageDifficulty)}`,
    },
  ];

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

  const curriculumRows = [...qaRows].sort(curriculumCompare);
  const majorStats = groupStats(curriculumRows, (qa) => qa.major_unit_name || '미분류');
  const middleStats = groupStats(curriculumRows, (qa) =>
    qa.middle_unit_name ? `${qa.major_unit_name ?? ''} > ${qa.middle_unit_name}` : '미분류'
  );
  const diffStats = [...groupStats(qaRows, (qa) => difficultyGroup(qa.difficulty))].sort(
    (a, b) => DIFF_ORDER.indexOf(a.name) - DIFF_ORDER.indexOf(b.name)
  );
  const weakestUnit = weakestStat(majorStats);
  const weakestDiff = weakestStat(diffStats);
  const coreDiagnoses = buildCoreDiagnoses(scoreRate, weakestUnit, weakestDiff, guessRate);
  const prescriptions = buildPrescriptions(weakestUnit, weakestDiff, wrongCount, blankCount, guessedCount);
  const causeStats = buildCauseStats(qaRows);

  const comment = qaRows.length > 0 ? generateComment(qaRows, totalScore, totalPossible) : '';
  const questionCommentPoints = curriculumRows.filter((qa) => getQuestionStatus(qa));
  const today = formatReportDate();
  const backHref = `/students/${studentId}/tests/${testId}/report`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--fg-muted)' }} />
        <p className="font-semibold mb-4">학생 리포트를 찾을 수 없습니다.</p>
        <Link href="/tests"><Button variant="outline" size="sm">테스트 목록</Button></Link>
      </div>
    );
  }

  return (
    <>
      <PrintToolbar backHref={backHref} backLabel="학생별 분석으로" title="학생별 인쇄용 리포트" />
      <ReportPage>
        <ReportHeader
          title="학생별 학습 진단 리포트"
          subtitle={meta.find((m) => m.label === '테스트명')?.value}
          highlight={studentName}
          highlightSub={studentCode ?? undefined}
          meta={headerMeta}
          generatedAt={today}
        />
        <div className="report-page-body">
          <ReportSection title="종합 결과">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <AccuracyGauge rate={scoreRate} correct={correctCount} total={qaRows.length} />
              <div className="grid grid-cols-2 gap-2">
                <MiniSummaryCard label="총점" value={`${totalScore} / ${totalPossible}점`} sub="획득 점수" accent />
                <MiniSummaryCard label="전체 응시자 평균점수" value={cohortAverage === null ? '산출 전' : `${cohortAverage.toFixed(1)}점`} sub={cohortAverage === null ? '응시 데이터 부족' : `완료 ${completedStudentScores.length}명 기준`} />
                <MiniSummaryCard label="취약 단원" value={weakestUnit ? cleanStatName(weakestUnit.name) : '–'} sub={correctRateText(weakestUnit)} />
                <MiniSummaryCard label="보완 난이도" value={weakestDiff ? cleanStatName(weakestDiff.name) : '–'} sub={correctRateText(weakestDiff)} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {[
                ['정답 수', `${correctCount}개`],
                ['오답 수', `${wrongCount}개`],
                ['미응답 수', `${blankCount}개`],
                ['찍음 수', `${guessedCount}개`],
                ['찍어서 맞음', `${guessedCorrect}개`],
                ['찍어서 틀림', `${guessedWrong}개`],
              ].map(([label, value]) => (
                <div key={label} className="rounded border bg-stone-50 px-2 py-1.5" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[10px] text-stone-500">{label}</p>
                  <p className="text-xs font-bold text-stone-950">{value}</p>
                </div>
              ))}
            </div>
          </ReportSection>

          <ReportSection title="점수 비교">
            <ScoreCompareBar studentScore={totalScore} totalPossible={totalPossible} cohortAverage={cohortAverage} />
          </ReportSection>

          <ReportSection title="단원별 성취도">
            {majorStats.length === 0 ? (
              <p className="report-empty">단원 정보가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                <AchievementCards stats={majorStats} emptyText="단원 정보가 없습니다." />
                {middleStats.length > 0 && <StatBarList stats={middleStats} emptyText="중단원 정보가 없습니다." />}
              </div>
            )}
          </ReportSection>

          <ReportSection title="난이도별 성취도">
            {diffStats.length === 0 ? (
              <p className="report-empty">난이도 정보가 없습니다.</p>
            ) : (
              <AchievementCards stats={diffStats} emptyText="난이도 정보가 없습니다." variant="difficulty" />
            )}
          </ReportSection>

          <ReportSection title="문항별 O/X 타임라인">
            <QuestionTimeline qaRows={qaRows} />
          </ReportSection>

          <ReportSection title="문항별 분석 그래프" pageBreakBefore={qaRows.length > 10}>
            <QuestionAnalysisGraph qaRows={qaRows} questionRates={questionRates} />
          </ReportSection>

          <ReportSection title="문항별 결과">
            {qaRows.length === 0 ? (
              <p className="report-empty">문항이 없습니다.</p>
            ) : (
              <ReportTable
                headers={['번호', '형식', '정답', '학생 답', '결과', '점수', '배점', '찍음', '미응답', '대단원', '중단원', '소단원', '난이도', '학습 포인트']}
                compact
              >
                {qaRows.map((qa, i) => {
                  const ans = qa.ans;
                  const hasAnswer = ans && !ans.is_blank && ans.selected_answer;
                  const result = !ans || (!ans.is_blank && !ans.selected_answer)
                    ? '–'
                    : ans.is_blank
                      ? '미응답'
                      : ans.is_correct
                        ? '정답'
                        : '오답';
                  return (
                    <ReportTr key={qa.id} stripedIndex={i}>
                      <ReportTd align="center">{qa.question_number}</ReportTd>
                      <ReportTd align="center">{questionFormatLabel(qa.question_format)}</ReportTd>
                      <ReportTd align="center">{qa.answer ?? '–'}</ReportTd>
                      <ReportTd align="center">
                        {ans?.is_blank ? '미응답' : ans?.selected_answer ?? '–'}
                      </ReportTd>
                      <ReportTd align="center" className={ans?.is_correct ? 'text-green-700 font-semibold' : ans && hasAnswer ? 'text-red-600 font-semibold' : ''}>
                        {result}
                      </ReportTd>
                      <ReportTd align="center">{ans ? `${ans.earned_score}` : '–'}</ReportTd>
                      <ReportTd align="center">{qa.score}</ReportTd>
                      <ReportTd align="center">{ans?.is_guessed ? 'O' : '–'}</ReportTd>
                      <ReportTd align="center">{ans?.is_blank ? 'O' : '–'}</ReportTd>
                      <ReportTd align="center">{qa.major_unit_name ?? '–'}</ReportTd>
                      <ReportTd align="center">{qa.middle_unit_name ?? '–'}</ReportTd>
                      <ReportTd align="center">{qa.small_unit_name ?? '–'}</ReportTd>
                      <ReportTd align="center">{qa.difficulty ?? '–'}</ReportTd>
                      <ReportTd>{qa.question_comment ?? '–'}</ReportTd>
                    </ReportTr>
                  );
                })}
              </ReportTable>
            )}
          </ReportSection>

          {questionCommentPoints.length > 0 && (
            <ReportSection title="오답 문항 해설 포인트">
              <ul className="space-y-2">
                {questionCommentPoints.map((qa) => (
                  <li key={qa.id} className="text-sm leading-relaxed">
                    <span className="font-semibold">{qa.question_number}번:</span>{' '}
                    {questionLearningComment(qa, getQuestionStatus(qa) ?? 'wrong')}
                  </li>
                ))}
              </ul>
            </ReportSection>
          )}

          <ReportSection title="오답 원인 분포">
            <CauseDistribution causes={causeStats} />
          </ReportSection>

          <ReportSection title="핵심 진단" className="report-interpretation-block">
            <ul className="space-y-1.5 rounded-lg border bg-stone-50 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              {coreDiagnoses.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-stone-900">• {line}</li>
              ))}
            </ul>
          </ReportSection>

          {comment && (
            <ReportSection title="종합 학습 코멘트" className="report-interpretation-block">
              <ReportComment>{comment}</ReportComment>
            </ReportSection>
          )}

          <ReportSection title="추천 학습 처방" className="report-interpretation-block">
            <ul className="space-y-1.5 rounded-lg border bg-slate-50 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              {prescriptions.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-stone-900">• {line}</li>
              ))}
            </ul>
          </ReportSection>
        </div>
      </ReportPage>
    </>
  );
}

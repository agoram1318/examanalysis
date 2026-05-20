/**
 * 테스트 전체 분석 — 백분위, 추정 등급, 점수 분포 등
 */

export type ScoreBand = {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
};

const SCORE_BAND_DEFS: { label: string; min: number; max: number }[] = [
  { label: '90점 이상', min: 90, max: Infinity },
  { label: '80점 이상 90점 미만', min: 80, max: 90 },
  { label: '70점 이상 80점 미만', min: 70, max: 80 },
  { label: '60점 이상 70점 미만', min: 60, max: 70 },
  { label: '50점 이상 60점 미만', min: 50, max: 60 },
  { label: '50점 미만', min: -Infinity, max: 50 },
];

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 전체 응시자 중 해당 점수보다 낮은 점수의 비율 (0~100) */
export function computePercentile(scores: number[], targetScore: number): number {
  if (scores.length === 0) return 0;
  const below = scores.filter((s) => s < targetScore).length;
  return (below / scores.length) * 100;
}

/**
 * 봉샘스쿨 내부 데이터 기준 추정 등급 (백분위 = 낮은 점수 비율 기준)
 * 상위 4% → 96% 이상이 나보다 낮음 → percentile >= 96
 */
export function computeEstimatedGrade(percentile: number): number {
  if (percentile >= 96) return 1;
  if (percentile >= 89) return 2;
  if (percentile >= 77) return 3;
  if (percentile >= 60) return 4;
  if (percentile >= 40) return 5;
  if (percentile >= 23) return 6;
  if (percentile >= 11) return 7;
  if (percentile >= 4) return 8;
  return 9;
}

export function buildScoreDistribution(scores: number[]): ScoreBand[] {
  const total = scores.length;
  return SCORE_BAND_DEFS.map(({ label, min, max }) => {
    const count = scores.filter((s) => {
      if (max === Infinity) return s >= min;
      if (min === -Infinity) return s < max;
      return s >= min && s < max;
    }).length;
    return {
      label,
      min,
      max,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

export function evalAchievement(rate: number): { text: string; color: string; bg: string } {
  if (rate >= 80) return { text: '안정', color: '#15803d', bg: '#f0fdf4' };
  if (rate >= 60) return { text: '보통', color: '#ca8a04', bg: '#fefce8' };
  if (rate >= 40) return { text: '보완 필요', color: '#ea580c', bg: '#fff7ed' };
  return { text: '집중 보완', color: '#dc2626', bg: '#fef2f2' };
}

export function difficultyInterpretation(d: number | null): string {
  if (d === null) return '미설정';
  if (d <= 2) return '기본 확인';
  if (d <= 4) return '기본 적용';
  if (d <= 6) return '중상 난도';
  return '고난도/킬러';
}

export interface TestWideCommentInput {
  avgRate: number;
  avgGuessRate: number;
  highDiffRate: number | null;
  lowUnitNames: string[];
  highGuessQuestionCount: number;
}

export function generateTestWideComment(input: TestWideCommentInput): string {
  const parts: string[] = [];

  if (input.avgRate >= 80) {
    parts.push('전체적으로 안정적인 성취도를 보였습니다.');
  } else if (input.avgRate >= 60) {
    parts.push('기본기는 갖추었으나 일부 단원 보완이 필요합니다.');
  } else if (input.avgRate >= 40) {
    parts.push('개념 이해와 유형 적용 훈련이 함께 필요합니다.');
  } else {
    parts.push('기본 개념 재정리와 쉬운 문항부터의 반복 훈련이 필요합니다.');
  }

  if (input.highDiffRate !== null && input.highDiffRate < 40) {
    parts.push('중상 난도 변별 문항 접근 전략이 필요합니다.');
  }

  if (input.avgGuessRate >= 20 || input.highGuessQuestionCount >= 3) {
    parts.push('풀이 확신도와 시간 관리 점검이 필요합니다.');
  }

  if (input.lowUnitNames.length > 0) {
    const names = input.lowUnitNames.slice(0, 2).join(', ');
    parts.push(`${names} 단원의 집중 보완이 필요합니다.`);
  }

  if (parts.length < 3) {
    parts.push('반별·학생별 리포트를 함께 확인하며 맞춤 보완 계획을 세우시기 바랍니다.');
  }

  return parts.slice(0, 5).join(' ');
}

export function wrongInterpretation(correctRate: number, difficulty: number | null): string {
  if (correctRate < 25) return '전체 응시자 기준 변별력이 크게 나타난 문항입니다.';
  if ((difficulty ?? 0) >= 6 && correctRate < 50) {
    return '난이도 대비 정답률이 낮아 체감 난도가 높았을 가능성이 있습니다.';
  }
  return '해당 단원의 개념 재점검이 필요합니다.';
}

export function guessInterpretation(guessRate: number, difficulty: number | null): string {
  if (guessRate >= 50) return '풀이 방향을 잡기 어려워한 학생이 많았던 문항입니다.';
  if (guessRate >= 35) return '시간 부족 또는 접근 불안정성이 크게 나타난 문항입니다.';
  if ((difficulty ?? 0) >= 6) return '점수보다 실제 체감 난도가 높았을 가능성이 있습니다.';
  return '풀이 확신도가 낮았던 문항으로 추가 설명이 필요할 수 있습니다.';
}

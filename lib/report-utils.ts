/** 리포트·인쇄 화면 공통 유틸 */

export type UnitRaw = { name: string } | { name: string }[] | null;

export function pickUnitName(raw: unknown): string | null {
  const u = raw as UnitRaw;
  if (!u) return null;
  if (Array.isArray(u)) return u[0]?.name ?? null;
  return u.name ?? null;
}

export function getSubjectDisplayName(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  if (name === '공수1') return '공통수학1';
  if (name === '공수2') return '공통수학2';
  if (name === '확통') return '확률과 통계';
  return name;
}

export function getQuestionSubjectName(raw: unknown): string | null {
  return getSubjectDisplayName(pickUnitName(raw));
}

export function formatSubjectList(names: Array<string | null | undefined>, fallback = '문항 입력 전'): string {
  const unique = names
    .map((name) => getSubjectDisplayName(name)?.trim())
    .filter((name): name is string => !!name);
  const deduped = [...new Set(unique)];
  return deduped.length > 0 ? deduped.join(', ') : fallback;
}

export function scoreOrFallback(score: unknown, questionCount: number): number {
  const value = Number(score);
  if (Number.isFinite(value) && value > 0) return value;
  return questionCount > 0 ? 100 / questionCount : 0;
}

export function formatScoreValue(score: number | null | undefined): string {
  const value = Number(score ?? 0);
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function evalAchievement(rate: number): { text: string; color: string; bg: string } {
  if (rate >= 80) return { text: '안정', color: '#15803d', bg: '#f0fdf4' };
  if (rate >= 60) return { text: '보통', color: '#ca8a04', bg: '#fefce8' };
  if (rate >= 40) return { text: '보완 필요', color: '#ea580c', bg: '#fff7ed' };
  return { text: '집중 보완', color: '#dc2626', bg: '#fef2f2' };
}

export function difficultyGroup(d: number | null): string {
  if (d === null) return '미설정';
  if (d <= 2) return '난이도 하 (1~2)';
  if (d <= 4) return '난이도 중 (3~4)';
  if (d <= 6) return '난이도 상 (5~6)';
  return '난이도 최상 (7~8)';
}

export function difficultyLabel(d: number | null): string {
  if (d === null) return '–';
  if (d <= 2) return `${d} (하)`;
  if (d <= 4) return `${d} (중)`;
  if (d <= 6) return `${d} (상)`;
  return `${d} (최상)`;
}

export function difficultyInterpretation(d: number | null): string {
  if (d === null) return '미설정';
  if (d <= 2) return '난이도 하';
  if (d <= 4) return '난이도 중';
  if (d <= 6) return '난이도 상';
  return '난이도 최상';
}

export const DIFF_ORDER = [
  '난이도 하 (1~2)',
  '난이도 중 (3~4)',
  '난이도 상 (5~6)',
  '난이도 최상 (7~8)',
  '미설정',
];

export type GroupStat = { name: string; total: number; correct: number };

export function formatReportDate(d = new Date()): string {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

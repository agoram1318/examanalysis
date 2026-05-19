import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatScore(score: number, total: number): string {
  return `${score}점 / ${total}점`;
}

export function formatPercentage(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function getDifficultyLabel(d: string): string {
  switch (d) {
    case 'easy': return '하';
    case 'medium': return '중';
    case 'hard': return '상';
    default: return d;
  }
}

export function getQuestionTypeLabel(t: string): string {
  switch (t) {
    case 'multiple': return '객관식';
    case 'short': return '단답형';
    case 'essay': return '서술형';
    default: return t;
  }
}

export function getLevelLabel(level: string): string {
  switch (level) {
    case 'major': return '대단원';
    case 'middle': return '중단원';
    case 'minor': return '소단원';
    default: return level;
  }
}

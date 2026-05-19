'use client';

import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/dashboard': '대시보드',
  '/tests': '테스트 관리',
  '/answers': '답안 입력',
  '/analysis/student': '학생별 분석표',
  '/analysis/class': '반 전체 분석표',
  '/students': '학생 관리',
  '/classes': '반 관리',
  '/curriculum': '단원 관리',
};

function getTitle(pathname: string): string {
  for (const [key, val] of Object.entries(titles)) {
    if (pathname.startsWith(key)) return val;
  }
  return '봉샘스쿨 분석 시스템';
}

export default function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">관리자</span>
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
          관
        </div>
      </div>
    </header>
  );
}

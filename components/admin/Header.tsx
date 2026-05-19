'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';

const PAGE_TITLES: [string, string][] = [
  ['/admin',               '대시보드'],
  ['/tests/new',           '새 테스트 등록'],
  ['/tests',               '테스트 관리'],
  ['/units',               '단원 관리'],
  ['/classes',             '반 관리'],
  ['/students',            '학생 관리'],
  ['/answers',             '답안 입력'],
  ['/analysis/student',    '학생별 분석표'],
  ['/analysis/class',      '반 전체 분석표'],
  ['/curriculum',          '커리큘럼 관리'],
];

function getTitle(pathname: string): string {
  // 동적 세그먼트 매핑 (더 구체적인 것 먼저)
  if (/\/tests\/\d+\/classes\/new/.test(pathname)) return '반 생성';
  if (/\/tests\/\d+\/classes/.test(pathname)) return '반 목록';
  if (/\/tests\/\d+\/questions/.test(pathname)) return '문항 정보 입력';
  if (/\/classes\/\d+\/students/.test(pathname)) return '학생 등록';
  if (/\/classes\/\d+\/answers/.test(pathname)) return '답안 입력';
  if (/\/classes\/\d+\/analysis/.test(pathname)) return '반 전체 분석표';
  if (/\/students\/\d+\/report/.test(pathname)) return '학생별 분석표';

  for (const [key, val] of PAGE_TITLES) {
    if (pathname === key || pathname.startsWith(key + '/')) return val;
  }
  return '봉샘스쿨 분석 시스템';
}

export default function AdminHeader() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header
      data-admin-header
      className="flex items-center justify-between px-7 py-4 border-b bg-white"
      style={{ borderColor: 'var(--border)', minHeight: 60 }}
    >
      <h1 className="text-base font-semibold" style={{ color: 'var(--fg-main)' }}>
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
          style={{ color: 'var(--fg-muted)' }}
        >
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'var(--accent)' }}
          >
            관
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--fg-sub)' }}>
            관리자
          </span>
        </div>
      </div>
    </header>
  );
}

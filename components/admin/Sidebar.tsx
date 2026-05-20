'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  BookMarked,
  BookOpen,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  desc?: string;
};

const NAV: NavItem[] = [
  { label: '대시보드',   href: '/admin',   icon: LayoutDashboard, desc: '전체 현황' },
  { label: '테스트 관리', href: '/tests',  icon: ClipboardList, desc: '등록·문항 입력' },
  { label: '반 관리',    href: '/classes', icon: GraduationCap,  desc: '학생·답안·분석' },
  { label: '단원 관리',  href: '/units',   icon: BookMarked,     desc: '과목·단원 설정' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    if (href === '/classes') {
      return pathname === '/classes' || /^\/classes\/\d+/.test(pathname);
    }
    if (href === '/tests') {
      return pathname.startsWith('/tests') && !/^\/classes/.test(pathname);
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-40"
      style={{ width: 240, background: 'var(--sidebar-bg)' }}
    >
      {/* 로고 */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)' }}>
          <BookOpen size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-none truncate">봉샘스쿨</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            분석표 생성기
          </p>
        </div>
      </div>

      {/* 네비 */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
              style={active ? { background: 'rgba(249,115,22,0.20)' } : {}}
            >
              <item.icon size={16} className={`mt-0.5 shrink-0 ${active ? 'text-orange-400' : ''}`} />
              <div className="min-w-0">
                <p>{item.label}</p>
                {item.desc && (
                  <p className="text-xs mt-0.5 font-normal" style={{ color: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)' }}>
                    {item.desc}
                  </p>
                )}
              </div>
              {active && (
                <span className="ml-auto mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 워크플로 안내 */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-lg" style={{ background: 'rgba(249,115,22,0.10)' }}>
        <p className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          분석표 생성 순서
        </p>
        {['테스트 등록', '문항 입력', '반 생성', '학생 등록', '답안 입력', '분석표'].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 text-xs py-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'rgba(249,115,22,0.25)', color: 'rgba(249,115,22,0.8)' }}>
              {i + 1}
            </span>
            {s}
          </div>
        ))}
      </div>

      {/* 하단 */}
      <div className="px-5 py-4 border-t text-xs"
        style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}>
        v1.0.0 초기버전
      </div>
    </aside>
  );
}

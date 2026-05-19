'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  PenLine,
  Users,
  GraduationCap,
  BarChart3,
  BookMarked,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

type NavChild = { label: string; href: string };
type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { label: '대시보드',     href: '/admin',       icon: LayoutDashboard },
  { label: '테스트 관리',  href: '/tests',       icon: ClipboardList },
  { label: '답안 입력',    href: '/answers',     icon: PenLine },
  {
    label: '분석표',
    icon: BarChart3,
    children: [
      { label: '학생별 분석표', href: '/analysis/student' },
      { label: '반 전체 분석표', href: '/analysis/class' },
    ],
  },
  { label: '학생 관리',    href: '/students',    icon: Users },
  { label: '반 관리',      href: '/classes',     icon: GraduationCap },
  { label: '단원 관리',    href: '/units',       icon: BookMarked },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

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
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {NAV.map((item) => {
          if (item.children) {
            const groupActive = item.children.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.label}>
                <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                  ${groupActive ? 'text-white' : 'text-white/50'}`}>
                  <item.icon size={16} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {item.children.map((child) => {
                    const active = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 pl-5 pr-3 py-1.5 rounded-lg text-sm transition-colors
                          ${active
                            ? 'text-white font-medium'
                            : 'text-white/40 hover:text-white/70'}`}
                        style={active ? { background: 'rgba(249,115,22,0.18)' } : {}}
                      >
                        <ChevronRight size={12} className="shrink-0 opacity-60" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const active = isActive(item.href!);
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${active ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
              style={active ? { background: 'rgba(249,115,22,0.20)' } : {}}
            >
              <item.icon size={16} className={active ? 'text-orange-400' : ''} />
              {item.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="px-5 py-4 border-t text-xs"
        style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}>
        v1.0.0 초기버전
      </div>
    </aside>
  );
}

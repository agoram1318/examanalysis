'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  BookOpen,
  PenSquare,
  BarChart3,
  BookMarked,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: '대시보드',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: '테스트 관리',
    href: '/tests',
    icon: ClipboardList,
  },
  {
    label: '답안 입력',
    href: '/answers',
    icon: PenSquare,
  },
  {
    label: '분석표',
    icon: BarChart3,
    children: [
      { label: '학생별 분석표', href: '/analysis/student' },
      { label: '반 전체 분석표', href: '/analysis/class' },
    ],
  },
  {
    label: '학생 관리',
    href: '/students',
    icon: Users,
  },
  {
    label: '반 관리',
    href: '/classes',
    icon: GraduationCap,
  },
  {
    label: '단원 관리',
    href: '/curriculum',
    icon: BookMarked,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">봉샘스쿨</p>
            <p className="text-slate-400 text-xs">테스트 분석 시스템</p>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            const isActive = item.children.some(c => pathname.startsWith(c.href));
            return (
              <div key={item.label} className="mb-1">
                <div className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300',
                  isActive && 'text-white'
                )}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </div>
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map(child => {
                    const active = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                          active
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        <ChevronRight size={14} />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const active = item.href ? pathname.startsWith(item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">v1.0.0 초기 버전</p>
      </div>
    </aside>
  );
}

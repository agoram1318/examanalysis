import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '봉샘스쿨 테스트 분석 시스템',
  description: '수학 테스트 자동 채점 및 학생별 분석표 생성 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${geist.className} bg-slate-50`}>
        <Sidebar />
        <div className="ml-64 min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

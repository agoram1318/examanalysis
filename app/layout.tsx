import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '봉샘스쿨 테스트 분석표 생성기',
  description: '수학 테스트 답안을 바탕으로 학생별 분석표와 반 전체 분석표를 생성하는 관리자용 프로그램',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={geist.className}>
        {children}
      </body>
    </html>
  );
}

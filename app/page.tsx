import Link from 'next/link';
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* ── 네비바 ── */}
      <header className="border-b px-8 py-4 flex items-center justify-between bg-white"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="font-bold text-base" style={{ color: 'var(--fg-main)' }}>
            봉샘스쿨
          </span>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          관리자 대시보드 <ArrowRight size={15} />
        </Link>
      </header>

      {/* ── 히어로 ── */}
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-2xl w-full text-center">

          {/* 뱃지 */}
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'var(--accent-lt)', color: 'var(--accent)' }}>
            수학 전문 학습 분석 시스템
          </span>

          {/* 제목 */}
          <h1 className="text-4xl font-black tracking-tight leading-tight mb-4"
            style={{ color: 'var(--fg-main)' }}>
            봉샘스쿨<br />
            <span style={{ color: 'var(--accent)' }}>테스트 분석표</span> 생성기
          </h1>

          {/* 설명 */}
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--fg-sub)' }}>
            수학 테스트 답안을 바탕으로<br />
            <strong style={{ color: 'var(--fg-main)' }}>학생별 분석표</strong>와{' '}
            <strong style={{ color: 'var(--fg-main)' }}>반 전체 분석표</strong>를 자동으로 생성하는
            강사용 프로그램입니다.
          </p>

          {/* CTA 버튼 */}
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            관리자 대시보드 시작하기 <ArrowRight size={18} />
          </Link>
        </div>
      </main>

      {/* ── 기능 소개 ── */}
      <section className="px-8 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
          {[
            {
              icon: ClipboardCheck,
              title: '자동 채점',
              desc: '문항별 정답·배점을 등록하면 학생 답안 입력 즉시 자동으로 채점됩니다.',
            },
            {
              icon: Users,
              title: '학생별 분석표',
              desc: '단원·유형·난이도별 성취도와 취약 단원을 A4 리포트로 자동 생성합니다.',
            },
            {
              icon: BarChart3,
              title: '반 전체 분석',
              desc: '문항별 정답률, 찍음 비율, 오답 TOP5 등 반 전체 성적 현황을 한눈에 파악합니다.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl p-5 border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: 'var(--accent-lt)' }}>
                <item.icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="font-semibold text-sm mb-1.5" style={{ color: 'var(--fg-main)' }}>
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-sub)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t px-8 py-4 text-center text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
        © 2026 봉샘스쿨 · 내부 관리자용 시스템 · v1.0.0
      </footer>
    </div>
  );
}

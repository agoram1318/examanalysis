'use client';

import Link from 'next/link';
import { ArrowLeft, Printer, Info } from 'lucide-react';
import Button from '@/components/ui/Button';

type PrintToolbarProps = {
  backHref: string;
  backLabel?: string;
  title?: string;
};

export default function PrintToolbar({
  backHref,
  backLabel = '분석 화면으로',
  title = '인쇄용 리포트',
}: PrintToolbarProps) {
  return (
    <div className="report-toolbar no-print">
      {/* 버튼 행 */}
      <div className="report-toolbar-inner">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} /> {backLabel}
            </Button>
          </Link>
          <span className="text-sm font-medium" style={{ color: 'var(--fg-sub)' }}>
            {title}
          </span>
        </div>
        <Button variant="accent" size="sm" onClick={() => window.print()}>
          <Printer size={14} /> 인쇄 / PDF 저장
        </Button>
      </div>

      {/* PDF 저장 안내 박스 */}
      <div
        className="mt-2 rounded-lg border px-4 py-3 flex gap-3"
        style={{ background: '#fffbeb', borderColor: '#fde68a' }}
      >
        <Info size={15} className="shrink-0 mt-0.5" style={{ color: '#b45309' }} />
        <div className="text-xs space-y-1" style={{ color: '#78350f' }}>
          <p className="font-semibold">PDF 저장 안내</p>
          <ul className="space-y-0.5 pl-1">
            <li>인쇄 대화상자에서 프린터를 <strong>PDF로 저장</strong>으로 선택하세요.</li>
            <li>배경 그래픽을 <strong>켜면</strong> 색상이 더 잘 출력됩니다.</li>
            <li>
              날짜·URL·페이지 번호를 없애려면 인쇄 설정에서{' '}
              <strong style={{ color: '#92400e' }}>&#39;머리글과 바닥글&#39;</strong>을{' '}
              <strong style={{ color: '#92400e' }}>해제</strong>하세요.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

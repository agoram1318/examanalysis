'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
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
      <p className="report-toolbar-hint">
        인쇄 대화상자에서 프린터를 <strong>PDF로 저장</strong>으로 선택하세요. 배경 그래픽을 켜면 색상이 더 잘 출력됩니다.
        PDF 저장 시 인쇄 설정에서 <strong>&#39;머리글과 바닥글&#39;</strong>을 해제하면 날짜, URL, 페이지 번호가 제거됩니다.
      </p>
    </div>
  );
}

import React from 'react';

type ReportPageProps = {
  children: React.ReactNode;
};

/** A4 세로 기준 인쇄용 페이지 래퍼 */
export default function ReportPage({ children }: ReportPageProps) {
  return (
    <div className="report-print-root">
      <div className="report-page">{children}</div>
    </div>
  );
}

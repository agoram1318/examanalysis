import React from 'react';

type ReportSectionProps = {
  title: string;
  children: React.ReactNode;
  pageBreakBefore?: boolean;
  className?: string;
};

export default function ReportSection({
  title,
  children,
  pageBreakBefore = false,
  className = '',
}: ReportSectionProps) {
  return (
    <section
      className={`report-section ${pageBreakBefore ? 'page-break-before' : ''} ${className}`.trim()}
    >
      <h2 className="report-section-title">{title}</h2>
      <div className="report-section-body">{children}</div>
    </section>
  );
}

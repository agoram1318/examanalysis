import React from 'react';

export type ReportMetaItem = { label: string; value: string };

type ReportHeaderProps = {
  brand?: string;
  title: string;
  subtitle?: string;
  highlight?: string;
  highlightSub?: string;
  meta?: ReportMetaItem[];
  generatedAt?: string;
};

export default function ReportHeader({
  brand = '봉샘스쿨',
  title,
  subtitle,
  highlight,
  highlightSub,
  meta = [],
  generatedAt,
}: ReportHeaderProps) {
  return (
    <header className="report-header">
      <div className="report-header-top">
        <div>
          <p className="report-header-brand">{brand}</p>
          <h1 className="report-header-title">{title}</h1>
          {subtitle && <p className="report-header-subtitle">{subtitle}</p>}
        </div>
        {highlight && (
          <div className="report-header-highlight">
            <p className="report-header-highlight-main">{highlight}</p>
            {highlightSub && <p className="report-header-highlight-sub">{highlightSub}</p>}
          </div>
        )}
      </div>
      {meta.length > 0 && (
        <div className="report-header-meta">
          {meta.map((item) => (
            <div key={item.label} className="report-header-meta-item">
              <span className="report-header-meta-label">{item.label}</span>
              <span className="report-header-meta-value">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {generatedAt && <p className="report-header-date">생성일: {generatedAt}</p>}
    </header>
  );
}

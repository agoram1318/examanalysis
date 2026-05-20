import React from 'react';

export type SummaryCard = {
  label: string;
  value: string;
  accent?: boolean;
};

export default function ReportSummaryGrid({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="report-summary-grid">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`report-summary-card ${card.accent ? 'report-summary-card--accent' : ''}`}
        >
          <p className="report-summary-card-label">{card.label}</p>
          <p className="report-summary-card-value">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

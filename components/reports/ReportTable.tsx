import React from 'react';

type ReportTableProps = {
  headers: string[];
  children: React.ReactNode;
  compact?: boolean;
  minWidth?: number;
  className?: string;
};

export default function ReportTable({
  headers,
  children,
  compact = false,
  minWidth,
  className = '',
}: ReportTableProps) {
  return (
    <div className={`report-table-wrap ${className}`.trim()}>
      <table
        className={`report-table ${compact ? 'report-table--compact' : ''}`}
        style={minWidth ? { minWidth } : undefined}
      >
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ReportTr({
  children,
  stripedIndex,
  highlight,
}: {
  children: React.ReactNode;
  stripedIndex: number;
  highlight?: 'danger' | 'warning';
}) {
  const cls = [
    'report-table-row',
    stripedIndex % 2 === 1 ? 'report-table-row--alt' : '',
    highlight === 'danger' ? 'report-table-row--danger' : '',
    highlight === 'warning' ? 'report-table-row--warning' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return <tr className={cls}>{children}</tr>;
}

export function ReportTd({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  return (
    <td className={`report-table-cell report-table-cell--${align} ${className}`.trim()}>
      {children}
    </td>
  );
}

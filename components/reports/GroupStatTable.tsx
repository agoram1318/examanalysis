import React from 'react';
import { evalAchievement, type GroupStat } from '@/lib/report-utils';
import ReportTable, { ReportTd, ReportTr } from './ReportTable';

export default function GroupStatTable({
  stats,
  nameHeader = '항목',
  compact = false,
}: {
  stats: GroupStat[];
  nameHeader?: string;
  compact?: boolean;
}) {
  if (stats.length === 0) {
    return <p className="report-empty">표시할 데이터가 없습니다.</p>;
  }

  return (
    <ReportTable
      headers={[nameHeader, '문항 수', '정답 수', '정답률', '평가']}
      compact={compact}
    >
      {stats.map((s, i) => {
        const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
        const ev = evalAchievement(rate);
        return (
          <ReportTr key={s.name} stripedIndex={i}>
            <ReportTd>{s.name}</ReportTd>
            <ReportTd align="center">{s.total}</ReportTd>
            <ReportTd align="center" className="text-green-700 font-semibold">
              {s.correct}
            </ReportTd>
            <ReportTd align="center">{rate.toFixed(1)}%</ReportTd>
            <ReportTd align="center">
              <span className="report-badge" style={{ background: ev.bg, color: ev.color }}>
                {ev.text}
              </span>
            </ReportTd>
          </ReportTr>
        );
      })}
    </ReportTable>
  );
}

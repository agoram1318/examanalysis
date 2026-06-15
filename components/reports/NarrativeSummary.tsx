import type { NarrativeSummaryResult } from '@/lib/narrative-summary';

type Props = {
  result: NarrativeSummaryResult;
};

export default function NarrativeSummarySection({ result }: Props) {
  return (
    <div>
      {/* 서술형 총평 문단 */}
      <div className="space-y-3">
        {result.paragraphs.map((para, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed"
            style={{
              color: 'var(--fg-main)',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
              lineHeight: '1.75',
            }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* 우선 보완 포인트 태그 */}
      {result.priorityPoints.length > 0 && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2"
          style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}
        >
          <span
            className="text-xs font-semibold shrink-0"
            style={{ color: 'var(--fg-muted)' }}
          >
            우선 보완 포인트
          </span>
          {result.priorityPoints.map((point) => (
            <span
              key={point}
              className="rounded-full px-3 py-0.5 text-xs font-semibold"
              style={{
                background: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #fed7aa',
              }}
            >
              {point}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

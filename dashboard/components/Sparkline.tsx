'use client';

/**
 * A tiny inline price trace.
 *
 * Only rendered when a product's price has actually moved — a flat line tells
 * you nothing and just adds noise to 140 cards.
 */
export default function Sparkline({
  values,
  width = 68,
  height = 20,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return null;

  const step = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / (max - min)) * (height - 4) - 2;
  const points = values.map((v, i) => ({ x: i * step, y: y(v) }));
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Down is good on a price chart — saving money for shoppers.
  const fell = values[values.length - 1] < values[0];
  const stroke = fell ? '#10b981' : '#f43f5e';
  const fillId = `spark-grad-${fell ? 'drop' : 'rise'}-${Math.random().toString(36).slice(2, 7)}`;

  const areaD = `${d} L ${points[points.length - 1].x.toFixed(1)} ${height} L 0 ${height} Z`;

  return (
    <div className="relative inline-flex items-center" title={`Price movement: ${values.join(' → ')}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${fillId})`} />
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="2.2"
          fill={stroke}
        />
      </svg>
    </div>
  );
}

/**
 * A tiny inline price trace.
 *
 * Only rendered when a product's price has actually moved — a flat line tells
 * you nothing and just adds noise to 140 cards.
 */
export default function Sparkline({
  values,
  width = 64,
  height = 18,
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
  const y = (v: number) => height - ((v - min) / (max - min)) * (height - 2) - 1;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  // Down is good on a price chart — the reverse of a stock ticker.
  const fell = values[values.length - 1] < values[0];
  const stroke = fell ? '#059669' : '#e11d48';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * step} cy={y(values[values.length - 1])} r="1.8" fill={stroke} />
    </svg>
  );
}

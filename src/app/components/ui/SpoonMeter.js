import { SERIES_COLORS } from './palette';
const colors = { project: SERIES_COLORS[0], worked: SERIES_COLORS[1], date: SERIES_COLORS[4] };
export default function SpoonMeter({ percent, tone, label }) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return <span className="spoon-meter" title="Each spoon represents 10 percentage points" role="img" aria-label={`${label}: ${Math.round(value)}%`}>
    {Array.from({ length: 10 }, (_, index) => {
      const fill = Math.max(0, Math.min(100, (value - index * 10) * 10));
      return <span key={index} className="spoon-meter-unit" aria-hidden="true" style={{ background: `linear-gradient(to right, ${colors[tone] || '#666'} ${fill}%, #e5e5e2 ${fill}%)` }} />;
    })}
  </span>;
}

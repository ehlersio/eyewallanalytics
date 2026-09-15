// The Recharts wave inside ShotMapView's live momentum card. Loaded lazily:
// it's the only Recharts use on the eager default route, and importing
// recharts statically there put the whole charting library on every first
// page load, live game or not.
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, ReferenceLine,
} from 'recharts';

export default function MomentumWaveChart({ waveData, totalMinutes }) {
  // Recharts custom dot: only draw a marker on the most recent sample.
  function currentPositionDot(props) {
    const { cx, cy, index } = props;
    if (index !== waveData.length - 1) return null;
    return <circle key="momentum-current" cx={cx} cy={cy} r={3} style={{ fill: 'var(--team-primary, #cc2200)' }} />;
  }

  return (
    <ResponsiveContainer width="100%" height={80}>
      <ComposedChart data={waveData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="minute" type="number" domain={['dataMin', 'dataMax']} hide />
        <YAxis domain={[0, 100]} hide />
        <ReferenceLine y={50} stroke="rgba(136,135,128,0.2)" strokeWidth={0.5} />
        {totalMinutes > 20 && (
          <ReferenceLine x={20} stroke="rgba(136,135,128,0.25)" strokeWidth={0.5} strokeDasharray="3 3" />
        )}
        {totalMinutes > 40 && (
          <ReferenceLine x={40} stroke="rgba(136,135,128,0.25)" strokeWidth={0.5} strokeDasharray="3 3" />
        )}
        <Area dataKey="carArea" baseValue={50} stroke="none" fill="rgba(204,34,0,0.18)" isAnimationActive={false} />
        <Area dataKey="oppArea" baseValue={50} stroke="none" fill="rgba(136,135,128,0.12)" isAnimationActive={false} />
        <Line dataKey="v" type="linear" stroke="var(--team-primary, #cc2200)" strokeWidth={1.5}
          dot={currentPositionDot} activeDot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

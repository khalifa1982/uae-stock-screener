import { useMemo } from "react";

interface SnowflakeData {
  value: number;  // 0-6
  future: number;
  past: number;
  health: number;
  dividend: number;
}

interface SnowflakeChartProps {
  data: SnowflakeData;
  size?: number;
  color?: string;
  showLabels?: boolean;
  className?: string;
  peer?: SnowflakeData | null;
}

const LABELS = ["Value", "Future", "Past", "Health", "Dividend"];
const MAX_SCORE = 6;

export function SnowflakeChart({ data, size = 240, color = "#3b82f6", showLabels = true, className = "", peer = null }: SnowflakeChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const labelRadius = size * 0.47;

  // 5 axes, starting from top (-90deg), going clockwise
  const angles = useMemo(() => {
    return LABELS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return angle;
    });
  }, []);

  const getPoint = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  // Grid rings (at 2, 4, 6)
  const gridRings = [2, 4, 6];

  // Data polygon points
  const values = [data.value, data.future, data.past, data.health, data.dividend];
  const dataPoints = values.map((val, i) => {
    const r = (val / MAX_SCORE) * radius;
    return getPoint(angles[i], r);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Peer polygon
  let peerPath = "";
  if (peer) {
    const peerValues = [peer.value, peer.future, peer.past, peer.health, peer.dividend];
    const peerPoints = peerValues.map((val, i) => {
      const r = (val / MAX_SCORE) * radius;
      return getPoint(angles[i], r);
    });
    peerPath = peerPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {gridRings.map((ring) => {
          const r = (ring / MAX_SCORE) * radius;
          const ringPoints = angles.map((a) => getPoint(a, r));
          const ringPath = ringPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <path
              key={ring}
              d={ringPath}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}

        {/* Axis lines */}
        {angles.map((angle, i) => {
          const end = getPoint(angle, radius);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}

        {/* Peer polygon (behind) */}
        {peer && peerPath && (
          <path
            d={peerPath}
            fill="oklch(0.65 0.15 250 / 10%)"
            stroke="oklch(0.65 0.15 250 / 40%)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Data polygon */}
        <path
          d={dataPath}
          fill={`${color}20`}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={color}
            stroke="var(--background, #fff)"
            strokeWidth={1.5}
          />
        ))}

        {/* Labels */}
        {showLabels && angles.map((angle, i) => {
          const labelPoint = getPoint(angle, labelRadius);
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={11}
              fontWeight={500}
            >
              {LABELS[i]}
            </text>
          );
        })}

        {/* Score labels on data points */}
        {showLabels && dataPoints.map((p, i) => {
          const offset = getPoint(angles[i], (values[i] / MAX_SCORE) * radius + 14);
          return (
            <text
              key={`score-${i}`}
              x={offset.x}
              y={offset.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              fontSize={10}
              fontWeight={700}
            >
              {values[i]}/6
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Mini version for cards/lists
export function SnowflakeMini({ data, size = 48, color = "#3b82f6" }: { data: SnowflakeData; size?: number; color?: string }) {
  return <SnowflakeChart data={data} size={size} color={color} showLabels={false} />;
}

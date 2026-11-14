import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  createPrelaunchTelemetryPoint,
  type EngineeringMetrics,
  type FlightState,
  type TelemetryPoint,
} from '../engine/physics';

type ChartChannel = 'all' | 'power' | 'mass' | 'data';

interface TelemetryHistoryChartProps {
  metrics: EngineeringMetrics;
  flight: FlightState;
}

interface NormalizedRow extends TelemetryPoint {
  powerPct: number;
  massPct: number;
  dataPct: number;
}

function formatRate(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return kbps >= 100 ? `${Math.round(kbps)}` : `${kbps.toFixed(1).replace(/\.0$/, '')}`;
}

function formatRateFull(kbps: number): string {
  if (kbps >= 1000) {
    return `${Math.round(kbps).toLocaleString()} kbps`;
  }
  if (kbps >= 10) {
    return `${kbps.toFixed(1)} kbps`;
  }
  return `${kbps.toFixed(2)} kbps`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: NormalizedRow }>;
}

const TelemetryTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="telemetry-tooltip font-mono tabular-nums">
      <div className="telemetry-tooltip-head">
        <span>{row.phaseLabel}</span>
        <span>T+{row.month.toFixed(1)} mo</span>
      </div>
      <div className="telemetry-tooltip-rows">
        <div className="telemetry-tooltip-row">
          <span className="tt-label">
            <span className="cost-swatch" style={{ backgroundColor: '#fbbf24' }} />
            Power
          </span>
          <strong>{row.powerW.toLocaleString()} W</strong>
        </div>
        <div className="telemetry-tooltip-row">
          <span className="tt-label">
            <span className="cost-swatch" style={{ backgroundColor: '#38bdf8' }} />
            Mass
          </span>
          <strong>{row.massKg.toLocaleString()} kg</strong>
        </div>
        <div className="telemetry-tooltip-row">
          <span className="tt-label">
            <span className="cost-swatch" style={{ backgroundColor: '#34d399' }} />
            Data Rate
          </span>
          <strong>{formatRateFull(row.dataRateKbps)}</strong>
        </div>
      </div>
    </div>
  );
};

export const TelemetryHistoryChart: React.FC<TelemetryHistoryChartProps> = ({
  metrics,
  flight,
}) => {
  const [channel, setChannel] = useState<ChartChannel>('all');

  const reducedMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const rawPoints = useMemo(() => {
    if (flight.telemetryHistory && flight.telemetryHistory.length > 0) {
      return flight.telemetryHistory;
    }
    return [createPrelaunchTelemetryPoint(metrics)];
  }, [flight.telemetryHistory, metrics]);

  const { rows, maxPower, maxMass, maxData } = useMemo(() => {
    const pMax = Math.max(1, ...rawPoints.map((pt) => pt.powerW));
    const mMax = Math.max(1, ...rawPoints.map((pt) => pt.massKg));
    const dMax = Math.max(1, ...rawPoints.map((pt) => pt.dataRateKbps));

    const mapped: NormalizedRow[] = rawPoints.map((pt) => ({
      ...pt,
      powerPct: Math.round((pt.powerW / pMax) * 100),
      massPct: Math.round((pt.massKg / mMax) * 100),
      dataPct: Math.round((pt.dataRateKbps / dMax) * 100),
    }));

    return {
      rows: mapped,
      maxPower: pMax,
      maxMass: mMax,
      maxData: dMax,
    };
  }, [rawPoints]);

  const lastPoint = rows[rows.length - 1];

  return (
    <div className="telemetry-history-card">
      <div className="telemetry-history-head">
        <div className="telemetry-history-title-group">
          <h3 className="telemetry-history-title">Mission Telemetry</h3>
          <span className="telemetry-history-meta font-mono tabular-nums">
            {rows.length} phases · T+{lastPoint.month.toFixed(1)} mo
          </span>
        </div>

        <div className="telemetry-channel-tabs" role="tablist" aria-label="Telemetry Channel">
          {(
            [
              { id: 'all', label: 'All (%)' },
              { id: 'power', label: 'Power' },
              { id: 'mass', label: 'Mass' },
              { id: 'data', label: 'Data Rate' },
            ] as const
          ).map((tab) => {
            const active = channel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`telemetry-tab-btn ${active ? 'telemetry-tab-btn--active' : ''}`}
                onClick={() => setChannel(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Current / End-of-Mission Readout Strip */}
      <div className="telemetry-end-strip font-mono tabular-nums">
        <div className="telemetry-end-item">
          <span className="cost-swatch" style={{ backgroundColor: '#fbbf24' }} />
          <span className="telemetry-end-label">Power</span>
          <strong>{lastPoint.powerW} W</strong>
        </div>
        <div className="telemetry-end-item">
          <span className="cost-swatch" style={{ backgroundColor: '#38bdf8' }} />
          <span className="telemetry-end-label">Mass</span>
          <strong>{lastPoint.massKg} kg</strong>
        </div>
        <div className="telemetry-end-item">
          <span className="cost-swatch" style={{ backgroundColor: '#34d399' }} />
          <span className="telemetry-end-label">Data</span>
          <strong>{formatRateFull(lastPoint.dataRateKbps)}</strong>
        </div>
      </div>

      {/* Responsive Recharts Stage */}
      <div className="telemetry-chart-box">
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart
            data={rows}
            margin={{ top: 10, right: 12, left: -6, bottom: 2 }}
          >
            <defs>
              <linearGradient id="powerAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="massAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="dataAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="rgba(56, 189, 248, 0.14)"
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="phaseLabel"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={{ stroke: 'rgba(56, 189, 248, 0.28)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />

            {channel === 'all' && (
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
            )}

            {channel === 'power' && (
              <YAxis
                domain={[0, Math.ceil(maxPower * 1.1)]}
                tickFormatter={(v: number) => `${v}W`}
                tick={{ fill: '#fbbf24', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
            )}

            {channel === 'mass' && (
              <YAxis
                domain={[0, Math.ceil(maxMass * 1.08)]}
                tickFormatter={(v: number) => `${v}kg`}
                tick={{ fill: '#38bdf8', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={58}
              />
            )}

            {channel === 'data' && (
              <YAxis
                domain={[0, Math.ceil(maxData * 1.08)]}
                tickFormatter={(v: number) => formatRate(v)}
                tick={{ fill: '#34d399', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
            )}

            <Tooltip
              content={<TelemetryTooltip />}
              cursor={{ stroke: 'rgba(125, 211, 252, 0.4)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            {channel === 'all' && (
              <>
                <Line
                  type="monotone"
                  dataKey="powerPct"
                  name="Power"
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#fbbf24', stroke: '#070b16', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: '#fbbf24', stroke: '#fff', strokeWidth: 1.5 }}
                  isAnimationActive={!reducedMotion}
                />
                <Line
                  type="monotone"
                  dataKey="massPct"
                  name="Mass"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#38bdf8', stroke: '#070b16', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: '#38bdf8', stroke: '#fff', strokeWidth: 1.5 }}
                  isAnimationActive={!reducedMotion}
                />
                <Line
                  type="monotone"
                  dataKey="dataPct"
                  name="Data Rate"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  dot={{ r: 3.5, fill: '#34d399', stroke: '#070b16', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: '#34d399', stroke: '#fff', strokeWidth: 1.5 }}
                  isAnimationActive={!reducedMotion}
                />
              </>
            )}

            {channel === 'power' && (
              <Area
                type="monotone"
                dataKey="powerW"
                name="Power (W)"
                stroke="#fbbf24"
                strokeWidth={2.5}
                fill="url(#powerAreaGrad)"
                dot={{ r: 3.5, fill: '#fbbf24', stroke: '#070b16', strokeWidth: 1.5 }}
                activeDot={{ r: 5.5, fill: '#fbbf24', stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive={!reducedMotion}
              />
            )}

            {channel === 'mass' && (
              <Area
                type="monotone"
                dataKey="massKg"
                name="Mass (kg)"
                stroke="#38bdf8"
                strokeWidth={2.5}
                fill="url(#massAreaGrad)"
                dot={{ r: 3.5, fill: '#38bdf8', stroke: '#070b16', strokeWidth: 1.5 }}
                activeDot={{ r: 5.5, fill: '#38bdf8', stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive={!reducedMotion}
              />
            )}

            {channel === 'data' && (
              <Area
                type="monotone"
                dataKey="dataRateKbps"
                name="Data Rate (kbps)"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#dataAreaGrad)"
                dot={{ r: 3.5, fill: '#34d399', stroke: '#070b16', strokeWidth: 1.5 }}
                activeDot={{ r: 5.5, fill: '#34d399', stroke: '#fff', strokeWidth: 1.5 }}
                isAnimationActive={!reducedMotion}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

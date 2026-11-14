import React from 'react';
import type { EngineeringMetrics } from '../engine/physics';

interface TelemetryStripProps {
  metrics: EngineeringMetrics;
}

type GaugeState = 'ok' | 'warn' | 'fail';

interface GaugeInfo {
  id: string;
  label: string;
  value: string;
  pct: number;
  state: GaugeState;
}

export const TelemetryStrip: React.FC<TelemetryStripProps> = ({ metrics }) => {
  const {
    parts,
    wetMassKg,
    availablePowerW,
    averageDrawW,
    ionPowerRequiredW,
    achievedDeltaV,
    dataReturnedFraction,
    cost,
    effectiveBudgetCap,
  } = metrics;

  const massRatio = parts.rocket.capacityKg > 0 ? wetMassKg / parts.rocket.capacityKg : 1;
  const massState: GaugeState = massRatio > 1 ? 'fail' : massRatio > 0.88 ? 'warn' : 'ok';

  const reqPower = Math.max(averageDrawW, ionPowerRequiredW);
  const powerRatio = reqPower > 0 ? availablePowerW / reqPower : 1;
  const powerState: GaugeState =
    !metrics.powerPasses || !metrics.ionPowerPasses
      ? 'fail'
      : powerRatio < 1.15
        ? 'warn'
        : 'ok';

  const dvRatio = parts.mission.deltaVReq > 0 ? achievedDeltaV / parts.mission.deltaVReq : 1;
  const dvState: GaugeState =
    metrics.deltaVMargin < 0 ? 'fail' : metrics.deltaVMargin < 150 ? 'warn' : 'ok';

  const dataState: GaugeState =
    metrics.parts.instruments.length === 0
      ? 'fail'
      : dataReturnedFraction < 0.45
        ? 'fail'
        : dataReturnedFraction < 0.88
          ? 'warn'
          : 'ok';

  const costRatio = effectiveBudgetCap > 0 ? cost.total / effectiveBudgetCap : 1;
  const costState: GaugeState = costRatio > 1 ? 'fail' : costRatio > 0.9 ? 'warn' : 'ok';

  const gauges: GaugeInfo[] = [
    {
      id: 'mass',
      label: 'Mass',
      value: `${Math.round(wetMassKg)} / ${parts.rocket.capacityKg} kg`,
      pct: Math.min(100, massRatio * 100),
      state: massState,
    },
    {
      id: 'power',
      label: 'Power',
      value: `${Math.round(availablePowerW)} / ${Math.round(reqPower)} W`,
      pct: Math.min(100, powerRatio * 65),
      state: powerState,
    },
    {
      id: 'deltav',
      label: 'Delta-v',
      value: `${Math.round(achievedDeltaV)} / ${parts.mission.deltaVReq}`,
      pct: Math.min(100, dvRatio * 75),
      state: dvState,
    },
    {
      id: 'data',
      label: 'Data',
      value: `${Math.round(dataReturnedFraction * 100)}% sent`,
      pct: Math.min(100, dataReturnedFraction * 100),
      state: dataState,
    },
    {
      id: 'cost',
      label: 'Cost',
      value: `$${cost.total.toFixed(0)} / $${effectiveBudgetCap}M`,
      pct: Math.min(100, costRatio * 100),
      state: costState,
    },
  ];

  return (
    <div className="telemetry-strip" role="region" aria-label="Telemetry gauges">
      <div className="telemetry-grid">
        {gauges.map((g) => (
          <div key={g.id} className={`gauge-card gauge-card--${g.state}`}>
            <div className="gauge-top">
              <span className="gauge-label">{g.label}</span>
              <span className={`gauge-dot gauge-dot--${g.state}`} aria-hidden="true" />
            </div>
            <div className="gauge-value font-mono tabular-nums">{g.value}</div>
            <div className="gauge-bar-track" aria-hidden="true">
              <div
                className={`gauge-bar-fill gauge-bar-fill--${g.state}`}
                style={{ width: `${Math.max(6, g.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

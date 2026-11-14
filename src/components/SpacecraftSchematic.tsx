import React from 'react';
import type { EngineeringMetrics } from '../engine/physics';
import type { SpacecraftConfig } from '../data/missionData';

interface SpacecraftSchematicProps {
  config: SpacecraftConfig;
  metrics: EngineeringMetrics;
  highlightSubsystem?: string | null;
  compact?: boolean;
}

const STAR_COORDS = [
  { x: 34, y: 28, r: 1.1, o: 0.7 },
  { x: 92, y: 54, r: 0.8, o: 0.45 },
  { x: 148, y: 24, r: 1.2, o: 0.8 },
  { x: 288, y: 30, r: 0.9, o: 0.55 },
  { x: 356, y: 48, r: 1.3, o: 0.75 },
  { x: 408, y: 26, r: 0.8, o: 0.5 },
  { x: 58, y: 112, r: 0.9, o: 0.4 },
  { x: 392, y: 102, r: 1.1, o: 0.65 },
  { x: 42, y: 212, r: 1.2, o: 0.7 },
  { x: 118, y: 248, r: 0.8, o: 0.45 },
  { x: 328, y: 236, r: 1.0, o: 0.6 },
  { x: 404, y: 218, r: 1.2, o: 0.75 },
  { x: 76, y: 282, r: 0.9, o: 0.5 },
  { x: 368, y: 278, r: 0.8, o: 0.45 },
];

export const SpacecraftSchematic: React.FC<SpacecraftSchematicProps> = ({
  config,
  metrics,
  highlightSubsystem,
  compact = false,
}) => {
  const { parts, wetMassKg, achievedDeltaV, availablePowerW, monthlyDownlinkGb } = metrics;
  const { bus, power, propulsion, antenna, shielding, redundancy, instruments } = parts;

  // Bus geometry
  const busHalfW = bus.id === 'small' ? 38 : bus.id === 'medium' ? 54 : 72;
  const busHalfH = bus.id === 'small' ? 34 : bus.id === 'medium' ? 44 : 56;
  const cx = 220;
  const cy = 158;

  // Tank scale based on propellant fraction (capped visually at 6000 for nice scaling)
  const propRatio = Math.max(0.12, Math.min(1, config.propellantKg / 6000));
  const tankW = (busHalfW - 8) * (0.45 + 0.5 * propRatio);
  const tankH = 14 + propRatio * 22;

  // Solar wing span grows directly with area
  const wingLen =
    power.id === 'solar_3' ? 46 : power.id === 'solar_8' ? 84 : power.id === 'solar_18' ? 124 : 0;
  const wingH =
    power.id === 'solar_3' ? 24 : power.id === 'solar_8' ? 34 : power.id === 'solar_18' ? 46 : 0;

  // Antenna dish grows with size
  const dishHalfW = antenna.id === 'small' ? 16 : antenna.id === 'medium' ? 32 : 52;
  const dishDepth = antenna.id === 'small' ? 8 : antenna.id === 'medium' ? 15 : 22;

  const isHighlighted = (key: string) => highlightSubsystem === key;

  return (
    <div className={`schematic-frame ${compact ? 'schematic-frame--compact' : ''}`}>
      <div className="schematic-header">
        <div>
          <span className="schematic-kicker">Live Blueprint</span>
          <h3 className="schematic-title">{bus.name}</h3>
        </div>
        <div className="schematic-dims font-mono tabular-nums">
          <span>{Math.round(wetMassKg)} kg</span>
        </div>
      </div>

      <svg
        viewBox="0 0 440 310"
        className="schematic-svg"
        role="img"
        aria-label={`Spacecraft schematic: ${bus.name}, ${power.name}, ${propulsion.name}, ${antenna.name}`}
      >
        <defs>
          <radialGradient id="space-backdrop" cx="50%" cy="40%" r="72%">
            <stop offset="0%" stopColor="#0f1d38" />
            <stop offset="65%" stopColor="#060b18" />
            <stop offset="100%" stopColor="#02040a" />
          </radialGradient>
          <linearGradient id="bus-mli" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="55%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#292524" />
          </linearGradient>
          <linearGradient id="solar-silicon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.85" />
          </linearGradient>
          <pattern id="solar-cells" width="12" height="10" patternUnits="userSpaceOnUse">
            <rect width="12" height="10" fill="url(#solar-silicon)" stroke="#60a5fa" strokeWidth="0.6" strokeOpacity="0.5" />
          </pattern>
          <pattern id="shield-weave" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.45" />
          </pattern>
          <radialGradient id="ion-plume" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="chem-plume" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="440" height="310" fill="url(#space-backdrop)" />
        {STAR_COORDS.map((st, idx) => (
          <circle key={idx} cx={st.x} cy={st.y} r={st.r} fill="#e2e8f0" opacity={st.o} />
        ))}
        <path
          d="M -20 315 Q 220 264 460 315"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.22"
          strokeWidth="2"
        />

        {/* POWER SYSTEM: Solar Wings OR RTGs */}
        {power.kind === 'solar' ? (
          <g className={isHighlighted('power') ? 'svg-pulse-highlight' : ''}>
            <line x1={cx - busHalfW} y1={cy} x2={cx - busHalfW - 14} y2={cy} stroke="#94a3b8" strokeWidth="2.8" />
            <rect
              x={cx - busHalfW - 14 - wingLen}
              y={cy - wingH / 2}
              width={wingLen}
              height={wingH}
              rx="2"
              fill="url(#solar-cells)"
              stroke={isHighlighted('power') ? '#fbbf24' : '#60a5fa'}
              strokeWidth={isHighlighted('power') ? '2' : '1.4'}
            />
            <line x1={cx + busHalfW} y1={cy} x2={cx + busHalfW + 14} y2={cy} stroke="#94a3b8" strokeWidth="2.8" />
            <rect
              x={cx + busHalfW + 14}
              y={cy - wingH / 2}
              width={wingLen}
              height={wingH}
              rx="2"
              fill="url(#solar-cells)"
              stroke={isHighlighted('power') ? '#fbbf24' : '#60a5fa'}
              strokeWidth={isHighlighted('power') ? '2' : '1.4'}
            />
            <text
              x={cx + busHalfW + 14 + wingLen / 2}
              y={cy + wingH / 2 + 16}
              textAnchor="middle"
              fill="#93c5fd"
              fontSize="9"
              fontFamily="IBM Plex Mono, monospace"
            >
              {power.areaM2} m²
            </text>
          </g>
        ) : (
          <g className={isHighlighted('power') ? 'svg-pulse-highlight' : ''}>
            {Array.from({ length: power.rtgCount }).map((_, idx) => {
              const side = idx % 2 === 0 ? -1 : 1;
              const rowOffset = idx === 2 ? 20 : 0;
              const startX = cx + side * busHalfW;
              const startY = cy + 12 + rowOffset;
              const rtgX = cx + side * (busHalfW + 34);
              const rtgY = cy + 20 + rowOffset;
              return (
                <g key={idx}>
                  <line x1={startX} y1={startY} x2={rtgX} y2={rtgY} stroke="#94a3b8" strokeWidth="2.2" />
                  <rect
                    x={side > 0 ? rtgX - 4 : rtgX - 28}
                    y={rtgY - 9}
                    width="32"
                    height="18"
                    rx="3"
                    fill="rgba(245, 158, 11, 0.24)"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                  {[-6, 0, 6].map((fy) => (
                    <line
                      key={fy}
                      x1={side > 0 ? rtgX - 4 : rtgX - 28}
                      y1={rtgY + fy}
                      x2={side > 0 ? rtgX + 28 : rtgX + 4}
                      y2={rtgY + fy}
                      stroke="#fbbf24"
                      strokeOpacity="0.75"
                      strokeWidth="1"
                    />
                  ))}
                </g>
              );
            })}
            <text
              x={cx + busHalfW + 40}
              y={cy - 4}
              textAnchor="start"
              fill="#fbbf24"
              fontSize="9"
              fontFamily="IBM Plex Mono, monospace"
            >
              RTG ×{power.rtgCount}
            </text>
          </g>
        )}

        {/* RADIATION SHIELD OUTLINE */}
        {shielding.id !== 'none' && (
          <rect
            x={cx - busHalfW - (shielding.id === 'vault' ? 7 : 3.5)}
            y={cy - busHalfH - (shielding.id === 'vault' ? 7 : 3.5)}
            width={(busHalfW + (shielding.id === 'vault' ? 7 : 3.5)) * 2}
            height={(busHalfH + (shielding.id === 'vault' ? 7 : 3.5)) * 2}
            rx="8"
            fill={shielding.id === 'vault' ? 'url(#shield-weave)' : 'none'}
            stroke="#f59e0b"
            strokeOpacity={shielding.id === 'standard' ? 0.72 : 0.96}
            strokeWidth={shielding.id === 'vault' ? 2.4 : 1.5}
            strokeDasharray={shielding.id === 'standard' ? '6 4' : undefined}
          />
        )}

        {/* MAIN SPACECRAFT BUS */}
        <polygon
          points={`
            ${cx - busHalfW + 10},${cy - busHalfH}
            ${cx + busHalfW - 10},${cy - busHalfH}
            ${cx + busHalfW},${cy - busHalfH + 10}
            ${cx + busHalfW},${cy + busHalfH - 10}
            ${cx + busHalfW - 10},${cy + busHalfH}
            ${cx - busHalfW + 10},${cy + busHalfH}
            ${cx - busHalfW},${cy + busHalfH - 10}
            ${cx - busHalfW},${cy - busHalfH + 10}
          `}
          fill="url(#bus-mli)"
          stroke={isHighlighted('bus') ? '#fbbf24' : '#cbd5e1'}
          strokeWidth={isHighlighted('bus') ? '2.4' : '1.7'}
        />

        <rect
          x={cx - busHalfW + 8}
          y={cy - 8}
          width={(busHalfW - 8) * 2}
          height="22"
          rx="2"
          fill="rgba(245, 158, 11, 0.14)"
          stroke="rgba(251, 191, 36, 0.4)"
          strokeWidth="0.9"
        />

        {/* BACKUP COMPUTER NODES */}
        <g>
          {Array.from({
            length: redundancy.id === 'single' ? 1 : redundancy.id === 'cross' ? 2 : 3,
          }).map((_, i, arr) => {
            const spacing = 14;
            const startX = cx - ((arr.length - 1) * spacing) / 2;
            const nx = startX + i * spacing;
            const ny = cy - busHalfH + 16;
            return (
              <g key={i}>
                <rect
                  x={nx - 5}
                  y={ny - 5}
                  width="10"
                  height="10"
                  rx="1.5"
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#7dd3fc"
                  strokeWidth="1.1"
                />
                <circle cx={nx} cy={ny} r="1.6" fill="#fbbf24" />
              </g>
            );
          })}
        </g>

        {/* PROPELLANT TANK */}
        <rect
          x={cx - tankW / 2}
          y={cy + busHalfH - tankH - 6}
          width={tankW}
          height={tankH}
          rx={tankH / 2.2}
          fill={propulsion.id === 'ion' ? 'rgba(6, 182, 212, 0.28)' : 'rgba(245, 158, 11, 0.26)'}
          stroke={propulsion.id === 'ion' ? '#22d3ee' : '#f59e0b'}
          strokeWidth="1.4"
        />
        <text
          x={cx}
          y={cy + busHalfH - tankH / 2 - 3}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="8"
          fontFamily="IBM Plex Mono, monospace"
        >
          {config.propellantKg} kg
        </text>

        {/* ENGINE + FLICKERING FLAME */}
        {propulsion.id === 'chemical' ? (
          <g>
            <polygon
              points={`${cx - 10},${cy + busHalfH} ${cx + 10},${cy + busHalfH} ${cx + 18},${cy + busHalfH + 22} ${cx - 18},${cy + busHalfH + 22}`}
              fill="#334155"
              stroke="#f59e0b"
              strokeWidth="1.5"
            />
            <path
              d={`M ${cx - 14} ${cy + busHalfH + 23} Q ${cx} ${cy + busHalfH + 78} ${cx + 14} ${cy + busHalfH + 23} Z`}
              fill="url(#chem-plume)"
              className="plume-anim"
            />
          </g>
        ) : (
          <g>
            <rect
              x={cx - 16}
              y={cy + busHalfH}
              width="32"
              height="12"
              rx="2"
              fill="#1e293b"
              stroke="#22d3ee"
              strokeWidth="1.6"
            />
            {[-10, -4, 2, 8].map((gx) => (
              <line
                key={gx}
                x1={cx + gx}
                y1={cy + busHalfH + 2}
                x2={cx + gx}
                y2={cy + busHalfH + 10}
                stroke="#67e8f9"
                strokeWidth="1"
              />
            ))}
            <path
              d={`M ${cx - 14} ${cy + busHalfH + 13} L ${cx - 24} ${cy + busHalfH + 72} L ${cx + 24} ${cy + busHalfH + 72} L ${cx + 14} ${cy + busHalfH + 13} Z`}
              fill="url(#ion-plume)"
              className="plume-anim"
            />
          </g>
        )}

        {/* DISH */}
        <g>
          <rect x={cx - 4} y={cy - busHalfH - 18} width="8" height="18" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
          <path
            d={`M ${cx - dishHalfW} ${cy - busHalfH - 18 - dishDepth} Q ${cx} ${cy - busHalfH - 8} ${cx + dishHalfW} ${cy - busHalfH - 18 - dishDepth}`}
            fill="rgba(226, 232, 240, 0.16)"
            stroke="#e2e8f0"
            strokeWidth="2"
          />
          <line x1={cx - dishHalfW * 0.55} y1={cy - busHalfH - 18 - dishDepth * 0.65} x2={cx} y2={cy - busHalfH - 34 - dishDepth} stroke="#94a3b8" strokeWidth="1.1" />
          <line x1={cx + dishHalfW * 0.55} y1={cy - busHalfH - 18 - dishDepth * 0.65} x2={cx} y2={cy - busHalfH - 34 - dishDepth} stroke="#94a3b8" strokeWidth="1.1" />
          <circle cx={cx} cy={cy - busHalfH - 35 - dishDepth} r="3" fill="#fbbf24" />
          <text
            x={cx + dishHalfW + 8}
            y={cy - busHalfH - 20 - dishDepth / 2}
            fill="#cbd5e1"
            fontSize="8.5"
            fontFamily="IBM Plex Mono, monospace"
          >
            {antenna.diameterM}m
          </text>
        </g>

        {/* INSTRUMENT SQUARES */}
        {instruments.map((inst, idx) => {
          if (inst.id === 'magnetometer') {
            return (
              <g key={inst.id}>
                <line
                  x1={cx - busHalfW}
                  y1={cy - busHalfH + 14}
                  x2={cx - busHalfW - 44}
                  y2={cy - busHalfH - 18}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <circle cx={cx - busHalfW - 46} cy={cy - busHalfH - 20} r="4.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.4" />
              </g>
            );
          }

          if (inst.id === 'sampler') {
            return (
              <g key={inst.id}>
                <polyline
                  points={`${cx + busHalfW},${cy - busHalfH + 16} ${cx + busHalfW + 26},${cy - busHalfH - 2} ${cx + busHalfW + 40},${cy - busHalfH + 12}`}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.8"
                />
                <circle cx={cx + busHalfW + 42} cy={cy - busHalfH + 14} r="4" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />
              </g>
            );
          }

          const deckSlot = idx % 7;
          const ix = cx - busHalfW + 14 + deckSlot * ((busHalfW * 2 - 28) / 6);
          const iy = cy + 2;
          return (
            <g key={inst.id}>
              <rect
                x={ix - 5}
                y={iy - 5}
                width="10"
                height="10"
                rx="2"
                fill="rgba(16, 185, 129, 0.28)"
                stroke="#34d399"
                strokeWidth="1.2"
              />
              <circle cx={ix} cy={iy} r="1.8" fill="#6ee7b7" />
            </g>
          );
        })}

        {/* Telemetry Readouts */}
        <text x="16" y="276" fill="#7dd3fc" fontSize="9" fontFamily="IBM Plex Mono, monospace">
          Δv: {Math.round(achievedDeltaV)} m/s
        </text>
        <text x="16" y="292" fill="#7dd3fc" fontSize="9" fontFamily="IBM Plex Mono, monospace">
          PWR: {Math.round(availablePowerW)} W
        </text>
        <text x="424" y="276" textAnchor="end" fill="#7dd3fc" fontSize="9" fontFamily="IBM Plex Mono, monospace">
          LINK: {Math.round(monthlyDownlinkGb)} Gb/mo
        </text>
        <text x="424" y="292" textAnchor="end" fill="#fbbf24" fontSize="9" fontFamily="IBM Plex Mono, monospace">
          ROOM: {metrics.instrumentMassKg}/{bus.payloadCapacityKg} kg
        </text>
      </svg>

      {!compact && (
        <div className="schematic-legend">
          <div className="schematic-legend-row font-mono">
            <span>{power.name}</span>
            <span>·</span>
            <span>{propulsion.name}</span>
            <span>·</span>
            <span>{shielding.name}</span>
          </div>
          {instruments.length > 0 && (
            <div className="schematic-instruments-list">
              {instruments.map((i) => i.shortName).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

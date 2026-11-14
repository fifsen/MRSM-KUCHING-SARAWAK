import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { EngineeringMetrics, FlightPhaseSpec, FlightState } from '../../engine/physics';

interface FlightStageProps {
  metrics: EngineeringMetrics;
  phases: FlightPhaseSpec[];
  flight: FlightState;
  countdownNum: number | null; // 3, 2, 1, 0 (liftoff), or null
  isLiftoff: boolean;
}

export const FlightStage: React.FC<FlightStageProps> = ({
  metrics,
  phases,
  flight,
  countdownNum,
  isLiftoff,
}) => {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [craftPt, setCraftPt] = useState<{ x: number; y: number; angle: number }>({
    x: 86,
    y: 170,
    angle: -35,
  });
  const [orbitAngle, setOrbitAngle] = useState(0);

  const { parts } = metrics;
  const isIon = parts.propulsion.id === 'ion';
  const targetColors: Record<string, { main: string; rim: string; glow: string }> = {
    lunar: { main: '#cbd5e1', rim: '#64748b', glow: 'rgba(203, 213, 225, 0.35)' },
    mars: { main: '#ea580c', rim: '#9a3412', glow: 'rgba(249, 115, 22, 0.38)' },
    asteroid: { main: '#94a3b8', rim: '#334155', glow: 'rgba(148, 163, 184, 0.3)' },
    europa: { main: '#7dd3fc', rim: '#0369a1', glow: 'rgba(56, 189, 248, 0.42)' },
  };
  const tColor = targetColors[parts.mission.id] ?? targetColors.lunar;

  // Curved route from Earth (86, 170) to Target (545, 118)
  const routeD = useMemo(() => {
    return isIon
      ? 'M 86 170 C 175 42, 370 245, 545 118'
      : 'M 86 170 Q 315 36, 545 118';
  }, [isIon]);

  // Progress along route: Launch (0) -> Cruise 1 (0.34) -> Cruise 2 (0.68) -> Arrive (1.0)
  const targetRouteProgress = useMemo(() => {
    if (flight.phaseIndex === 0 && !flight.finished) return isLiftoff ? 0.08 : 0;
    if (flight.phaseIndex === 1) return 0.36;
    if (flight.phaseIndex === 2) return 0.7;
    return 1.0;
  }, [flight.finished, flight.phaseIndex, isLiftoff]);

  const progressRef = useRef(0);

  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl) return;
    const totalLen = pathEl.getTotalLength();
    if (totalLen <= 0) return;

    const startProg = progressRef.current;
    const endProg = targetRouteProgress;

    const updatePoint = (p: number) => {
      const clamped = Math.max(0, Math.min(1, p));
      const len = clamped * totalLen;
      const pt = pathEl.getPointAtLength(len);
      const ahead = pathEl.getPointAtLength(Math.min(totalLen, len + 2));
      const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
      setCraftPt({ x: pt.x, y: pt.y, angle });
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || Math.abs(endProg - startProg) < 0.005) {
      progressRef.current = endProg;
      updatePoint(endProg);
      return;
    }

    const interp = d3.interpolateNumber(startProg, endProg);
    const startTime = performance.now();
    const duration = 820;
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = d3.easeCubicInOut(t);
      const cur = interp(eased);
      progressRef.current = cur;
      updatePoint(cur);
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [targetRouteProgress, routeD]);

  // Continuous orbit animation once craft reaches Arrive / Ops (phaseIndex >= 3)
  const inOrbit =
    (flight.phaseIndex >= 3 || (flight.finished && flight.survived)) &&
    flight.survived &&
    targetRouteProgress >= 0.99;

  useEffect(() => {
    if (!inOrbit) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setOrbitAngle((a) => (a + dt * 1.6) % (Math.PI * 2));
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [inOrbit]);

  const targetX = 545;
  const targetY = 118;
  const orbitR = 40;

  const displayX = inOrbit ? targetX + Math.cos(orbitAngle) * orbitR : craftPt.x;
  const displayY = inOrbit ? targetY + Math.sin(orbitAngle) * orbitR : craftPt.y;
  const displayAngle = inOrbit ? ((orbitAngle + Math.PI / 2) * 180) / Math.PI : craftPt.angle;

  const showArrivalBurn = flight.phaseIndex === 3 && !flight.finished && flight.survived;
  const showCruiseFlame = (flight.phaseIndex === 1 || flight.phaseIndex === 2) && !flight.finished && flight.survived;
  const showExplosion = flight.finished && !flight.survived;
  const burnColor = isIon ? '#38bdf8' : '#f97316';
  const burnCore = isIon ? '#a5f3fc' : '#fef08a';

  const activePhase = phases[Math.min(flight.phaseIndex, phases.length - 1)];

  return (
    <div className={`flight-stage ${isLiftoff ? 'screen-shake' : ''}`}>
      <svg
        viewBox="0 0 640 245"
        className="flight-stage-svg"
        role="img"
        aria-label={`Flight stage: ${activePhase.name}`}
      >
        <defs>
          <radialGradient id="stage-earth-grad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>
          <radialGradient id="stage-target-grad" cx="35%" cy="32%" r="70%">
            <stop offset="0%" stopColor={tColor.main} />
            <stop offset="100%" stopColor={tColor.rim} />
          </radialGradient>
          <radialGradient id="explosion-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#fbbf24" />
            <stop offset="70%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Earth + Launch Pad */}
        <circle cx="86" cy="170" r="34" fill="rgba(56, 189, 248, 0.16)" />
        <circle cx="86" cy="170" r="26" fill="url(#stage-earth-grad)" stroke="#bae6fd" strokeWidth="1.2" />
        <path d="M 74 162 Q 86 155 96 164 Q 88 176 76 172 Z" fill="rgba(52, 211, 153, 0.45)" />
        <text x="86" y="214" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontFamily="IBM Plex Mono, monospace">
          EARTH
        </text>

        {/* Target Orbit Ring & Planet */}
        <circle
          cx={targetX}
          cy={targetY}
          r={orbitR}
          fill="none"
          stroke={tColor.main}
          strokeOpacity="0.35"
          strokeWidth="1.4"
          strokeDasharray="4 4"
        />
        <circle cx={targetX} cy={targetY} r="32" fill={tColor.glow} />
        <circle
          cx={targetX}
          cy={targetY}
          r="24"
          fill="url(#stage-target-grad)"
          stroke={tColor.main}
          strokeWidth="1.3"
        />
        <text
          x={targetX}
          y={targetY + 56}
          textAnchor="middle"
          fill="#fbbf24"
          fontSize="11"
          fontFamily="IBM Plex Mono, monospace"
        >
          {parts.mission.name.toUpperCase()}
        </text>

        {/* Dashed Curved Route */}
        <path
          ref={pathRef}
          d={routeD}
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.45"
          strokeWidth="2.4"
          strokeDasharray="7 6"
        />

        {/* Launch Smoke & Liftoff Rocket */}
        {isLiftoff && (
          <g className="liftoff-smoke-group">
            <circle cx="86" cy="144" r="14" fill="rgba(226, 232, 240, 0.45)" className="smoke-puff" />
            <circle cx="72" cy="149" r="11" fill="rgba(203, 213, 225, 0.35)" className="smoke-puff" />
            <circle cx="100" cy="149" r="11" fill="rgba(203, 213, 225, 0.35)" className="smoke-puff" />
          </g>
        )}

        {/* Arrival Burn Trail Glow */}
        {showArrivalBurn && (
          <circle
            cx={displayX}
            cy={displayY}
            r="22"
            fill="none"
            stroke={burnColor}
            strokeWidth="2"
            strokeOpacity="0.65"
            className="burn-ring-pulse"
          />
        )}

        {/* Active Spacecraft or Explosion */}
        {!showExplosion ? (
          <g transform={`translate(${displayX}, ${displayY}) rotate(${displayAngle})`}>
            {(showArrivalBurn || showCruiseFlame || isLiftoff) && (
              <polygon
                points={
                  showArrivalBurn || isLiftoff
                    ? '-5,-5 -24,0 -5,5'
                    : '-5,-3 -15,0 -5,3'
                }
                fill={showArrivalBurn ? burnColor : isIon ? '#38bdf8' : '#f97316'}
                className="plume-anim"
              />
            )}
            {(showArrivalBurn || isLiftoff) && (
              <polygon points="-4,-2.5 -14,0 -4,2.5" fill={burnCore} />
            )}
            {/* Solar wings / body */}
            <rect x="-4" y="-12" width="8" height="24" rx="1.5" fill="#38bdf8" stroke="#bae6fd" strokeWidth="0.9" />
            <polygon points="10,0 -6,-5.5 -4,0 -6,5.5" fill="#fbbf24" stroke="#fef3c7" strokeWidth="1" />
          </g>
        ) : (
          <g transform={`translate(${displayX}, ${displayY})`} className="explosion-burst">
            <circle r="34" fill="url(#explosion-grad)" />
            <polygon
              points="0,-28 7,-9 27,-12 12,3 22,22 2,12 -14,25 -10,5 -28,-4 -9,-9"
              fill="#fbbf24"
              stroke="#ef4444"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* 3-2-1 Countdown Overlay */}
      {countdownNum !== null && (
        <div className="countdown-overlay" aria-live="assertive">
          <div key={countdownNum} className="countdown-num font-display">
            {countdownNum > 0 ? countdownNum : 'LIFTOFF!'}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import type { DebriefResult, EngineeringMetrics, FlightState } from '../../engine/physics';
import { soundEngine } from '../../audio/soundEngine';
import { TelemetryHistoryChart } from '../TelemetryHistoryChart';
import {
  Coins,
  Compass,
  FlaskConical,
  Fuel,
  Radio,
  RotateCcw,
  Shield,
  Zap,
} from 'lucide-react';

interface StepDebriefProps {
  metrics: EngineeringMetrics;
  flight: FlightState;
  debrief: DebriefResult;
  seed: string;
  onTryAgain: () => void;
  onNewTarget: () => void;
}

const LESSON_ICONS = {
  shield: Shield,
  zap: Zap,
  radio: Radio,
  flask: FlaskConical,
  fuel: Fuel,
  coins: Coins,
};

export const StepDebrief: React.FC<StepDebriefProps> = ({
  metrics,
  flight,
  debrief,
  seed,
  onTryAgain,
  onNewTarget,
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { cost, parts } = metrics;
  const isWin = debrief.grade === 'S' || debrief.grade === 'A';

  // Animated score counter
  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayScore(debrief.totalScore);
      return;
    }

    const start = performance.now();
    const dur = 950;
    let rafId = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(debrief.totalScore * eased));
      if (t < 1) rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [debrief.totalScore]);

  // Confetti + Win sound for S or A
  useEffect(() => {
    if (!isWin) return;
    soundEngine.playWinFanfare();

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 640;
    canvas.height = canvas.offsetHeight || 380;

    const colors = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#a78bfa'];
    const particles = Array.from({ length: 72 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 3.4,
      vy: 2 + Math.random() * 3.5,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let rafId = 0;
    let frame = 0;
    const draw = () => {
      frame += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.vRot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / 170);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
        ctx.restore();
      }
      if (frame < 170) {
        rafId = window.requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    rafId = window.requestAnimationFrame(draw);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isWin]);

  const costSegments = [
    { label: 'Rocket', val: cost.rocket, color: '#f59e0b' },
    { label: 'Bus', val: cost.bus + cost.redundancy, color: '#38bdf8' },
    { label: 'Sensors', val: cost.instruments, color: '#10b981' },
    { label: 'Power', val: cost.power, color: '#818cf8' },
    {
      label: 'Engine+Fuel',
      val: Number((cost.propulsion + cost.propellant).toFixed(1)),
      color: '#fb923c',
    },
    { label: 'Dish+Shield', val: cost.antenna + cost.shielding, color: '#22d3ee' },
    { label: 'Ops', val: cost.operations, color: '#94a3b8' },
  ];

  return (
    <section className="step-panel result-panel" aria-labelledby="step-debrief-title">
      {isWin && <canvas ref={confettiCanvasRef} className="confetti-canvas" aria-hidden="true" />}

      <div className="step-header">
        <div>
          <p className="step-kicker font-mono">
            Step 6 · {parts.mission.name} · {seed}
          </p>
          <h2 id="step-debrief-title" className="step-title">
            Mission Result
          </h2>
        </div>
      </div>

      {/* Grade Stamp Slam + Animated Score Counter */}
      <div className="debrief-hero">
        <div className={`grade-stamp grade-stamp--${debrief.grade.toLowerCase()} font-display`}>
          {debrief.grade}
        </div>

        <div className="score-counter-wrap">
          <div className="score-big font-mono tabular-nums">
            <span>{displayScore}</span>
            <span className="score-denom">/ 100</span>
          </div>
          <div className="score-bars font-mono tabular-nums">
            <div className="score-bar-row">
              <span>Science</span>
              <strong>{debrief.scienceScore} / 75</strong>
              <div className="sb-track">
                <div
                  className="sb-fill sb-fill--cyan"
                  style={{ width: `${(debrief.scienceScore / 75) * 100}%` }}
                />
              </div>
            </div>
            <div className="score-bar-row">
              <span>Survival</span>
              <strong>{debrief.survivalScore} / 10</strong>
              <div className="sb-track">
                <div
                  className="sb-fill sb-fill--ok"
                  style={{ width: `${(debrief.survivalScore / 10) * 100}%` }}
                />
              </div>
            </div>
            <div className="score-bar-row">
              <span>Savings</span>
              <strong>{debrief.budgetScore} / 15</strong>
              <div className="sb-track">
                <div
                  className="sb-fill sb-fill--amber"
                  style={{ width: `${(debrief.budgetScore / 15) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Split Bar */}
      <div className="cost-split-card">
        <div className="cost-split-head font-mono tabular-nums">
          <span>Cost Split</span>
          <span className="text-amber">
            ${debrief.finalCostTotal.toFixed(0)}M / ${metrics.effectiveBudgetCap}M
          </span>
        </div>
        <div className="cost-stacked-bar" aria-hidden="true">
          {costSegments.map((seg) => (
            <div
              key={seg.label}
              style={{
                width: `${(seg.val / Math.max(debrief.finalCostTotal, 1)) * 100}%`,
                backgroundColor: seg.color,
              }}
              title={`${seg.label}: $${seg.val}M`}
            />
          ))}
        </div>
        <div className="cost-legend font-mono tabular-nums">
          {costSegments.map((seg) => (
            <span key={seg.label} className="cost-legend-item">
              <span className="cost-swatch" style={{ backgroundColor: seg.color }} />
              {seg.label} ${seg.val.toFixed(0)}M
            </span>
          ))}
        </div>
      </div>

      {/* Historical Mission Telemetry Chart (Power, Mass, Data Rate) */}
      <TelemetryHistoryChart metrics={metrics} flight={flight} />

      {/* 1 to 3 Icon-Led Lessons */}
      <div className="lessons-strip">
        {debrief.lessons.map((lesson, idx) => {
          const Icon = LESSON_ICONS[lesson.icon];
          return (
            <div key={idx} className={`lesson-chip lesson-chip--${lesson.tone}`}>
              <Icon size={17} aria-hidden="true" />
              <span>{lesson.text}</span>
            </div>
          );
        })}
      </div>

      <div className="step-footer-actions">
        <button type="button" className="btn-secondary btn-lg btn-pill" onClick={onTryAgain}>
          <RotateCcw size={17} />
          <span>Try again ({seed})</span>
        </button>
        <button
          type="button"
          className="btn-launch btn-lg btn-pill btn-pulse"
          onClick={onNewTarget}
        >
          <Compass size={17} />
          <span>New target</span>
        </button>
      </div>
    </section>
  );
};

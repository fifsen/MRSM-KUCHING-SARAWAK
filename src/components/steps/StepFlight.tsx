import React, { useEffect, useRef, useState } from 'react';
import type {
  EngineeringMetrics,
  FlightPhaseSpec,
  FlightState,
} from '../../engine/physics';
import { soundEngine, type FlightSoundMode } from '../../audio/soundEngine';
import { FlightStage } from './FlightStage';
import {
  AlertTriangle,
  Award,
  FastForward,
  Flame,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';

interface StepFlightProps {
  metrics: EngineeringMetrics;
  phases: FlightPhaseSpec[];
  flight: FlightState;
  onAdvancePhase: () => void;
  onResolveEvent: (optionId: string) => void;
  onFinishToDebrief: () => void;
  onCruiseSpeedChange?: (speedMultiplier: number) => void;
}

export const StepFlight: React.FC<StepFlightProps> = ({
  metrics,
  phases,
  flight,
  onAdvancePhase,
  onResolveEvent,
  onFinishToDebrief,
  onCruiseSpeedChange,
}) => {
  const [autoFly, setAutoFly] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [isLiftoff, setIsLiftoff] = useState(false);
  const countdownTimersRef = useRef<number[]>([]);

  const { parts } = metrics;
  const activePhase = phases[Math.min(flight.phaseIndex, phases.length - 1)];

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      countdownTimersRef.current.forEach((id) => window.clearTimeout(id));
      soundEngine.stopFlightSoundscape();
      onCruiseSpeedChange?.(1);
    };
  }, [onCruiseSpeedChange]);

  // Speed up starfield during Cruise phases
  useEffect(() => {
    const isCruising =
      !flight.finished &&
      flight.survived &&
      (activePhase.kind === 'cruise' || isLiftoff);
    onCruiseSpeedChange?.(isCruising ? 6.5 : 1);
  }, [activePhase.kind, flight.finished, flight.survived, isLiftoff, onCruiseSpeedChange]);

  // Adaptive ambient flight soundscape
  useEffect(() => {
    const phaseHazard = Math.min(1, metrics.baseHazardPerPhase * 2.5);
    const healthStress = Math.max(0, (100 - flight.health) / 100);

    let mode: FlightSoundMode = 'cruise';
    let intensity = 0.28 + phaseHazard * 0.25;

    if (flight.finished) {
      mode = flight.survived ? 'science' : 'hazard';
      intensity = 0.16;
    } else if (
      flight.pendingEvent ||
      activePhase.kind === 'arrival' ||
      phaseHazard >= 0.45 ||
      flight.health < 60
    ) {
      mode = 'hazard';
      intensity = Math.min(
        1,
        0.58 + phaseHazard * 0.25 + healthStress * 0.35 + (flight.pendingEvent ? 0.22 : 0),
      );
    } else if (activePhase.kind === 'ops') {
      mode = 'science';
      intensity = Math.min(1, 0.56 + (flight.phaseIndex - 3) * 0.12 + phaseHazard * 0.15);
    } else if (activePhase.kind === 'launch') {
      mode = 'hazard';
      intensity = 0.52;
    }

    soundEngine.updateFlightSoundscape({ active: true, intensity, mode });
  }, [
    activePhase.kind,
    flight.finished,
    flight.health,
    flight.pendingEvent,
    flight.phaseIndex,
    flight.survived,
    metrics.baseHazardPerPhase,
  ]);

  // Auto-Fly timer
  useEffect(() => {
    if (!autoFly || countdownNum !== null) return;
    if (flight.pendingEvent || flight.finished) {
      setAutoFly(false);
      return;
    }
    const timer = window.setTimeout(() => {
      handleRunPhase();
    }, 1050);
    return () => window.clearTimeout(timer);
  });

  const triggerLaunchSequence = () => {
    if (countdownNum !== null) return;
    countdownTimersRef.current.forEach((id) => window.clearTimeout(id));
    countdownTimersRef.current = [];

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      soundEngine.playLaunchRumble();
      onAdvancePhase();
      return;
    }

    setCountdownNum(3);
    soundEngine.playCountdownBeep(false);

    const t1 = window.setTimeout(() => {
      setCountdownNum(2);
      soundEngine.playCountdownBeep(false);
    }, 520);

    const t2 = window.setTimeout(() => {
      setCountdownNum(1);
      soundEngine.playCountdownBeep(false);
    }, 1040);

    const t3 = window.setTimeout(() => {
      setCountdownNum(0);
      setIsLiftoff(true);
      soundEngine.playCountdownBeep(true);
      soundEngine.playLaunchRumble();
      onAdvancePhase();
    }, 1560);

    const t4 = window.setTimeout(() => {
      setCountdownNum(null);
      setIsLiftoff(false);
    }, 2450);

    countdownTimersRef.current = [t1, t2, t3, t4];
  };

  const handleRunPhase = () => {
    if (flight.phaseIndex === 0 && flight.logs.length === 0) {
      triggerLaunchSequence();
    } else {
      onAdvancePhase();
    }
  };

  // Compute live science percent ring
  const survivingCount = parts.instruments.filter(
    (i) => !flight.lostInstrumentIds.includes(i.id),
  ).length;
  const sciencePct = Math.round(
    metrics.projectedScienceFraction *
      flight.downlinkMultiplier *
      flight.scienceBonusMultiplier *
      (parts.instruments.length > 0 ? survivingCount / parts.instruments.length : 0) *
      100,
  );
  const ringR = 20;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDashOffset = ringCirc * (1 - Math.min(100, sciencePct) / 100);

  const lastFourLogs = [...flight.logs].slice(-4).reverse();

  const EventIcon =
    flight.pendingEvent?.kind === 'solar_storm'
      ? Flame
      : flight.pendingEvent?.kind === 'power_drop'
        ? Zap
        : flight.pendingEvent?.kind === 'antenna_bumped'
          ? Radio
          : ShieldAlert;

  return (
    <section className="step-panel" aria-labelledby="step-flight-title">
      <div className="step-header">
        <div>
          <p className="step-kicker font-mono">
            Step 5 · {parts.mission.name}
          </p>
          <h2 id="step-flight-title" className="step-title">
            {flight.finished
              ? flight.survived
                ? 'Mission Complete'
                : 'Mission Failed'
              : activePhase.name}
          </h2>
        </div>

        {/* 7-Step Phase Dots */}
        <ol className="phase-track font-mono" aria-label="Flight phases">
          {phases.map((p) => {
            const done = flight.finished
              ? flight.survived || p.index < flight.phaseIndex
              : p.index < flight.phaseIndex;
            const current = !flight.finished && p.index === flight.phaseIndex;
            return (
              <li
                key={p.id}
                className={`phase-step ${done ? 'phase-step--done' : ''} ${
                  current ? 'phase-step--current' : ''
                }`}
              >
                <span className="phase-step-dot" aria-hidden="true" />
                <span className="phase-step-label">{p.shortName}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Animated Earth-to-Target Stage */}
      <FlightStage
        metrics={metrics}
        phases={phases}
        flight={flight}
        countdownNum={countdownNum}
        isLiftoff={isLiftoff}
      />

      {/* Compact HUD: Science Ring, Δv Spare, Health, Instruments */}
      <div className="flight-hud">
        <div className="hud-science-ring">
          <svg width="50" height="50" viewBox="0 0 50 50" aria-hidden="true">
            <circle cx="25" cy="25" r={ringR} fill="none" stroke="rgba(56,189,248,0.18)" strokeWidth="4.5" />
            <circle
              cx="25"
              cy="25"
              r={ringR}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringDashOffset}
              transform="rotate(-90 25 25)"
            />
          </svg>
          <div>
            <span className="hud-k">Science</span>
            <strong className="hud-v font-mono tabular-nums text-cyan">{sciencePct}%</strong>
          </div>
        </div>

        <div className="hud-stat">
          <span className="hud-k">Δv Spare</span>
          <strong
            className={`hud-v font-mono tabular-nums ${
              flight.deltaVSpare < 0
                ? 'text-fail'
                : flight.deltaVSpare < 100
                  ? 'text-warn'
                  : 'text-ok'
            }`}
          >
            {Math.round(flight.deltaVSpare)} m/s
          </strong>
        </div>

        <div className="hud-stat">
          <span className="hud-k">Hull</span>
          <strong
            className={`hud-v font-mono tabular-nums ${
              flight.health <= 0 ? 'text-fail' : flight.health < 55 ? 'text-warn' : 'text-ok'
            }`}
          >
            {flight.health}%
          </strong>
        </div>

        <div className="hud-instruments" aria-label="Instruments status">
          {parts.instruments.map((inst) => {
            const lost = flight.lostInstrumentIds.includes(inst.id);
            return (
              <span
                key={inst.id}
                className={`hud-inst-chip font-mono ${lost ? 'hud-inst-chip--lost' : ''}`}
              >
                <Sparkles size={11} aria-hidden="true" />
                <span>{inst.shortName}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* RANDOM EVENT POPUP */}
      {flight.pendingEvent && (
        <div className="event-card" role="alertdialog" aria-labelledby="event-title">
          <div className="event-header">
            <span className="event-icon-circle">
              <EventIcon size={20} className="text-amber" />
            </span>
            <div>
              <h3 id="event-title" className="event-title">
                {flight.pendingEvent.title}
              </h3>
              <span className="event-kicker font-mono">{flight.pendingEvent.subtitle}</span>
            </div>
          </div>

          <div
            className={`event-options ${
              flight.pendingEvent.options.length === 3 ? 'event-options--3' : ''
            }`}
          >
            {flight.pendingEvent.options.map((opt) => {
              const oddsPct = Math.round(opt.odds * 100);
              const oddsTone = oddsPct >= 75 ? 'ok' : oddsPct >= 50 ? 'warn' : 'fail';
              return (
                <button
                  key={opt.id}
                  type="button"
                  className="event-option-btn tile-lift"
                  onClick={() => onResolveEvent(opt.id)}
                >
                  <span className="event-option-title">{opt.label}</span>
                  <span className={`event-odds font-mono odds--${oddsTone}`}>
                    {opt.oddsText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Bar */}
      {!flight.pendingEvent && !flight.finished && (
        <div className="flight-action-bar">
          <button
            type="button"
            className={`btn-secondary btn-pill ${autoFly ? 'btn-autofly--active' : ''}`}
            disabled={countdownNum !== null}
            onClick={() => setAutoFly((v) => !v)}
            aria-pressed={autoFly}
          >
            {autoFly ? <Pause size={16} /> : <FastForward size={16} />}
            <span>{autoFly ? 'Pause' : 'Auto-fly'}</span>
          </button>

          <button
            type="button"
            className="btn-launch btn-lg btn-pill btn-pulse"
            disabled={autoFly || countdownNum !== null}
            onClick={handleRunPhase}
          >
            <Play size={17} />
            <span>
              {countdownNum !== null
                ? 'Launching...'
                : `Run ${activePhase.name}`}
            </span>
          </button>
        </div>
      )}

      {flight.finished && (
        <div className={`frr-banner ${flight.survived ? 'frr-banner--go' : 'frr-banner--nogo'}`}>
          <div className="frr-banner-icon" aria-hidden="true">
            {flight.survived ? <Award size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div className="flex-1">
            <h3>
              {flight.survived
                ? `Arrived · ${Math.round(flight.dataDeliveredGb)} Gb`
                : flight.explosionReason ?? 'Spacecraft lost'}
            </h3>
          </div>
          <button
            type="button"
            className="btn-launch btn-lg btn-pill btn-pulse"
            onClick={onFinishToDebrief}
          >
            <span>See Result</span>
          </button>
        </div>
      )}

      {/* Last 4 Log Lines as Toasts */}
      {lastFourLogs.length > 0 && (
        <div className="toast-stack" aria-live="polite" aria-label="Recent flight events">
          {lastFourLogs.map((entry, idx) => (
            <div key={`${entry.phaseId}-${idx}`} className={`flight-toast flight-toast--${entry.status}`}>
              <span className="toast-phase font-mono">{entry.phaseName}</span>
              <span className="toast-msg">{entry.headline}</span>
              <span className="toast-hp font-mono tabular-nums">{entry.healthAfter}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

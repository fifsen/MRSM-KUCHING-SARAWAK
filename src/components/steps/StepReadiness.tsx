import React from 'react';
import type { EngineeringMetrics } from '../../engine/physics';
import type { SpacecraftTab } from './StepSpacecraft';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Dices,
  Rocket,
  Wrench,
  X,
} from 'lucide-react';

interface StepReadinessProps {
  metrics: EngineeringMetrics;
  seed: string;
  onSeedChange: (seed: string) => void;
  onRandomizeSeed: () => void;
  onJumpToFix: (step: 1 | 2 | 3, tab?: SpacecraftTab) => void;
  onBack: () => void;
  onLaunchMission: () => void;
}

export const StepReadiness: React.FC<StepReadinessProps> = ({
  metrics,
  seed,
  onSeedChange,
  onRandomizeSeed,
  onJumpToFix,
  onBack,
  onLaunchMission,
}) => {
  const { checks, allReady, parts } = metrics;

  return (
    <section className="step-panel" aria-labelledby="step-frr-title">
      <div className="step-header">
        <div>
          <p className="step-kicker font-mono">
            Step 4 · {parts.mission.name}
          </p>
          <h2 id="step-frr-title" className="step-title">
            Flight Review
          </h2>
        </div>

        <div
          className={`go-stamp font-display ${allReady ? 'go-stamp--go' : 'go-stamp--nogo'}`}
          key={allReady ? 'go' : 'nogo'}
        >
          {allReady ? 'GO' : 'NO-GO'}
        </div>
      </div>

      {/* 10-Row Animated Checklist */}
      <div className="frr-checklist">
        {checks.map((chk, idx) => (
          <div
            key={chk.id}
            className={`frr-row frr-row--${chk.status}`}
            style={{ animationDelay: `${idx * 35}ms` }}
          >
            <div className="frr-row-left">
              <span className={`frr-badge frr-badge--${chk.status}`} aria-hidden="true">
                {chk.status === 'pass' ? (
                  <Check size={14} strokeWidth={3} />
                ) : chk.status === 'warn' ? (
                  <AlertTriangle size={14} strokeWidth={2.5} />
                ) : (
                  <X size={14} strokeWidth={3} />
                )}
              </span>
              <span className="frr-row-label">{chk.label}</span>
            </div>

            <div className="frr-row-right">
              <span className="frr-item-val font-mono tabular-nums">{chk.summary}</span>
              {chk.status !== 'pass' && (
                <button
                  type="button"
                  className="btn-fix btn-pill"
                  onClick={() =>
                    onJumpToFix(chk.fixStep, chk.fixSection as SpacecraftTab | undefined)
                  }
                >
                  <Wrench size={13} />
                  <span>Fix</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Scenario Seed + Dice Button */}
      <div className="seed-box">
        <label htmlFor="flight-seed-input" className="seed-title">
          Scenario Seed
        </label>
        <div className="seed-row">
          <input
            id="flight-seed-input"
            type="text"
            value={seed}
            maxLength={24}
            onChange={(e) => onSeedChange(e.target.value)}
            className="seed-input font-mono"
            placeholder="APOLLO-42"
          />
          <button
            type="button"
            className="btn-secondary btn-pill"
            onClick={onRandomizeSeed}
            aria-label="Randomize seed"
          >
            <Dices size={17} />
            <span>Roll</span>
          </button>
        </div>
      </div>

      <div className="step-footer-actions">
        <button type="button" className="btn-secondary btn-pill" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <button
          type="button"
          className={`btn-launch btn-lg btn-pill ${allReady ? 'btn-pulse' : ''}`}
          disabled={!allReady}
          onClick={onLaunchMission}
        >
          <Rocket size={18} />
          <span>{allReady ? 'Launch' : 'Blocked'}</span>
        </button>
      </div>
    </section>
  );
};

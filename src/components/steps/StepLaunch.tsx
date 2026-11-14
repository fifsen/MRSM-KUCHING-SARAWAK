import React from 'react';
import { ROCKETS, type RocketId } from '../../data/missionData';
import type { EngineeringMetrics } from '../../engine/physics';
import { RocketIllustration } from '../TargetIllustration';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';

interface StepLaunchProps {
  selectedRocketId: RocketId;
  metrics: EngineeringMetrics;
  onSelectRocket: (id: RocketId) => void;
  draftSaved: boolean;
  onSaveDraft: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const StepLaunch: React.FC<StepLaunchProps> = ({
  selectedRocketId,
  metrics,
  onSelectRocket,
  draftSaved,
  onSaveDraft,
  onBack,
  onNext,
}) => {
  const { wetMassKg } = metrics;

  return (
    <section className="step-panel" aria-labelledby="step-launch-title">
      <div className="step-header">
        <div>
          <p className="step-kicker font-mono">
            Step 3 · {Math.round(wetMassKg)} kg Craft
          </p>
          <h2 id="step-launch-title" className="step-title">
            Pick Rocket
          </h2>
        </div>

        <button
          type="button"
          className={`btn-save-draft btn-pill ${draftSaved ? 'btn-save-draft--saved' : ''}`}
          onClick={onSaveDraft}
        >
          {draftSaved ? <Check size={15} /> : <Save size={15} />}
          <span>{draftSaved ? 'Saved' : 'Save Draft'}</span>
        </button>
      </div>

      <div className="rocket-grid">
        {ROCKETS.map((r) => {
          const selected = r.id === selectedRocketId;
          const fitsMass = wetMassKg <= r.capacityKg;
          const loadPct = Math.min(100, (wetMassKg / r.capacityKg) * 100);

          return (
            <button
              key={r.id}
              type="button"
              className={`rocket-card tile-lift ${selected ? 'card--selected' : ''} ${
                !fitsMass ? 'card--overlimit' : ''
              }`}
              onClick={() => onSelectRocket(r.id)}
              aria-pressed={selected}
            >
              <div className="rocket-card-inner">
                <div className="rocket-art">
                  <RocketIllustration rocketId={r.id} active={selected} />
                </div>
                <div className="rocket-body">
                  <div className="option-card-head">
                    <h3 className="option-title">{r.name}</h3>
                    {!fitsMass && (
                      <span className="too-small-tag font-mono">Too small</span>
                    )}
                  </div>

                  <div className="capacity-meter">
                    <div className="capacity-meter-top font-mono tabular-nums">
                      <span>
                        {Math.round(wetMassKg)} / {r.capacityKg} kg
                      </span>
                      <span className={fitsMass ? 'text-ok' : 'text-fail'}>
                        {Math.round(loadPct)}% full
                      </span>
                    </div>
                    <div className="capacity-track" aria-hidden="true">
                      <div
                        className={`capacity-fill ${
                          !fitsMass ? 'fill-fail' : loadPct > 88 ? 'fill-warn' : 'fill-ok'
                        }`}
                        style={{ width: `${loadPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">{r.capacityKg} kg max</span>
                    <span className="stat-chip text-amber">${r.costM}M</span>
                    <span className="stat-chip text-cyan">
                      {Math.round(r.reliability * 100)}% reliable
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="step-footer-actions">
        <button type="button" className="btn-secondary btn-pill" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <button type="button" className="btn-launch btn-lg btn-pill btn-pulse" onClick={onNext}>
          <span>Review</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
};

import React, { useEffect } from 'react';
import type { MissionId, SpacecraftConfig } from '../../data/missionData';
import type { EngineeringMetrics } from '../../engine/physics';
import type { SpacecraftTab } from './StepSpacecraft';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  X,
} from 'lucide-react';

export interface MissionProTip {
  id: string;
  subsystem: SpacecraftTab;
  subsystemLabel: string;
  title: string;
  fixNote: string;
  evaluate: (metrics: EngineeringMetrics, config: SpacecraftConfig) => 'issue' | 'good' | 'tip';
}

export const MISSION_PRO_TIPS: Record<MissionId, MissionProTip[]> = {
  lunar: [
    {
      id: 'lunar-power',
      subsystem: 'power',
      subsystemLabel: 'Power',
      title: 'Use Solar (100% Sun)',
      fixNote: 'Solar 3 m² or 8 m² saves $85M+ vs RTGs.',
      evaluate: (metrics) =>
        !metrics.powerPasses || metrics.parts.power.kind === 'rtg' ? 'issue' : 'good',
    },
    {
      id: 'lunar-instruments',
      subsystem: 'instruments',
      subsystemLabel: 'Sensors',
      title: 'Neutron + Altimeter + Camera',
      fixNote: 'Pick top-pip Lunar sensors inside 50 kg.',
      evaluate: (metrics) =>
        metrics.instrumentScoreFraction < 0.85 ? 'issue' : 'good',
    },
    {
      id: 'lunar-protection',
      subsystem: 'protection',
      subsystemLabel: 'Shields',
      title: 'Standard Shield Enough',
      fixNote: '1x radiation needs only Standard ($10M).',
      evaluate: (metrics) =>
        metrics.parts.shielding.id === 'vault' ? 'issue' : 'good',
    },
  ],
  mars: [
    {
      id: 'mars-antenna',
      subsystem: 'antenna',
      subsystemLabel: 'Dish',
      title: 'Medium Dish for 1.5 AU',
      fixNote: 'Small dish strands data at 1.5 AU.',
      evaluate: (metrics) => (metrics.dataReturnedFraction < 0.85 ? 'issue' : 'good'),
    },
    {
      id: 'mars-power',
      subsystem: 'power',
      subsystemLabel: 'Power',
      title: '43% Sunlight at Mars',
      fixNote: 'Use Solar 8 m² (Chem) or 18 m² (Ion).',
      evaluate: (metrics) =>
        !metrics.powerPasses || !metrics.ionPowerPasses ? 'issue' : 'good',
    },
    {
      id: 'mars-instruments',
      subsystem: 'instruments',
      subsystemLabel: 'Sensors',
      title: 'Spectrometer + Camera + Thermal',
      fixNote: 'Top Mars sensors hit 90%+ science.',
      evaluate: (metrics) =>
        metrics.instrumentScoreFraction < 0.85 ? 'issue' : 'good',
    },
  ],
  asteroid: [
    {
      id: 'asteroid-sampler',
      subsystem: 'instruments',
      subsystemLabel: 'Sensors',
      title: 'Pack the Sampler (60 kg)',
      fixNote: 'Missing Sampler cuts science to 40%.',
      evaluate: (_metrics, config) =>
        !config.instruments.includes('sampler') ? 'issue' : 'good',
    },
    {
      id: 'asteroid-propulsion',
      subsystem: 'propulsion',
      subsystemLabel: 'Engine',
      title: 'Ion Slashes Fuel Mass',
      fixNote: 'Ion + 18 m² Solar hits 5600 m/s lightly.',
      evaluate: (metrics) =>
        metrics.deltaVMargin < 150 ||
        (metrics.parts.propulsion.id === 'chemical' && metrics.wetMassKg > 3000)
          ? 'issue'
          : metrics.parts.propulsion.id === 'ion'
            ? 'good'
            : 'tip',
    },
    {
      id: 'asteroid-power',
      subsystem: 'power',
      subsystemLabel: 'Power',
      title: '18 m² Solar Runs Ion',
      fixNote: '55% sun × 2700 W clears 700 W + bus.',
      evaluate: (metrics) =>
        !metrics.powerPasses || !metrics.ionPowerPasses ? 'issue' : 'good',
    },
  ],
  europa: [
    {
      id: 'europa-power',
      subsystem: 'power',
      subsystemLabel: 'Power',
      title: 'RTGs Required (3.7% Sun)',
      fixNote: 'Solar dies at 5.2 AU. Mount RTG ×2/×3.',
      evaluate: (metrics) =>
        metrics.parts.power.kind === 'solar' || !metrics.powerPasses ? 'issue' : 'good',
    },
    {
      id: 'europa-protection',
      subsystem: 'protection',
      subsystemLabel: 'Shields',
      title: 'Vault + Full Backups',
      fixNote: '6x radiation destroys unshielded craft.',
      evaluate: (metrics) =>
        metrics.parts.shielding.id !== 'vault' ? 'issue' : 'good',
    },
    {
      id: 'europa-antenna',
      subsystem: 'antenna',
      subsystemLabel: 'Dish',
      title: 'Large 3m Dish for 5.2 AU',
      fixNote: 'Large dish beats 27x signal loss.',
      evaluate: (metrics) => (metrics.dataReturnedFraction < 0.85 ? 'issue' : 'good'),
    },
  ],
};

interface ProTipOverlayProps {
  open: boolean;
  config: SpacecraftConfig;
  metrics: EngineeringMetrics;
  onClose: () => void;
  onJumpToTab: (tab: SpacecraftTab) => void;
}

export const ProTipOverlay: React.FC<ProTipOverlayProps> = ({
  open,
  config,
  metrics,
  onClose,
  onJumpToTab,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const { parts } = metrics;
  const rawTips = MISSION_PRO_TIPS[parts.mission.id] ?? [];

  const evaluatedTips = rawTips
    .map((tip) => ({
      ...tip,
      status: tip.evaluate(metrics, config),
    }))
    .sort((a, b) => {
      const rank = { issue: 0, tip: 1, good: 2 };
      return rank[a.status] - rank[b.status];
    });

  const issueCount = evaluatedTips.filter((t) => t.status === 'issue').length;

  return (
    <div
      className="protip-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="protip-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="protip-overlay-title"
      >
        <div className="protip-modal-header">
          <div>
            <p className="protip-kicker font-mono">{parts.mission.name}</p>
            <h3 id="protip-overlay-title" className="protip-title">
              <Lightbulb size={18} className="text-amber" aria-hidden="true" />
              <span>Target Pro-Tips</span>
            </h3>
          </div>
          <button
            type="button"
            className="protip-close-btn btn-pill"
            onClick={onClose}
            aria-label="Close Pro-Tips"
          >
            <X size={18} />
          </button>
        </div>

        <div className="protip-list">
          {evaluatedTips.map((tip) => (
            <article key={tip.id} className={`protip-card protip-card--${tip.status}`}>
              <div className="protip-card-top">
                <span
                  className={`font-mono ${
                    tip.status === 'issue'
                      ? 'text-warn'
                      : tip.status === 'good'
                        ? 'text-ok'
                        : 'text-cyan'
                  }`}
                >
                  {tip.status === 'issue' ? 'Watch out' : tip.status === 'good' ? 'Ready' : 'Tip'}
                </span>
                <button
                  type="button"
                  className="protip-jump-btn btn-pill"
                  onClick={() => onJumpToTab(tip.subsystem)}
                >
                  <span>{tip.subsystemLabel}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
              <h4 className="protip-card-title">{tip.title}</h4>
              <p className="protip-opt">{tip.fixNote}</p>
            </article>
          ))}
        </div>

        <div className="protip-modal-footer">
          <div className="protip-footer-status font-mono">
            {issueCount > 0 ? (
              <span className="protip-status-pair text-warn">
                <AlertTriangle size={15} />
                <span>{issueCount} risks</span>
              </span>
            ) : (
              <span className="protip-status-pair text-ok">
                <CheckCircle2 size={15} />
                <span>All clear</span>
              </span>
            )}
          </div>
          <button type="button" className="btn-primary btn-pill" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

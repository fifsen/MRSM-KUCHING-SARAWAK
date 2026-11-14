import React from 'react';
import {
  DIFFICULTIES,
  MISSIONS,
  type DifficultyId,
  type MissionId,
} from '../../data/missionData';
import type { BestScoresMap } from '../../engine/physics';
import { TargetIllustration } from '../TargetIllustration';
import { ArrowRight, Rocket, Trophy } from 'lucide-react';

interface StepMissionProps {
  selectedDifficulty: DifficultyId;
  selectedMissionId: MissionId;
  bestScores: BestScoresMap;
  onSelectDifficulty: (id: DifficultyId) => void;
  onSelectMission: (id: MissionId) => void;
  onNext: () => void;
}

export const StepMission: React.FC<StepMissionProps> = ({
  selectedDifficulty,
  selectedMissionId,
  bestScores,
  onSelectDifficulty,
  onSelectMission,
  onNext,
}) => {
  const activeDifficulty =
    DIFFICULTIES.find((d) => d.id === selectedDifficulty) ?? DIFFICULTIES[1];

  return (
    <section className="step-panel" aria-labelledby="step-mission-title">
      <div className="step-header">
        <div>
          <p className="step-kicker font-mono">Step 1 · Target</p>
          <h2 id="step-mission-title" className="step-title">
            Choose Target
          </h2>
        </div>

        <div className="substep-switcher" role="group" aria-label="Difficulty mode">
          {DIFFICULTIES.map((d) => {
            const active = d.id === selectedDifficulty;
            return (
              <button
                key={d.id}
                type="button"
                className={`substep-btn ${active ? 'substep-btn--active' : ''}`}
                onClick={() => onSelectDifficulty(d.id)}
                aria-pressed={active}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mission-grid">
        {MISSIONS.map((m) => {
          const isSelected = m.id === selectedMissionId;
          const effectiveCap = Math.round(m.budgetCap * activeDifficulty.budgetMultiplier);
          const best = bestScores[m.id];

          return (
            <button
              key={m.id}
              type="button"
              className={`mission-card tile-lift ${isSelected ? 'card--selected' : ''}`}
              onClick={() => onSelectMission(m.id)}
              aria-pressed={isSelected}
            >
              <div className="mission-card-top">
                <TargetIllustration missionId={m.id} size={62} />
                <div className="mission-card-head">
                  <div className="mission-rating-row">
                    <span
                      className="rocket-rating"
                      aria-label={`Difficulty ${m.difficultyStars} of 4`}
                    >
                      {[1, 2, 3, 4].map((idx) => (
                        <Rocket
                          key={idx}
                          size={14}
                          className={
                            idx <= m.difficultyStars ? 'rating-icon--on' : 'rating-icon--off'
                          }
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    {best && (
                      <span className="best-chip font-mono">
                        <Trophy size={11} aria-hidden="true" />
                        {best.grade} · {best.score}
                      </span>
                    )}
                  </div>
                  <h3 className="mission-name">{m.name}</h3>
                  <div className="mission-subchips font-mono">
                    <span>{Math.round(m.sunlightFraction * 100)}% sun</span>
                    <span>{m.missionWindow} mo</span>
                    {m.noteChip && <span className="text-amber">{m.noteChip}</span>}
                  </div>
                </div>
              </div>

              <div className="stat-chips font-mono tabular-nums">
                <div className="stat-chip">
                  <span className="chip-k">Delta-v</span>
                  <span className="chip-v">{m.deltaVReq} m/s</span>
                </div>
                <div className="stat-chip">
                  <span className="chip-k">Distance</span>
                  <span className="chip-v">{m.distanceAU} AU</span>
                </div>
                <div className="stat-chip">
                  <span className="chip-k">Radiation</span>
                  <span className="chip-v">{m.radiationLevel}x</span>
                </div>
                <div className="stat-chip">
                  <span className="chip-k">Budget</span>
                  <span className="chip-v text-amber">${effectiveCap}M</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="step-footer-actions">
        <span />
        <button type="button" className="btn-launch btn-lg btn-pill btn-pulse" onClick={onNext}>
          <span>Build Craft</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
};

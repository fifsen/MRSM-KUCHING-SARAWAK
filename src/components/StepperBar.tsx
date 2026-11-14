import React from 'react';
import type { StepId } from '../data/missionData';
import {
  Check,
  Compass,
  Wrench,
  Rocket,
  ClipboardCheck,
  Navigation,
  Award,
} from 'lucide-react';

interface StepperBarProps {
  currentStep: StepId;
  maxUnlockedStep: StepId;
  flightActive: boolean;
  flightFinished: boolean;
  onSelectStep: (step: StepId) => void;
}

const STEPS: { id: StepId; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 1, label: 'Target', Icon: Compass },
  { id: 2, label: 'Build', Icon: Wrench },
  { id: 3, label: 'Rocket', Icon: Rocket },
  { id: 4, label: 'Review', Icon: ClipboardCheck },
  { id: 5, label: 'Flight', Icon: Navigation },
  { id: 6, label: 'Result', Icon: Award },
];

export const StepperBar: React.FC<StepperBarProps> = ({
  currentStep,
  maxUnlockedStep,
  flightActive,
  flightFinished,
  onSelectStep,
}) => {
  return (
    <nav className="stepper-bar" aria-label="Mission steps">
      <ol className="stepper-list">
        {STEPS.map(({ id, label, Icon }) => {
          const isCurrent = currentStep === id;
          const lockedDuringFlight = flightActive && !flightFinished && id < 5;
          const isUnlocked = id <= maxUnlockedStep && !lockedDuringFlight;
          const isCompleted = id < currentStep || (id === 5 && flightFinished);

          return (
            <li key={id} className="stepper-item">
              <button
                type="button"
                className={`stepper-btn ${isCurrent ? 'stepper-btn--active' : ''} ${
                  isCompleted ? 'stepper-btn--done' : ''
                }`}
                disabled={!isUnlocked}
                onClick={() => onSelectStep(id)}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="stepper-num font-mono">
                  {isCompleted && !isCurrent ? <Check size={13} strokeWidth={2.8} /> : <Icon size={13} />}
                </span>
                <span className="stepper-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

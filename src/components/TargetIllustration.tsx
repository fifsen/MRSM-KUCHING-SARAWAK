import React from 'react';
import type { MissionId, RocketId } from '../data/missionData';

export const TargetIllustration: React.FC<{ missionId: MissionId; size?: number }> = ({
  missionId,
  size = 64,
}) => {
  switch (missionId) {
    case 'lunar':
      return (
        <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
          <defs>
            <radialGradient id="moon-sphere" cx="35%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="55%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#1e293b" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="24" fill="url(#moon-sphere)" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="31" cy="30" r="4.5" fill="rgba(15,23,42,0.28)" stroke="rgba(226,232,240,0.4)" strokeWidth="0.8" />
          <circle cx="47" cy="44" r="6" fill="rgba(15,23,42,0.32)" stroke="rgba(226,232,240,0.35)" strokeWidth="0.8" />
          <circle cx="34" cy="51" r="3" fill="rgba(15,23,42,0.28)" />
          <ellipse cx="40" cy="40" rx="13" ry="33" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 3" />
          <circle cx="40" cy="7" r="2.6" fill="#fbbf24" />
        </svg>
      );
    case 'mars':
      return (
        <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
          <defs>
            <radialGradient id="mars-sphere" cx="35%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="55%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#431407" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="24" fill="url(#mars-sphere)" />
          <path d="M 29 19 Q 40 23 51 19" fill="none" stroke="#e0f2fe" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 23 41 Q 40 36 57 44" fill="none" stroke="rgba(67,20,7,0.55)" strokeWidth="2" />
          <ellipse cx="40" cy="40" rx="34" ry="12" transform="rotate(-18 40 40)" fill="none" stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="4 3" />
          <circle cx="67" cy="27" r="2.5" fill="#7dd3fc" />
        </svg>
      );
    case 'asteroid':
      return (
        <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
          <defs>
            <radialGradient id="ast-body" cx="38%" cy="34%" r="66%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="60%" stopColor="#475569" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>
          <path
            d="M 23 28 L 36 18 L 54 22 L 62 38 L 55 56 L 38 61 L 21 52 L 17 38 Z"
            fill="url(#ast-body)"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <circle cx="35" cy="34" r="4.5" fill="rgba(15,23,42,0.45)" />
          <circle cx="49" cy="45" r="3" fill="rgba(15,23,42,0.45)" />
          <path d="M 52 12 Q 62 24 52 33" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeDasharray="3 2" />
          <circle cx="52" cy="12" r="2.6" fill="#fbbf24" />
        </svg>
      );
    case 'europa':
      return (
        <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
          <defs>
            <radialGradient id="eur-sphere" cx="35%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="55%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0c4a6e" />
            </radialGradient>
          </defs>
          <ellipse cx="40" cy="40" rx="35" ry="18" fill="none" stroke="#ef4444" strokeOpacity="0.55" strokeWidth="1.3" strokeDasharray="2 3" />
          <circle cx="40" cy="40" r="23" fill="url(#eur-sphere)" />
          <path d="M 20 33 Q 40 39 59 29" fill="none" stroke="#b45309" strokeOpacity="0.8" strokeWidth="1.3" />
          <path d="M 22 48 Q 42 40 57 51" fill="none" stroke="#b45309" strokeOpacity="0.65" strokeWidth="1.2" />
          <path d="M 32 19 Q 38 42 30 61" fill="none" stroke="#0284c7" strokeOpacity="0.65" strokeWidth="1.1" />
          <circle cx="40" cy="11" r="2.3" fill="#fbbf24" />
        </svg>
      );
  }
};

export const RocketIllustration: React.FC<{ rocketId: RocketId; active?: boolean }> = ({
  rocketId,
  active = false,
}) => {
  const hullFill = active ? '#e2e8f0' : '#94a3b8';
  const stroke = active ? '#fbbf24' : '#cbd5e1';
  const accent = active ? '#38bdf8' : '#64748b';

  return (
    <svg width="56" height="86" viewBox="0 0 56 86" aria-hidden="true">
      <circle cx="9" cy="14" r="0.9" fill="#e2e8f0" opacity="0.65" />
      <circle cx="47" cy="18" r="1.1" fill="#bae6fd" opacity="0.6" />
      <circle cx="12" cy="48" r="0.8" fill="#fef3c7" opacity="0.5" />
      <circle cx="46" cy="54" r="0.9" fill="#e2e8f0" opacity="0.55" />
      {active && <ellipse cx="28" cy="78" rx="14" ry="5" fill="#f59e0b" fillOpacity="0.28" />}
      {rocketId === 'light' && (
        <g>
          <path d="M 28 18 L 33 30 L 33 70 L 23 70 L 23 30 Z" fill={hullFill} stroke={stroke} strokeWidth="1.2" />
          <polygon points="23,62 18,72 23,70" fill={accent} />
          <polygon points="33,62 38,72 33,70" fill={accent} />
          <line x1="23" y1="42" x2="33" y2="42" stroke="#0f172a" strokeWidth="1.4" />
          {active && <polygon points="25,70 31,70 28,83" fill="#fbbf24" fillOpacity="0.85" />}
        </g>
      )}
      {rocketId === 'medium' && (
        <g>
          <path d="M 28 10 L 35 24 L 35 72 L 21 72 L 21 24 Z" fill={hullFill} stroke={stroke} strokeWidth="1.2" />
          <polygon points="21,60 14,74 21,72" fill={accent} />
          <polygon points="35,60 42,74 35,72" fill={accent} />
          <line x1="21" y1="36" x2="35" y2="36" stroke="#0f172a" strokeWidth="1.5" />
          {active && <polygon points="24,72 32,72 28,84" fill="#fbbf24" fillOpacity="0.85" />}
        </g>
      )}
      {rocketId === 'heavy' && (
        <g>
          <path d="M 28 8 L 34 22 L 34 74 L 22 74 L 22 22 Z" fill={hullFill} stroke={stroke} strokeWidth="1.2" />
          <path d="M 16 28 L 20 34 L 20 74 L 13 74 L 13 34 Z" fill="#64748b" stroke={accent} strokeWidth="1" />
          <path d="M 40 28 L 43 34 L 43 74 L 36 74 L 36 34 Z" fill="#64748b" stroke={accent} strokeWidth="1" />
          <line x1="22" y1="38" x2="34" y2="38" stroke="#0f172a" strokeWidth="1.4" />
          {active && <polygon points="24,74 32,74 28,84" fill="#fbbf24" fillOpacity="0.85" />}
        </g>
      )}
      {rocketId === 'super_heavy' && (
        <g>
          <path d="M 28 4 L 37 19 L 37 74 L 19 74 L 19 19 Z" fill={hullFill} stroke={stroke} strokeWidth="1.3" />
          <path d="M 12 26 L 17 34 L 17 75 L 9 75 L 9 34 Z" fill="#f59e0b" fillOpacity="0.82" stroke={stroke} strokeWidth="1" />
          <path d="M 44 26 L 47 34 L 47 75 L 39 75 L 39 34 Z" fill="#f59e0b" fillOpacity="0.82" stroke={stroke} strokeWidth="1" />
          <line x1="19" y1="32" x2="37" y2="32" stroke="#0f172a" strokeWidth="1.5" />
          <line x1="19" y1="52" x2="37" y2="52" stroke="#0f172a" strokeWidth="1.5" />
          {active && <polygon points="23,74 33,74 28,85" fill="#fbbf24" fillOpacity="0.9" />}
        </g>
      )}
      <line x1="6" y1="77" x2="50" y2="77" stroke="#fbbf24" strokeOpacity="0.45" strokeWidth="1.4" />
    </svg>
  );
};

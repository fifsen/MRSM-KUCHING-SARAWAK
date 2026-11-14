import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AUTO_FUEL_RESERVE_DV,
  DEFAULT_CONFIG,
  DIFFICULTIES,
  MISSIONS,
  type DifficultyId,
  type MissionId,
  type RocketId,
  type SpacecraftConfig,
  type StepId,
} from './data/missionData';
import {
  buildFlightPhases,
  calculateMetrics,
  computeDebrief,
  createPrelaunchTelemetryPoint,
  findPropellantForTargetDeltaV,
  loadBestScores,
  loadSavedDraft,
  pickEventsForFlight,
  resolveFlightEventChoice,
  saveBestScore,
  saveCraftDraft,
  stepFlightPhase,
  type BestScoresMap,
  type EngineeringMetrics,
  type FlightState,
  type SavedDraft,
} from './engine/physics';
import { soundEngine } from './audio/soundEngine';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import { TelemetryStrip } from './components/TelemetryStrip';
import { StepperBar } from './components/StepperBar';
import { SpacecraftSchematic } from './components/SpacecraftSchematic';
import { StepMission } from './components/steps/StepMission';
import { StepSpacecraft, type SpacecraftTab } from './components/steps/StepSpacecraft';
import { StepLaunch } from './components/steps/StepLaunch';
import { StepReadiness } from './components/steps/StepReadiness';
import { StepFlight } from './components/steps/StepFlight';
import { StepDebrief } from './components/steps/StepDebrief';
import { MissionChatbot } from './components/MissionChatbot';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutAccount } from './firebase';
import {
  saveCloudProgress,
  subscribeUserProgress,
  syncUserProfile,
} from './services/missionSync';
import heroPlanetImg from './assets/images/hero_planet_orbit_1794644229129.jpg';
import marsPlanetImg from './assets/images/bg_planet_mars_1794644448498.jpg';
import asteroidPlanetImg from './assets/images/bg_planet_asteroid_1794644449097.jpg';
import europaPlanetImg from './assets/images/bg_planet_europa_1794644449316.jpg';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  FolderOpen,
  LogIn,
  LogOut,
  Music,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';

const PLANET_BACKGROUNDS: { id: MissionId; label: string; src: string }[] = [
  { id: 'lunar', label: 'Moon', src: heroPlanetImg },
  { id: 'mars', label: 'Mars', src: marsPlanetImg },
  { id: 'asteroid', label: 'Asteroid', src: asteroidPlanetImg },
  { id: 'europa', label: 'Europa', src: europaPlanetImg },
];

type ScreenMode = 'TITLE' | 'PLAYING';

const SEED_PRESETS = ['APOLLO-42', 'VOYAGER-7', 'CASSINI-9', 'ARTEMIS-11', 'ROSETTA-3', 'JUNO-88'];

function makeRandomSeed(): string {
  const prefix = ['ORBIT', 'DELTA', 'KEPLER', 'EUROPA', 'SOLAR', 'APEX'][
    Math.floor(Math.random() * 6)
  ];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

function createInitialFlightState(metrics: EngineeringMetrics): FlightState {
  return {
    phaseIndex: 0,
    health: 100,
    deltaVSpare: Math.round(metrics.deltaVMargin),
    extraCostM: 0,
    downlinkMultiplier: 1.0,
    powerMultiplier: 1.0,
    scienceBonusMultiplier: 1.0,
    lostInstrumentIds: [],
    effectiveScienceMonths: metrics.scienceMonths,
    scienceCollectedShares: 0,
    dataDeliveredGb: 0,
    telemetryHistory: [createPrelaunchTelemetryPoint(metrics)],
    pendingEvent: null,
    logs: [],
    finished: false,
    survived: true,
  };
}

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('TITLE');
  const [step, setStep] = useState<StepId>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<StepId>(4);
  const [config, setConfig] = useState<SpacecraftConfig>(() => {
    const initial = { ...DEFAULT_CONFIG };
    if (initial.autoFuel) {
      initial.propellantKg = findPropellantForTargetDeltaV(initial, AUTO_FUEL_RESERVE_DV);
    }
    return initial;
  });
  const [spacecraftTab, setSpacecraftTab] = useState<SpacecraftTab>('bus');
  const [highlightSubsystem, setHighlightSubsystem] = useState<string | null>(null);
  const [seed, setSeed] = useState<string>(SEED_PRESETS[0]);
  const [musicOn, setMusicOn] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(soundEngine.isMuted());
  const [mobileSchematicOpen, setMobileSchematicOpen] = useState<boolean>(false);
  const [planetImgErrors, setPlanetImgErrors] = useState<Partial<Record<MissionId, boolean>>>({});
  const [bestScores, setBestScores] = useState<BestScoresMap>(() => loadBestScores());
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(() => loadSavedDraft());
  const [draftSaved, setDraftSaved] = useState<boolean>(false);
  const [cruiseSpeed, setCruiseSpeed] = useState<number>(1);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);

  const metrics = useMemo(() => calculateMetrics(config), [config]);
  const phases = useMemo(() => buildFlightPhases(metrics), [metrics]);
  const eventMap = useMemo(() => pickEventsForFlight(seed, metrics), [seed, metrics]);

  const [flight, setFlight] = useState<FlightState>(() => createInitialFlightState(metrics));

  const debrief = useMemo(() => computeDebrief(metrics, flight), [metrics, flight]);

  // Sync music mood with current game stage
  useEffect(() => {
    if (screen === 'TITLE') {
      soundEngine.setMood('title');
    } else if (step === 5) {
      soundEngine.setMood('flight');
    } else if (step === 6) {
      soundEngine.setMood('debrief');
    } else {
      soundEngine.setMood('design');
    }
  }, [screen, step]);

  // Reset starfield speed outside active flight
  useEffect(() => {
    if (screen !== 'PLAYING' || step !== 5) {
      setCruiseSpeed(1);
    }
  }, [screen, step]);

  // Firebase Auth listener + cloud progress sync (verified users only)
  useEffect(() => {
    let unsubProgress: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      if (unsubProgress) {
        unsubProgress();
        unsubProgress = undefined;
      }
      setUser(nextUser);
      setAvatarFailed(false);
      setAuthReady(true);

      if (nextUser && nextUser.emailVerified) {
        void syncUserProfile(nextUser)
          .then(() => {
            unsubProgress = subscribeUserProgress(nextUser.uid, (cloud) => {
              if (cloud.bestScores) {
                let merged = loadBestScores();
                for (const [mId, entry] of Object.entries(cloud.bestScores)) {
                  if (entry) {
                    merged = saveBestScore(mId, entry.score, entry.grade);
                  }
                }
                setBestScores(merged);
              }
              if (cloud.draft) {
                setSavedDraft((prev) => {
                  if (!prev || cloud.draft!.savedAt > prev.savedAt) {
                    return cloud.draft!;
                  }
                  return prev;
                });
              }
            });
          })
          .catch((err) => {
            console.error('Profile sync failed:', err);
          });
      }
    });

    return () => {
      unsubAuth();
      if (unsubProgress) unsubProgress();
    };
  }, []);

  const handleSignIn = async () => {
    soundEngine.playTick();
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithGoogle();
      soundEngine.playSuccess();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Sign-in cancelled.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Popup blocked. Allow popups to sign in.');
      } else {
        setAuthError('Sign-in failed. Try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    soundEngine.playTick();
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signOutAccount();
    } catch {
      setAuthError('Sign-out failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStartMission = useCallback(() => {
    if (!soundEngine.isMuted()) {
      soundEngine.startMusic();
      setMusicOn(true);
    }
    soundEngine.playSuccess();
    setScreen('PLAYING');
    setStep(1);
    setMaxUnlockedStep(4);
  }, []);

  // Title screen Enter/Space shortcut
  useEffect(() => {
    if (screen !== 'TITLE') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStartMission();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, handleStartMission]);

  const handleToggleMusic = () => {
    const active = soundEngine.toggleMusic();
    setMusicOn(active);
  };

  const handleToggleMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  };

  const handleUpdateConfig = (patch: Partial<SpacecraftConfig>) => {
    soundEngine.playSelect();
    setConfig((prev) => {
      const next: SpacecraftConfig = { ...prev, ...patch };
      if (next.autoFuel && patch.propellantKg === undefined) {
        next.propellantKg = findPropellantForTargetDeltaV(next, AUTO_FUEL_RESERVE_DV);
      }
      return next;
    });
    setDraftSaved(false);
    if (maxUnlockedStep > 4) setMaxUnlockedStep(4);
  };

  const handleToggleAutoFuel = () => {
    soundEngine.playSelect();
    setConfig((prev) => {
      const nextAuto = !prev.autoFuel;
      const next: SpacecraftConfig = { ...prev, autoFuel: nextAuto };
      if (nextAuto) {
        next.propellantKg = findPropellantForTargetDeltaV(next, AUTO_FUEL_RESERVE_DV);
      }
      return next;
    });
    setDraftSaved(false);
    if (maxUnlockedStep > 4) setMaxUnlockedStep(4);
  };

  const handleSelectDifficulty = (difficulty: DifficultyId) => {
    soundEngine.playSelect();
    setConfig((prev) => ({ ...prev, difficulty }));
    setDraftSaved(false);
    if (maxUnlockedStep > 4) setMaxUnlockedStep(4);
  };

  const handleSelectMission = (missionId: MissionId) => {
    soundEngine.playSelect();
    setDraftSaved(false);
    if (maxUnlockedStep > 4) setMaxUnlockedStep(4);

    const smartDefaults: Record<MissionId, Partial<SpacecraftConfig>> = {
      lunar: {
        missionId: 'lunar',
        bus: 'small',
        power: 'solar_3',
        propulsion: 'chemical',
        antenna: 'small',
        shielding: 'standard',
        redundancy: 'cross',
        instruments: ['neutron', 'altimeter', 'thermal'],
        rocket: 'medium',
        autoFuel: true,
      },
      mars: {
        missionId: 'mars',
        bus: 'medium',
        power: 'solar_8',
        propulsion: 'chemical',
        antenna: 'medium',
        shielding: 'standard',
        redundancy: 'cross',
        instruments: ['spectrometer', 'camera', 'thermal', 'altimeter'],
        rocket: 'heavy',
        autoFuel: true,
      },
      asteroid: {
        missionId: 'asteroid',
        bus: 'medium',
        power: 'solar_18',
        propulsion: 'ion',
        antenna: 'medium',
        shielding: 'standard',
        redundancy: 'cross',
        instruments: ['sampler', 'spectrometer', 'camera'],
        rocket: 'medium',
        autoFuel: true,
      },
      europa: {
        missionId: 'europa',
        bus: 'large',
        power: 'rtg_3',
        propulsion: 'chemical',
        antenna: 'large',
        shielding: 'vault',
        redundancy: 'full',
        instruments: ['radar', 'magnetometer', 'plasma', 'camera'],
        rocket: 'super_heavy',
        autoFuel: true,
      },
    };

    setConfig((prev) => {
      const next: SpacecraftConfig = { ...prev, ...smartDefaults[missionId] };
      next.propellantKg = findPropellantForTargetDeltaV(next, AUTO_FUEL_RESERVE_DV);
      return next;
    });
  };

  const handleSelectRocket = (rocket: RocketId) => {
    soundEngine.playSelect();
    setConfig((prev) => ({ ...prev, rocket }));
    setDraftSaved(false);
    if (maxUnlockedStep > 4) setMaxUnlockedStep(4);
  };

  const handleSaveDraft = () => {
    soundEngine.playSuccess();
    const stored = saveCraftDraft(config, step);
    setSavedDraft(stored);
    setDraftSaved(true);
    if (user && user.emailVerified) {
      void saveCloudProgress(user.uid, bestScores, stored).catch((err) =>
        console.error('Cloud draft sync failed:', err),
      );
    }
  };

  const handleLoadDraft = () => {
    const draft = savedDraft ?? loadSavedDraft();
    if (!draft) return;
    if (!soundEngine.isMuted()) {
      soundEngine.startMusic();
      setMusicOn(true);
    }
    soundEngine.playSuccess();
    setConfig(draft.config);
    setDraftSaved(false);
    setScreen('PLAYING');
    setMaxUnlockedStep(4);
    setStep(draft.step);
  };

  const handleGoToStep = (targetStep: StepId) => {
    soundEngine.playTick();
    setStep(targetStep);
  };

  const handleJumpToFix = (targetStep: 1 | 2 | 3, tab?: SpacecraftTab) => {
    soundEngine.playTick();
    if (tab) {
      setSpacecraftTab(tab);
      setHighlightSubsystem(tab);
    }
    setStep(targetStep);
  };

  const handleLaunchMission = () => {
    if (!metrics.allReady) return;
    soundEngine.playTick();
    setFlight(createInitialFlightState(metrics));
    setMaxUnlockedStep(5);
    setStep(5);
  };

  const handleAdvancePhase = () => {
    const next = stepFlightPhase(flight, metrics, phases, eventMap, seed);
    if (next.finished && !next.survived) {
      soundEngine.playExplosion();
    } else if (next.pendingEvent) {
      soundEngine.playAlert();
    } else if (next.finished && next.survived) {
      soundEngine.playSuccess();
    } else {
      soundEngine.playTick();
    }
    setFlight(next);
    if (next.finished) {
      setMaxUnlockedStep(6);
    }
  };

  const handleResolveEvent = (optionId: string) => {
    const next = resolveFlightEventChoice(flight, optionId, metrics, phases, seed);
    const lastLog = next.logs[next.logs.length - 1];
    if (next.finished && !next.survived) {
      soundEngine.playExplosion();
    } else if (lastLog?.rollSuccess) {
      soundEngine.playSuccess();
    } else {
      soundEngine.playAlert();
    }
    setFlight(next);
    if (next.finished) {
      setMaxUnlockedStep(6);
    }
  };

  const handleFinishToDebrief = () => {
    soundEngine.playSuccess();
    const updated = saveBestScore(metrics.parts.mission.id, debrief.totalScore, debrief.grade);
    setBestScores(updated);
    if (user && user.emailVerified) {
      void saveCloudProgress(user.uid, updated, savedDraft).catch((err) =>
        console.error('Cloud score sync failed:', err),
      );
    }
    setMaxUnlockedStep(6);
    setStep(6);
  };

  const handleTryAgainSameSeed = () => {
    soundEngine.playTick();
    setFlight(createInitialFlightState(metrics));
    setMaxUnlockedStep(4);
    setStep(2);
  };

  const handleNewTarget = () => {
    soundEngine.playTick();
    setFlight(createInitialFlightState(metrics));
    setMaxUnlockedStep(4);
    setStep(1);
  };

  // ============================================================================
  // TITLE SCREEN
  // ============================================================================
  if (screen === 'TITLE') {
    const activePlanetId = config.missionId;
    const allFailed = Boolean(planetImgErrors[activePlanetId]);

    return (
      <div className="blueprint-app title-shell">
        <StarfieldCanvas speedMultiplier={1} />

        {/* Cross-fading planet backdrop */}
        <div className="title-bg-layer" aria-hidden="true">
          {PLANET_BACKGROUNDS.map((planet) => {
            const isActive = planet.id === activePlanetId;
            if (planetImgErrors[planet.id]) return null;
            return (
              <img
                key={planet.id}
                src={planet.src}
                alt=""
                referrerPolicy="no-referrer"
                className={`title-bg-img ${isActive ? 'title-bg-img--active' : ''}`}
                onError={() =>
                  setPlanetImgErrors((prev) => ({ ...prev, [planet.id]: true }))
                }
              />
            );
          })}

          {allFailed && (
            <div className="title-planet-fallback">
              <div className="title-planet-fallback-orb" />
            </div>
          )}

          {/* Animated orbital trajectory */}
          <svg
            className="title-bg-orbit-svg"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="titleOrbitGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
                <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.85" />
              </linearGradient>
              <radialGradient id="titleProbeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
              <path
                id="titleTransferArc"
                d="M 520 675 C 670 465, 890 305, 1140 278"
              />
            </defs>

            <ellipse
              cx="420"
              cy="475"
              rx="380"
              ry="255"
              transform="rotate(-14 420 475)"
              fill="none"
              stroke="rgba(125, 211, 252, 0.2)"
              strokeWidth="1.4"
              strokeDasharray="5 8"
            />

            <use
              href="#titleTransferArc"
              fill="none"
              stroke="url(#titleOrbitGrad)"
              strokeWidth="2.2"
              strokeDasharray="7 7"
            />

            <circle
              cx="1140"
              cy="278"
              r="46"
              fill="none"
              stroke="rgba(251, 191, 36, 0.55)"
              strokeWidth="1.5"
              className="title-beacon-ring"
            />

            <g className="title-probe-mover">
              <animateMotion dur="14s" repeatCount="indefinite" rotate="auto">
                <mpath href="#titleTransferArc" />
              </animateMotion>
              <circle r="18" fill="url(#titleProbeGlow)" />
              <rect x="-6" y="-13" width="12" height="5.5" rx="1" fill="#38bdf8" stroke="#bae6fd" strokeWidth="0.8" />
              <rect x="-6" y="7.5" width="12" height="5.5" rx="1" fill="#38bdf8" stroke="#bae6fd" strokeWidth="0.8" />
              <polygon points="9,0 -6,-5 -3.5,0 -6,5" fill="#fbbf24" stroke="#fef3c7" strokeWidth="0.9" />
            </g>
          </svg>

          <div className="title-bg-scrim" />
        </div>

        <div className="title-topbar">
          <div className="brand-lockup">
            <Compass size={18} className="text-cyan" />
            <span>Mission Architect</span>
          </div>
          <div className="title-topbar-right">
            {authReady && user && (
              <div className="auth-user-pill">
                {user.photoURL && !avatarFailed ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? 'User'}
                    referrerPolicy="no-referrer"
                    className="auth-avatar"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <span className="auth-avatar-fallback" aria-hidden="true">
                    <UserIcon size={13} />
                  </span>
                )}
                <span className="auth-name">{user.displayName ?? 'Pilot'}</span>
                <button
                  type="button"
                  className="auth-signout-btn"
                  onClick={() => void handleSignOut()}
                  disabled={authBusy}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
            {authReady && !user && (
              <button
                type="button"
                className="audio-btn btn-pill"
                onClick={() => void handleSignIn()}
                disabled={authBusy}
              >
                <LogIn size={15} />
                <span>{authBusy ? 'Signing in...' : 'Sign in'}</span>
              </button>
            )}
            <div className="audio-controls">
              <button
                type="button"
                className={`audio-btn btn-pill ${musicOn && !muted ? 'audio-btn--on' : ''}`}
                onClick={handleToggleMusic}
                aria-pressed={musicOn}
              >
                <Music size={15} />
                <span>Music: {musicOn ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                className={`audio-btn btn-pill ${!muted ? 'audio-btn--on' : ''}`}
                onClick={handleToggleMute}
                aria-pressed={muted}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span>{muted ? 'Muted' : 'Mute'}</span>
              </button>
            </div>
          </div>
        </div>

        <main className="title-stage">
          <div className="title-copy">
            <h1 className="title-headline">Mission Architect</h1>
            <p className="title-lead">Design. Launch. Fly.</p>

            <div className="title-difficulty-wrap" role="group" aria-label="Difficulty">
              <span className="title-diff-label font-mono">Difficulty</span>
              <div className="title-diff-segmented">
                {DIFFICULTIES.map((d) => {
                  const selected = config.difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className={`title-diff-pill-btn ${selected ? 'title-diff-pill-btn--active' : ''}`}
                      onClick={() => handleSelectDifficulty(d.id)}
                      aria-pressed={selected}
                    >
                      <span>{d.name}</span>
                      <span className="title-diff-cap font-mono tabular-nums">
                        {Math.round(d.budgetMultiplier * 100)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="title-actions">
              <div className="title-actions-row">
                <button
                  type="button"
                  className="btn-launch btn-xl btn-pill btn-pulse"
                  onClick={handleStartMission}
                >
                  <span>Start Mission</span>
                </button>
                {authReady && !user && (
                  <button
                    type="button"
                    className="btn-secondary btn-xl btn-pill btn-signin-google"
                    onClick={() => void handleSignIn()}
                    disabled={authBusy}
                  >
                    <LogIn size={18} />
                    <span>{authBusy ? 'Connecting...' : 'Google Sign in'}</span>
                  </button>
                )}
                {savedDraft && (
                  <button
                    type="button"
                    className="btn-secondary btn-xl btn-pill btn-load-draft"
                    onClick={handleLoadDraft}
                  >
                    <FolderOpen size={18} />
                    <span>Load Draft</span>
                    <span className="draft-chip font-mono">
                      {(MISSIONS.find((m) => m.id === savedDraft.config.missionId)?.name ?? 'Craft').split(' ')[0]} · S{savedDraft.step}
                    </span>
                  </button>
                )}
              </div>
              {authReady && user && (
                <p className="auth-signedin-note font-mono">
                  Signed in · {user.displayName ?? 'Flight Director'} · Cloud sync on
                </p>
              )}
              {authError && (
                <p className="auth-error-msg" role="alert">
                  {authError}
                </p>
              )}
            </div>
          </div>
        </main>

        {/* Bottom Planet Switcher */}
        <div className="title-planet-bar" role="group" aria-label="Planet">
          <span className="title-planet-bar-label font-mono">Planet</span>
          <div className="title-planet-switcher">
            {PLANET_BACKGROUNDS.map((planet) => {
              const selected = planet.id === config.missionId;
              return (
                <button
                  key={planet.id}
                  type="button"
                  className={`title-planet-btn ${selected ? 'title-planet-btn--active' : ''}`}
                  onClick={() => handleSelectMission(planet.id)}
                  aria-pressed={selected}
                >
                  {planet.label}
                </button>
              );
            })}
          </div>
        </div>

        <MissionChatbot metrics={metrics} screen={screen} step={step} />
      </div>
    );
  }

  // ============================================================================
  // MAIN 6-STEP GAME WORKSPACE
  // ============================================================================
  const flightActive = step === 5;
  const flightFinished = flight.finished;

  return (
    <div className="blueprint-app workspace-shell">
      <StarfieldCanvas speedMultiplier={cruiseSpeed} />

      {/* Subtle Deep-Space Planet Backdrop */}
      <div className="workspace-space-bg" aria-hidden="true">
        {PLANET_BACKGROUNDS.map((planet) => {
          const isActive = planet.id === config.missionId;
          if (planetImgErrors[planet.id]) return null;
          return (
            <img
              key={planet.id}
              src={planet.src}
              alt=""
              referrerPolicy="no-referrer"
              className={`workspace-bg-img ${isActive ? 'workspace-bg-img--active' : ''}`}
              onError={() =>
                setPlanetImgErrors((prev) => ({ ...prev, [planet.id]: true }))
              }
            />
          );
        })}
        <div className="workspace-space-scrim" />
      </div>

      <div className="workspace-foreground">
        {/* Compact Header */}
        <header className="app-header">
          <div className="header-inner">
            <button
              type="button"
              className="brand-lockup brand-btn"
              onClick={() => setScreen('TITLE')}
              title="Title Screen"
            >
              <Compass size={18} className="text-cyan" />
              <span>Mission Architect</span>
            </button>

            <div className="header-mission-pill font-mono">
              <span>
                {metrics.parts.mission.name} · {metrics.parts.difficulty.name}
              </span>
            </div>

            <div className="audio-controls">
              {authReady && user && (
                <button
                  type="button"
                  className="audio-btn btn-pill"
                  onClick={() => void handleSignOut()}
                  disabled={authBusy}
                  title={`Sign out (${user.displayName ?? 'User'})`}
                >
                  {user.photoURL && !avatarFailed ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="auth-avatar auth-avatar--sm"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <UserIcon size={14} />
                  )}
                  <span className="audio-label">Sign out</span>
                </button>
              )}
              <button
                type="button"
                className={`audio-btn btn-pill ${musicOn && !muted ? 'audio-btn--on' : ''}`}
                onClick={handleToggleMusic}
                aria-pressed={musicOn}
              >
                <Music size={15} />
                <span className="audio-label">Music</span>
              </button>
              <button
                type="button"
                className={`audio-btn btn-pill ${!muted ? 'audio-btn--on' : ''}`}
                onClick={handleToggleMute}
                aria-pressed={muted}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="audio-label">{muted ? 'Muted' : 'Mute'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Sticky 5-Gauge Telemetry Strip */}
        <TelemetryStrip metrics={metrics} />

        {/* 6-Step Progress Stepper */}
        <StepperBar
          currentStep={step}
          maxUnlockedStep={maxUnlockedStep}
          flightActive={flightActive}
          flightFinished={flightFinished}
          onSelectStep={handleGoToStep}
        />

        {/* Mobile Collapsible Schematic Toggle (Design steps 1-4) */}
        {step <= 4 && (
          <div className="mobile-schematic-bar">
            <button
              type="button"
              className="mobile-schematic-toggle btn-pill"
              onClick={() => setMobileSchematicOpen((v) => !v)}
              aria-expanded={mobileSchematicOpen}
            >
              <span>
                Craft View · {Math.round(metrics.wetMassKg)} kg
              </span>
              {mobileSchematicOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {mobileSchematicOpen && (
              <div className="mobile-schematic-drawer">
                <SpacecraftSchematic
                  config={config}
                  metrics={metrics}
                  highlightSubsystem={highlightSubsystem}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* Main Workspace */}
        <main className={`workspace-grid ${step >= 5 ? 'workspace-grid--focused' : ''}`}>
          <div className="workspace-main">
            {step === 1 && (
              <StepMission
                selectedDifficulty={config.difficulty}
                selectedMissionId={config.missionId}
                bestScores={bestScores}
                onSelectDifficulty={handleSelectDifficulty}
                onSelectMission={handleSelectMission}
                onNext={() => handleGoToStep(2)}
              />
            )}

            {step === 2 && (
              <StepSpacecraft
                config={config}
                metrics={metrics}
                activeTab={spacecraftTab}
                onTabChange={setSpacecraftTab}
                onUpdateConfig={handleUpdateConfig}
                onToggleAutoFuel={handleToggleAutoFuel}
                onHighlightSubsystem={setHighlightSubsystem}
                draftSaved={draftSaved}
                onSaveDraft={handleSaveDraft}
                onBack={() => handleGoToStep(1)}
                onNext={() => handleGoToStep(3)}
              />
            )}

            {step === 3 && (
              <StepLaunch
                selectedRocketId={config.rocket}
                metrics={metrics}
                onSelectRocket={handleSelectRocket}
                draftSaved={draftSaved}
                onSaveDraft={handleSaveDraft}
                onBack={() => handleGoToStep(2)}
                onNext={() => handleGoToStep(4)}
              />
            )}

            {step === 4 && (
              <StepReadiness
                metrics={metrics}
                seed={seed}
                onSeedChange={setSeed}
                onRandomizeSeed={() => {
                  soundEngine.playTick();
                  setSeed(makeRandomSeed());
                }}
                onJumpToFix={handleJumpToFix}
                onBack={() => handleGoToStep(3)}
                onLaunchMission={handleLaunchMission}
              />
            )}

            {step === 5 && (
              <StepFlight
                metrics={metrics}
                phases={phases}
                flight={flight}
                onAdvancePhase={handleAdvancePhase}
                onResolveEvent={handleResolveEvent}
                onFinishToDebrief={handleFinishToDebrief}
                onCruiseSpeedChange={setCruiseSpeed}
              />
            )}

            {step === 6 && (
              <StepDebrief
                metrics={metrics}
                flight={flight}
                debrief={debrief}
                seed={seed}
                onTryAgain={handleTryAgainSameSeed}
                onNewTarget={handleNewTarget}
              />
            )}
          </div>

          {/* Desktop Sticky Live Schematic & Compact Forecast (Design Steps 1-4) */}
          {step <= 4 && (
            <aside className="workspace-sidebar" aria-label="Spacecraft Preview">
              <div className="sidebar-sticky">
                <SpacecraftSchematic
                  config={config}
                  metrics={metrics}
                  highlightSubsystem={highlightSubsystem}
                />

                <div className="quick-math-card">
                  <h4>Forecast</h4>
                  <dl className="quick-math-list font-mono tabular-nums">
                    <div>
                      <dt>Ops Window</dt>
                      <dd className={metrics.scienceMonths < metrics.parts.mission.monthsNeeded ? 'text-warn' : 'text-ok'}>
                        {metrics.scienceMonths} / {metrics.parts.mission.monthsNeeded} mo
                      </dd>
                    </div>
                    <div>
                      <dt>Sensors Fit</dt>
                      <dd>{Math.round(metrics.instrumentScoreFraction * 100)}%</dd>
                    </div>
                    <div>
                      <dt>Science Goal</dt>
                      <dd className="text-amber">{Math.round(metrics.projectedScienceFraction * 75)} / 75 pts</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>
          )}
        </main>
      </div>

      <MissionChatbot metrics={metrics} screen={screen} step={step} />
    </div>
  );
}

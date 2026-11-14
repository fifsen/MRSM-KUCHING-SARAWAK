import React, { useState } from 'react';
import {
  ANTENNAS,
  BUSES,
  INSTRUMENTS,
  POWER_OPTIONS,
  PROPULSION_OPTIONS,
  REDUNDANCY_OPTIONS,
  SHIELDING_OPTIONS,
  type AntennaSize,
  type BusSize,
  type PowerOptionId,
  type PropulsionType,
  type RedundancyLevel,
  type ShieldingLevel,
  type SpacecraftConfig,
} from '../../data/missionData';
import type { EngineeringMetrics } from '../../engine/physics';
import { MISSION_PRO_TIPS, ProTipOverlay } from './ProTipOverlay';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Atom,
  Box,
  Camera,
  Check,
  Cpu,
  Flame,
  Gauge,
  Lightbulb,
  Magnet,
  Pickaxe,
  Radar,
  Radio,
  Save,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  Thermometer,
  Wand2,
  Waves,
  Zap,
} from 'lucide-react';

export type SpacecraftTab =
  | 'bus'
  | 'power'
  | 'propulsion'
  | 'antenna'
  | 'protection'
  | 'instruments';

interface StepSpacecraftProps {
  config: SpacecraftConfig;
  metrics: EngineeringMetrics;
  activeTab: SpacecraftTab;
  onTabChange: (tab: SpacecraftTab) => void;
  onUpdateConfig: (patch: Partial<SpacecraftConfig>) => void;
  onToggleAutoFuel: () => void;
  onHighlightSubsystem: (key: string | null) => void;
  draftSaved: boolean;
  onSaveDraft: () => void;
  onBack: () => void;
  onNext: () => void;
}

const TABS: { id: SpacecraftTab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'bus', label: 'Bus', Icon: Box },
  { id: 'power', label: 'Power', Icon: Sun },
  { id: 'propulsion', label: 'Engine', Icon: Flame },
  { id: 'antenna', label: 'Dish', Icon: Radio },
  { id: 'protection', label: 'Shields', Icon: Shield },
  { id: 'instruments', label: 'Sensors', Icon: Sparkles },
];

const INSTRUMENT_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  camera: Camera,
  spectrometer: Sparkles,
  radar: Radar,
  magnetometer: Magnet,
  neutron: Atom,
  thermal: Thermometer,
  plasma: Waves,
  altimeter: Activity,
  sampler: Pickaxe,
};

export const StepSpacecraft: React.FC<StepSpacecraftProps> = ({
  config,
  metrics,
  activeTab,
  onTabChange,
  onUpdateConfig,
  onToggleAutoFuel,
  onHighlightSubsystem,
  draftSaved,
  onSaveDraft,
  onBack,
  onNext,
}) => {
  const [proTipOpen, setProTipOpen] = useState(false);

  const { parts } = metrics;
  const currentBus = parts.bus;
  const missionId = parts.mission.id;

  const targetTips = MISSION_PRO_TIPS[missionId] ?? [];
  const activeIssues = targetTips.filter((t) => t.evaluate(metrics, config) === 'issue');

  const toggleInstrument = (instId: string) => {
    const exists = config.instruments.includes(instId);
    const next = exists
      ? config.instruments.filter((id) => id !== instId)
      : [...config.instruments, instId];
    onUpdateConfig({ instruments: next });
  };

  const switchTab = (tab: SpacecraftTab) => {
    onTabChange(tab);
    onHighlightSubsystem(tab);
  };

  const handleJumpFromProTip = (tab: SpacecraftTab) => {
    switchTab(tab);
    setProTipOpen(false);
  };

  const handleFooterBack = () => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx <= 0) {
      onBack();
    } else {
      switchTab(TABS[idx - 1].id);
    }
  };

  const handleFooterNext = () => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx >= TABS.length - 1) {
      onNext();
    } else {
      switchTab(TABS[idx + 1].id);
    }
  };

  const nextTabLabel = (() => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx >= TABS.length - 1) return 'Pick Rocket';
    return TABS[idx + 1].label;
  })();

  const sortedInstruments = [...INSTRUMENTS].sort(
    (a, b) => b.values[missionId] - a.values[missionId],
  );

  return (
    <section className="step-panel" aria-labelledby="step-spacecraft-title">
      <div className="step-header">
        <div>
          <p className="step-kicker font-mono">Step 2 · Build</p>
          <h2 id="step-spacecraft-title" className="step-title">
            Build Craft
          </h2>
        </div>

        <div className="header-btn-group">
          <button
            type="button"
            className={`btn-save-draft btn-pill ${draftSaved ? 'btn-save-draft--saved' : ''}`}
            onClick={onSaveDraft}
          >
            {draftSaved ? <Check size={15} /> : <Save size={15} />}
            <span>{draftSaved ? 'Saved' : 'Save Draft'}</span>
          </button>

          <button
            type="button"
            className={`btn-protip btn-pill ${activeIssues.length > 0 ? 'btn-protip--alert' : ''}`}
            onClick={() => setProTipOpen(true)}
          >
            <Lightbulb size={15} />
            <span>Pro-Tips{activeIssues.length > 0 ? ` (${activeIssues.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Subsystem Tab Switcher */}
      <div className="subsystem-tabs" role="tablist" aria-label="Spacecraft parts">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`subsystem-tab btn-pill ${isActive ? 'subsystem-tab--active' : ''}`}
              onClick={() => switchTab(id)}
            >
              <Icon size={14} />
              <span>{label}</span>
              {id === 'instruments' && (
                <span className="tab-count font-mono">
                  {metrics.instrumentMassKg}/{currentBus.payloadCapacityKg}kg
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BUS */}
      {activeTab === 'bus' && (
        <div className="option-grid option-grid--3">
          {BUSES.map((b) => {
            const selected = config.bus === b.id;
            return (
              <button
                key={b.id}
                type="button"
                className={`option-card tile-lift ${selected ? 'card--selected' : ''}`}
                onClick={() => onUpdateConfig({ bus: b.id as BusSize })}
                aria-pressed={selected}
              >
                <div className="option-card-head">
                  <span className="tile-icon-wrap">
                    <Box size={18} className="text-cyan" />
                  </span>
                  <span className="option-title">{b.name}</span>
                </div>
                <div className="stat-chips font-mono tabular-nums">
                  <span className="stat-chip">{b.massKg} kg</span>
                  <span className="stat-chip">{b.powerW} W</span>
                  <span className="stat-chip text-amber">${b.costM}M</span>
                  <span className="stat-chip text-cyan">+{b.payloadCapacityKg} kg load</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* TAB 2: POWER */}
      {activeTab === 'power' && (
        <div className="subsystem-section">
          <div className="mini-bar font-mono">
            <span>Sun: {Math.round(parts.mission.sunlightFraction * 100)}%</span>
            <span>Need: {Math.round(Math.max(metrics.averageDrawW, metrics.ionPowerRequiredW))} W</span>
          </div>

          <div className="option-grid option-grid--3">
            {POWER_OPTIONS.map((p) => {
              const selected = config.power === p.id;
              const targetOutput =
                p.kind === 'solar'
                  ? Math.round(p.areaM2 * 150 * parts.mission.sunlightFraction)
                  : p.basePowerW;
              const meetsReq =
                targetOutput >= Math.max(metrics.averageDrawW, metrics.ionPowerRequiredW);

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`option-card tile-lift ${selected ? 'card--selected' : ''}`}
                  onClick={() => onUpdateConfig({ power: p.id as PowerOptionId })}
                  aria-pressed={selected}
                >
                  <div className="option-card-head">
                    <span className="tile-icon-wrap">
                      {p.kind === 'solar' ? (
                        <Sun size={18} className="text-cyan" />
                      ) : (
                        <Atom size={18} className="text-amber" />
                      )}
                    </span>
                    <span className="option-title">{p.name}</span>
                  </div>
                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">{p.massKg} kg</span>
                    <span className={`stat-chip ${meetsReq ? 'text-ok' : 'text-fail'}`}>
                      {targetOutput} W
                    </span>
                    <span className="stat-chip text-amber">${p.costM}M</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ENGINE & FUEL */}
      {activeTab === 'propulsion' && (
        <div className="subsystem-section">
          <div className="option-grid option-grid--2">
            {PROPULSION_OPTIONS.map((prop) => {
              const selected = config.propulsion === prop.id;
              const cruiseMo =
                prop.id === 'ion'
                  ? parts.mission.ionCruiseMonths
                  : parts.mission.chemCruiseMonths;

              return (
                <button
                  key={prop.id}
                  type="button"
                  className={`option-card tile-lift ${selected ? 'card--selected' : ''}`}
                  onClick={() => onUpdateConfig({ propulsion: prop.id as PropulsionType })}
                  aria-pressed={selected}
                >
                  <div className="option-card-head">
                    <span className="tile-icon-wrap">
                      {prop.id === 'chemical' ? (
                        <Flame size={18} className="text-amber" />
                      ) : (
                        <Zap size={18} className="text-cyan" />
                      )}
                    </span>
                    <span className="option-title">{prop.name}</span>
                  </div>
                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">{prop.engineMassKg} kg</span>
                    <span className="stat-chip">
                      {prop.id === 'ion' ? `${700 + currentBus.powerW} W` : '0 W'}
                    </span>
                    <span className="stat-chip text-amber">${prop.costM}M</span>
                    <span className="stat-chip">{prop.isp}s Isp</span>
                    <span className="stat-chip">{cruiseMo} mo trip</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="slider-panel">
            <div className="slider-header">
              <div>
                <label htmlFor="propellant-slider" className="slider-label">
                  Fuel · {metrics.propellantKg} kg
                </label>
                <div className="mini-bar font-mono tabular-nums">
                  <span>Cost: ${metrics.cost.propellant.toFixed(1)}M</span>
                  <span className={metrics.deltaVMargin >= 150 ? 'text-ok' : metrics.deltaVMargin >= 0 ? 'text-warn' : 'text-fail'}>
                    Δv: {Math.round(metrics.achievedDeltaV)} / {parts.mission.deltaVReq} m/s
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={`btn-autotune btn-pill ${config.autoFuel ? 'btn-autotune--on' : ''}`}
                onClick={onToggleAutoFuel}
                aria-pressed={config.autoFuel}
              >
                <Wand2 size={15} />
                <span>Auto-fuel {config.autoFuel ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <input
              id="propellant-slider"
              type="range"
              min={0}
              max={12000}
              step={20}
              value={metrics.propellantKg}
              onChange={(e) =>
                onUpdateConfig({
                  propellantKg: Number(e.target.value),
                  autoFuel: false,
                })
              }
              className="blueprint-slider"
            />

            <div className="slider-ticks font-mono tabular-nums">
              <span>0 kg</span>
              <span>Target +200 m/s</span>
              <span>12000 kg</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISH */}
      {activeTab === 'antenna' && (
        <div className="subsystem-section">
          <div className="mini-bar font-mono">
            <span>Distance: {parts.mission.distanceAU} AU</span>
            <span>Need: {metrics.monthlyInstrumentDataGb} Gb/mo</span>
          </div>
          <div className="option-grid option-grid--3">
            {ANTENNAS.map((a) => {
              const selected = config.antenna === a.id;
              const rate = Math.min(
                20000,
                (6 * Math.pow(a.diameterM, 2) * a.txPowerW) /
                  Math.pow(parts.mission.distanceAU, 2),
              );
              const monthlyGb = Math.round(rate * 0.6048);
              const okLink =
                metrics.monthlyInstrumentDataGb === 0 ||
                monthlyGb >= metrics.monthlyInstrumentDataGb;

              return (
                <button
                  key={a.id}
                  type="button"
                  className={`option-card tile-lift ${selected ? 'card--selected' : ''}`}
                  onClick={() => onUpdateConfig({ antenna: a.id as AntennaSize })}
                  aria-pressed={selected}
                >
                  <div className="option-card-head">
                    <span className="tile-icon-wrap">
                      <Radio size={18} className="text-cyan" />
                    </span>
                    <span className="option-title">{a.name}</span>
                  </div>
                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">{a.massKg} kg</span>
                    <span className="stat-chip">{a.powerW} W</span>
                    <span className="stat-chip text-amber">${a.costM}M</span>
                    <span className={`stat-chip ${okLink ? 'text-ok' : 'text-warn'}`}>
                      {monthlyGb} Gb/mo
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: SHIELDS & BACKUPS */}
      {activeTab === 'protection' && (
        <div className="subsystem-section">
          <h3 className="subsection-label">Radiation Shield</h3>
          <div className="option-grid option-grid--3">
            {SHIELDING_OPTIONS.map((s) => {
              const selected = config.shielding === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`option-card tile-lift ${selected ? 'card--selected' : ''}`}
                  onClick={() => onUpdateConfig({ shielding: s.id as ShieldingLevel })}
                  aria-pressed={selected}
                >
                  <div className="option-card-head">
                    <span className="tile-icon-wrap">
                      {s.id === 'none' ? (
                        <ShieldAlert size={18} className="text-warn" />
                      ) : (
                        <Shield size={18} className="text-cyan" />
                      )}
                    </span>
                    <span className="option-title">{s.name}</span>
                  </div>
                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">{s.massKg} kg</span>
                    <span className="stat-chip">{Math.round(s.efficiency * 100)}% block</span>
                    <span className="stat-chip text-amber">${s.costM}M</span>
                  </div>
                </button>
              );
            })}
          </div>

          <h3 className="subsection-label">System Backups</h3>
          <div className="option-grid option-grid--3">
            {REDUNDANCY_OPTIONS.map((r) => {
              const selected = config.redundancy === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`option-card tile-lift ${selected ? 'card--selected' : ''}`}
                  onClick={() => onUpdateConfig({ redundancy: r.id as RedundancyLevel })}
                  aria-pressed={selected}
                >
                  <div className="option-card-head">
                    <span className="tile-icon-wrap">
                      <Cpu size={18} className="text-cyan" />
                    </span>
                    <span className="option-title">{r.name}</span>
                  </div>
                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">+{Math.round(r.massFraction * 100)}% mass</span>
                    <span className="stat-chip text-amber">+{Math.round(r.costFraction * 100)}% cost</span>
                    <span className="stat-chip text-ok">Fault ×{r.multiplier}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: INSTRUMENTS */}
      {activeTab === 'instruments' && (
        <div className="subsystem-section">
          <div className="mini-bar font-mono tabular-nums">
            <span>
              Payload:{' '}
              <strong
                className={
                  metrics.instrumentMassKg > currentBus.payloadCapacityKg ? 'text-fail' : 'text-ok'
                }
              >
                {metrics.instrumentMassKg} / {currentBus.payloadCapacityKg} kg
              </strong>
            </span>
            <span>Science fit: {Math.round(metrics.instrumentScoreFraction * 100)}%</span>
          </div>

          <div className="instrument-grid">
            {sortedInstruments.map((inst) => {
              const selected = config.instruments.includes(inst.id);
              const val = inst.values[missionId]; // 0..10
              const pipFill = val / 2; // 0..5 pips
              const Icon = INSTRUMENT_ICONS[inst.id] ?? Gauge;

              return (
                <button
                  key={inst.id}
                  type="button"
                  className={`instrument-card tile-lift ${selected ? 'card--selected' : ''}`}
                  onClick={() => toggleInstrument(inst.id)}
                  aria-pressed={selected}
                >
                  <div className="instrument-top">
                    <span className={`check-box ${selected ? 'check-box--on' : ''}`} aria-hidden="true">
                      {selected ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                    </span>
                    <div className="instrument-head-text">
                      <span className="instrument-name">{inst.name}</span>
                      <span className="science-pips" aria-label={`Science value ${val} of 10`}>
                        {[1, 2, 3, 4, 5].map((pipIdx) => {
                          const filled = pipFill >= pipIdx;
                          const half = !filled && pipFill >= pipIdx - 0.5;
                          return (
                            <span
                              key={pipIdx}
                              className={`pip ${
                                filled ? 'pip--full' : half ? 'pip--half' : 'pip--empty'
                              }`}
                            />
                          );
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="stat-chips font-mono tabular-nums">
                    <span className="stat-chip">{inst.massKg} kg</span>
                    <span className="stat-chip">{inst.powerW} W</span>
                    <span className="stat-chip">{inst.dataGbPerMonth} Gb</span>
                    <span className="stat-chip text-amber">${inst.costM}M</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="step-footer-actions">
        <button type="button" className="btn-secondary btn-pill" onClick={handleFooterBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <button type="button" className="btn-launch btn-lg btn-pill btn-pulse" onClick={handleFooterNext}>
          <span>{nextTabLabel}</span>
          <ArrowRight size={17} />
        </button>
      </div>

      <ProTipOverlay
        open={proTipOpen}
        config={config}
        metrics={metrics}
        onClose={() => setProTipOpen(false)}
        onJumpToTab={handleJumpFromProTip}
      />
    </section>
  );
};

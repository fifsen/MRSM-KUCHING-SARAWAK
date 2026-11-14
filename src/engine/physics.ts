import {
  ANTENNAS,
  AUTO_FUEL_RESERVE_DV,
  BUSES,
  DEFAULT_CONFIG,
  DIFFICULTIES,
  INSTRUMENTS,
  MIN_REVIEW_SPARE_DV,
  MISSIONS,
  OPS_COST_PER_MONTH,
  POWER_OPTIONS,
  PROPULSION_OPTIONS,
  REDUNDANCY_OPTIONS,
  ROCKETS,
  SHIELDING_OPTIONS,
  type AntennaSpec,
  type BusSpec,
  type DifficultySpec,
  type InstrumentSpec,
  type MissionTarget,
  type PowerSpec,
  type PropulsionSpec,
  type RedundancySpec,
  type RocketSpec,
  type ShieldingSpec,
  type SpacecraftConfig,
  type StepId,
} from '../data/missionData';

export const GRAVITY_STANDARD = 9.80665;

export interface ResolvedParts {
  difficulty: DifficultySpec;
  mission: MissionTarget;
  bus: BusSpec;
  power: PowerSpec;
  propulsion: PropulsionSpec;
  antenna: AntennaSpec;
  shielding: ShieldingSpec;
  redundancy: RedundancySpec;
  instruments: InstrumentSpec[];
  rocket: RocketSpec;
}

export interface CostBreakdown {
  bus: number;
  power: number;
  propulsion: number;
  propellant: number;
  antenna: number;
  shielding: number;
  redundancy: number;
  instruments: number;
  rocket: number;
  operations: number;
  total: number;
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface ReadinessCheck {
  id:
    | 'mass'
    | 'deltav'
    | 'power'
    | 'ion_power'
    | 'payload'
    | 'instruments'
    | 'downlink'
    | 'radiation'
    | 'budget'
    | 'sampler';
  label: string;
  status: CheckStatus;
  passed: boolean;
  summary: string;
  fixStep: 1 | 2 | 3;
  fixSection?: string;
}

export interface EngineeringMetrics {
  parts: ResolvedParts;
  propellantKg: number;
  tankMassKg: number;
  instrumentMassKg: number;
  dryMassKg: number;
  wetMassKg: number;
  achievedDeltaV: number;
  deltaVMargin: number;
  availablePowerW: number;
  averageDrawW: number;
  ionPowerRequiredW: number;
  powerMarginW: number;
  powerPasses: boolean;
  ionPowerPasses: boolean;
  dataRateKbps: number;
  monthlyDownlinkGb: number;
  monthlyInstrumentDataGb: number;
  dataReturnedFraction: number;
  cruiseMonths: number;
  scienceMonths: number;
  sumInstrumentValues: number;
  topFourValues: number;
  instrumentScoreFraction: number;
  timeScoreFraction: number;
  hasSampler: boolean;
  samplerPenaltyMultiplier: number;
  projectedScienceFraction: number;
  baseHazardPerPhase: number;
  cost: CostBreakdown;
  effectiveBudgetCap: number;
  budgetRemaining: number;
  checks: ReadinessCheck[];
  allReady: boolean;
}

export function resolveParts(config: SpacecraftConfig): ResolvedParts {
  const difficulty = DIFFICULTIES.find((d) => d.id === config.difficulty) ?? DIFFICULTIES[1];
  const mission = MISSIONS.find((m) => m.id === config.missionId) ?? MISSIONS[0];
  const bus = BUSES.find((b) => b.id === config.bus) ?? BUSES[1];
  const power = POWER_OPTIONS.find((p) => p.id === config.power) ?? POWER_OPTIONS[1];
  const propulsion =
    PROPULSION_OPTIONS.find((p) => p.id === config.propulsion) ?? PROPULSION_OPTIONS[0];
  const antenna = ANTENNAS.find((a) => a.id === config.antenna) ?? ANTENNAS[1];
  const shielding =
    SHIELDING_OPTIONS.find((s) => s.id === config.shielding) ?? SHIELDING_OPTIONS[1];
  const redundancy =
    REDUNDANCY_OPTIONS.find((r) => r.id === config.redundancy) ?? REDUNDANCY_OPTIONS[0];
  const instruments = INSTRUMENTS.filter((inst) => config.instruments.includes(inst.id));
  const rocket = ROCKETS.find((r) => r.id === config.rocket) ?? ROCKETS[1];

  return {
    difficulty,
    mission,
    bus,
    power,
    propulsion,
    antenna,
    shielding,
    redundancy,
    instruments,
    rocket,
  };
}

export function findPropellantForTargetDeltaV(
  config: SpacecraftConfig,
  reserveDv = AUTO_FUEL_RESERVE_DV,
): number {
  const parts = resolveParts(config);
  const { bus, mission, power, propulsion, antenna, shielding, redundancy, instruments } = parts;
  const targetDv = mission.deltaVReq + reserveDv;
  const instrumentMassKg = instruments.reduce((sum, i) => sum + i.massKg, 0);
  const baseDryMass =
    bus.massKg * (1 + redundancy.massFraction) +
    power.massKg +
    propulsion.engineMassKg +
    antenna.massKg +
    shielding.massKg +
    instrumentMassKg;

  const ve = propulsion.isp * GRAVITY_STANDARD;
  const ratio = Math.exp(targetDv / ve); // (baseDry + (1 + t)F) / (baseDry + t*F) = ratio
  const denom = 1 + propulsion.tankFraction - ratio * propulsion.tankFraction;
  if (denom <= 0) {
    return bus.maxPropellantKg;
  }
  const exactFuel = (baseDryMass * (ratio - 1)) / denom;
  const snapped = Math.ceil(Math.max(0, exactFuel) / 20) * 20;
  return Math.min(bus.maxPropellantKg, snapped);
}

export function calculateMetrics(config: SpacecraftConfig): EngineeringMetrics {
  const parts = resolveParts(config);
  const {
    difficulty,
    mission,
    bus,
    power,
    propulsion,
    antenna,
    shielding,
    redundancy,
    instruments,
    rocket,
  } = parts;

  const propellantKg = Math.max(0, Math.min(config.propellantKg, 12000));
  const tankMassKg = propellantKg * propulsion.tankFraction;
  const instrumentMassKg = instruments.reduce((sum, i) => sum + i.massKg, 0);

  const dryMassKg =
    bus.massKg * (1 + redundancy.massFraction) +
    power.massKg +
    propulsion.engineMassKg +
    tankMassKg +
    antenna.massKg +
    shielding.massKg +
    instrumentMassKg;

  const wetMassKg = dryMassKg + propellantKg;
  const achievedDeltaV =
    dryMassKg > 0 && wetMassKg > dryMassKg
      ? propulsion.isp * GRAVITY_STANDARD * Math.log(wetMassKg / dryMassKg)
      : 0;
  const deltaVMargin = achievedDeltaV - mission.deltaVReq;

  // Power at target
  const availablePowerW =
    power.kind === 'solar'
      ? power.areaM2 * 150 * mission.sunlightFraction
      : power.basePowerW;

  const instrumentPowerSum = instruments.reduce((sum, i) => sum + i.powerW, 0);
  const averageDrawW = bus.powerW + antenna.powerW / 3 + 0.6 * instrumentPowerSum;
  const ionPowerRequiredW = propulsion.id === 'ion' ? 700 + bus.powerW : 0;

  const powerMarginW = availablePowerW - Math.max(averageDrawW, ionPowerRequiredW);
  const powerPasses = availablePowerW >= averageDrawW;
  const ionPowerPasses = propulsion.id !== 'ion' || availablePowerW >= ionPowerRequiredW;

  // Communications link budget
  const rawRate =
    (6 * Math.pow(antenna.diameterM, 2) * antenna.txPowerW) /
    Math.pow(mission.distanceAU, 2);
  const dataRateKbps = Math.min(20000, rawRate);
  const monthlyDownlinkGb = dataRateKbps * 0.6048;

  const monthlyInstrumentDataGb = instruments.reduce(
    (sum, i) => sum + i.dataGbPerMonth,
    0,
  );
  const dataReturnedFraction =
    instruments.length === 0
      ? 0
      : monthlyInstrumentDataGb > 0
        ? Math.min(1, monthlyDownlinkGb / monthlyInstrumentDataGb)
        : 1;

  // Cruise vs science time
  const cruiseMonths =
    propulsion.id === 'ion' ? mission.ionCruiseMonths : mission.chemCruiseMonths;
  const scienceMonths = Math.max(1, mission.missionWindow - cruiseMonths);

  // Science return model
  const sortedTargetValues = [...INSTRUMENTS]
    .map((inst) => inst.values[mission.id])
    .sort((a, b) => b - a);
  const topFourValues = sortedTargetValues.slice(0, 4).reduce((s, v) => s + v, 0);
  const sumInstrumentValues = instruments.reduce(
    (s, inst) => s + inst.values[mission.id],
    0,
  );
  const instrumentScoreFraction =
    topFourValues > 0 ? Math.min(1, sumInstrumentValues / topFourValues) : 0;
  const timeScoreFraction =
    mission.monthsNeeded > 0 ? Math.min(1, scienceMonths / mission.monthsNeeded) : 0;

  const hasSampler = instruments.some((inst) => inst.id === 'sampler');
  const samplerPenaltyMultiplier = mission.requiresSampler && !hasSampler ? 0.4 : 1.0;

  const projectedScienceFraction =
    instrumentScoreFraction *
    dataReturnedFraction *
    timeScoreFraction *
    samplerPenaltyMultiplier;

  // Latch-up hazard per phase = 0.012 x radiation x (1 - 0.8 x shield) x backup multiplier
  const baseHazardPerPhase =
    0.012 *
    mission.radiationLevel *
    (1 - 0.8 * shielding.efficiency) *
    redundancy.multiplier *
    difficulty.hazardMultiplier;

  // Cost breakdown
  const busWithBackupCost = bus.costM * (1 + redundancy.costFraction);
  const backupExtraCost = Number((busWithBackupCost - bus.costM).toFixed(1));
  const propellantCost = Number((propellantKg * propulsion.propCostPerKg).toFixed(1));
  const instrumentsCost = instruments.reduce((s, i) => s + i.costM, 0);
  const operationsCost = Number((OPS_COST_PER_MONTH * mission.missionWindow).toFixed(1));

  const cost: CostBreakdown = {
    bus: bus.costM,
    power: power.costM,
    propulsion: propulsion.costM,
    propellant: propellantCost,
    antenna: antenna.costM,
    shielding: shielding.costM,
    redundancy: backupExtraCost,
    instruments: instrumentsCost,
    rocket: rocket.costM,
    operations: operationsCost,
    total: 0,
  };
  cost.total = Number(
    (
      cost.bus +
      cost.power +
      cost.propulsion +
      cost.propellant +
      cost.antenna +
      cost.shielding +
      cost.redundancy +
      cost.instruments +
      cost.rocket +
      cost.operations
    ).toFixed(1),
  );
  const effectiveBudgetCap = Math.round(mission.budgetCap * difficulty.budgetMultiplier);
  const budgetRemaining = Number((effectiveBudgetCap - cost.total).toFixed(1));

  // 10-Row Review Checklist
  const massStatus: CheckStatus =
    wetMassKg > rocket.capacityKg
      ? 'fail'
      : wetMassKg > rocket.capacityKg * 0.9
        ? 'warn'
        : 'pass';

  const dvStatus: CheckStatus =
    deltaVMargin < MIN_REVIEW_SPARE_DV
      ? 'fail'
      : deltaVMargin < 200
        ? 'warn'
        : 'pass';

  const powerStatus: CheckStatus = !powerPasses
    ? 'fail'
    : availablePowerW - averageDrawW < 25
      ? 'warn'
      : 'pass';

  const ionPowerStatus: CheckStatus =
    propulsion.id !== 'ion'
      ? 'pass'
      : ionPowerPasses
        ? 'pass'
        : 'fail';

  const payloadStatus: CheckStatus =
    instrumentMassKg > bus.payloadCapacityKg
      ? 'fail'
      : instrumentMassKg > bus.payloadCapacityKg * 0.9
        ? 'warn'
        : 'pass';

  const instrumentsStatus: CheckStatus =
    instruments.length === 0
      ? 'fail'
      : instrumentScoreFraction < 0.65
        ? 'warn'
        : 'pass';

  const downlinkStatus: CheckStatus =
    instruments.length === 0
      ? 'fail'
      : dataReturnedFraction < 0.25
        ? 'fail'
        : dataReturnedFraction < 0.85
          ? 'warn'
          : 'pass';

  const radiationStatus: CheckStatus =
    mission.radiationLevel >= 5 && shielding.id === 'none'
      ? 'fail'
      : (mission.radiationLevel >= 5 && shielding.id !== 'vault') ||
          (mission.radiationLevel >= 1.2 && shielding.id === 'none')
        ? 'warn'
        : 'pass';

  const budgetStatus: CheckStatus =
    cost.total > effectiveBudgetCap
      ? 'fail'
      : budgetRemaining < effectiveBudgetCap * 0.05
        ? 'warn'
        : 'pass';

  const samplerStatus: CheckStatus =
    mission.requiresSampler && !hasSampler ? 'warn' : 'pass';

  const checks: ReadinessCheck[] = [
    {
      id: 'mass',
      label: 'Mass',
      status: massStatus,
      passed: massStatus !== 'fail',
      summary: `${Math.round(wetMassKg)} / ${rocket.capacityKg} kg`,
      fixStep: 3,
    },
    {
      id: 'deltav',
      label: 'Delta-v',
      status: dvStatus,
      passed: dvStatus !== 'fail',
      summary: `${Math.round(deltaVMargin)} m/s spare`,
      fixStep: 2,
      fixSection: 'propulsion',
    },
    {
      id: 'power',
      label: 'Power',
      status: powerStatus,
      passed: powerStatus !== 'fail',
      summary: `${Math.round(availablePowerW)} / ${Math.round(averageDrawW)} W`,
      fixStep: 2,
      fixSection: 'power',
    },
    {
      id: 'ion_power',
      label: 'Ion power',
      status: ionPowerStatus,
      passed: ionPowerStatus !== 'fail',
      summary:
        propulsion.id === 'ion'
          ? `${Math.round(availablePowerW)} / ${Math.round(ionPowerRequiredW)} W`
          : 'Chemical N/A',
      fixStep: 2,
      fixSection: 'power',
    },
    {
      id: 'payload',
      label: 'Payload room',
      status: payloadStatus,
      passed: payloadStatus !== 'fail',
      summary: `${instrumentMassKg} / ${bus.payloadCapacityKg} kg`,
      fixStep: 2,
      fixSection: 'bus',
    },
    {
      id: 'instruments',
      label: 'Instruments',
      status: instrumentsStatus,
      passed: instrumentsStatus !== 'fail',
      summary: `${instruments.length} mounted`,
      fixStep: 2,
      fixSection: 'instruments',
    },
    {
      id: 'downlink',
      label: 'Downlink',
      status: downlinkStatus,
      passed: downlinkStatus !== 'fail',
      summary: `${Math.round(dataReturnedFraction * 100)}% sent`,
      fixStep: 2,
      fixSection: 'antenna',
    },
    {
      id: 'radiation',
      label: 'Radiation',
      status: radiationStatus,
      passed: radiationStatus !== 'fail',
      summary: `${shielding.name} (${Math.round(shielding.efficiency * 100)}%)`,
      fixStep: 2,
      fixSection: 'protection',
    },
    {
      id: 'budget',
      label: 'Budget',
      status: budgetStatus,
      passed: budgetStatus !== 'fail',
      summary: `$${cost.total.toFixed(0)} / $${effectiveBudgetCap}M`,
      fixStep: 2,
      fixSection: 'bus',
    },
    {
      id: 'sampler',
      label: 'Sampler',
      status: samplerStatus,
      passed: true,
      summary: mission.requiresSampler
        ? hasSampler
          ? 'Installed'
          : 'Missing (-60%)'
        : 'Not needed',
      fixStep: 2,
      fixSection: 'instruments',
    },
  ];

  return {
    parts,
    propellantKg,
    tankMassKg,
    instrumentMassKg,
    dryMassKg,
    wetMassKg,
    achievedDeltaV,
    deltaVMargin,
    availablePowerW,
    averageDrawW,
    ionPowerRequiredW,
    powerMarginW,
    powerPasses,
    ionPowerPasses,
    dataRateKbps,
    monthlyDownlinkGb,
    monthlyInstrumentDataGb,
    dataReturnedFraction,
    cruiseMonths,
    scienceMonths,
    sumInstrumentValues,
    topFourValues,
    instrumentScoreFraction,
    timeScoreFraction,
    hasSampler,
    samplerPenaltyMultiplier,
    projectedScienceFraction,
    baseHazardPerPhase,
    cost,
    effectiveBudgetCap,
    budgetRemaining,
    checks,
    allReady: checks.every((c) => c.passed),
  };
}

// ============================================================================
// Seeded PRNG (FNV-1a hash + Mulberry32)
// ============================================================================

export function hashSeed(seedInput: string): number {
  const clean = seedInput.trim() || 'APOLLO-42';
  let h = 2166136261 >>> 0;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seedInput: string): () => number {
  let state = hashSeed(seedInput) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Flight Simulation & Random Event Engine
// ============================================================================

export type FlightPhaseId =
  | 'launch'
  | 'cruise_1'
  | 'cruise_2'
  | 'arrive'
  | 'ops_1'
  | 'ops_2'
  | 'ops_3';

export type RandomEventKind =
  | 'solar_storm'
  | 'off_course'
  | 'computer_fault'
  | 'power_drop'
  | 'antenna_bumped'
  | 'arrival_burn';

export interface EventOption {
  id: string;
  label: string;
  oddsText: string;
  odds: number; // 0..1
  onSuccess: {
    healthDelta: number;
    dvDelta: number;
    monthsDelta: number;
    costDeltaM: number;
    downlinkMult: number;
    powerMult?: number;
    scienceMult: number;
    killHungriestInstrument?: boolean;
    killRandomInstrumentChance?: number;
    logText: string;
  };
  onFail: {
    healthDelta: number;
    dvDelta: number;
    monthsDelta: number;
    costDeltaM: number;
    downlinkMult: number;
    powerMult?: number;
    scienceMult: number;
    killHungriestInstrument?: boolean;
    killRandomInstrumentChance?: number;
    fatalOnFail?: boolean;
    logText: string;
  };
}

export interface FlightEvent {
  kind: RandomEventKind;
  title: string;
  subtitle: string;
  options: EventOption[];
}

export interface FlightPhaseSpec {
  id: FlightPhaseId;
  index: number;
  name: string;
  shortName: string;
  durationMonths: number;
  kind: 'launch' | 'cruise' | 'arrival' | 'ops';
}

export interface FlightLogEntry {
  phaseId: FlightPhaseId;
  phaseName: string;
  status: 'nominal' | 'warning' | 'critical';
  headline: string;
  healthAfter: number;
  eventTitle?: string;
  chosenOption?: string;
  rollOdds?: number;
  rollSuccess?: boolean;
}

export interface TelemetryPoint {
  phaseId: FlightPhaseId | 'prelaunch';
  phaseLabel: string;
  month: number;
  powerW: number;
  massKg: number;
  dataRateKbps: number;
  health: number;
}

export interface FlightState {
  phaseIndex: number; // 0..6, or 7 when finished
  health: number; // 0..100
  deltaVSpare: number; // starts at metrics.deltaVMargin
  extraCostM: number;
  downlinkMultiplier: number; // starts 1.0
  powerMultiplier: number; // starts 1.0
  scienceBonusMultiplier: number; // starts 1.0
  lostInstrumentIds: string[];
  effectiveScienceMonths: number;
  scienceCollectedShares: number; // 0..3 completed Ops thirds
  dataDeliveredGb: number;
  telemetryHistory: TelemetryPoint[];
  pendingEvent: FlightEvent | null;
  logs: FlightLogEntry[];
  finished: boolean;
  survived: boolean;
  explosionReason?: string;
}

export function createPrelaunchTelemetryPoint(metrics: EngineeringMetrics): TelemetryPoint {
  const { power, antenna } = metrics.parts;
  const initialPowerW =
    power.kind === 'solar' ? Math.round(power.areaM2 * 150) : Math.round(power.basePowerW);
  const nearEarthRate = Math.min(20000, (6 * Math.pow(antenna.diameterM, 2) * antenna.txPowerW) / Math.pow(0.02, 2));
  return {
    phaseId: 'prelaunch',
    phaseLabel: 'Pad',
    month: 0,
    powerW: initialPowerW,
    massKg: Math.round(metrics.wetMassKg),
    dataRateKbps: Number(nearEarthRate.toFixed(1)),
    health: 100,
  };
}

function computePhaseTelemetryPoint(
  phase: FlightPhaseSpec,
  metrics: EngineeringMetrics,
  params: {
    health: number;
    deltaVSpare: number;
    downlinkMultiplier: number;
    powerMultiplier: number;
    prevMonth: number;
  },
): TelemetryPoint {
  const { mission, power, propulsion, antenna } = metrics.parts;
  const isIon = propulsion.id === 'ion';

  // Progress along Earth-to-Target trajectory (0..1)
  const progressByPhase: Record<FlightPhaseId, number> = {
    launch: 0.05,
    cruise_1: 0.38,
    cruise_2: 0.74,
    arrive: 1.0,
    ops_1: 1.0,
    ops_2: 1.0,
    ops_3: 1.0,
  };
  const p = progressByPhase[phase.id];

  // Burn fraction of mission required delta-v across phases
  const reqBurnFraction: Record<FlightPhaseId, number> = isIon
    ? {
        launch: 0.05,
        cruise_1: 0.4,
        cruise_2: 0.75,
        arrive: 1.0,
        ops_1: 1.0,
        ops_2: 1.0,
        ops_3: 1.0,
      }
    : {
        launch: 0.1,
        cruise_1: 0.45,
        cruise_2: 0.52,
        arrive: 1.0,
        ops_1: 1.0,
        ops_2: 1.0,
        ops_3: 1.0,
      };

  const stationKeepingDv =
    phase.id === 'ops_1' ? 12 : phase.id === 'ops_2' ? 24 : phase.id === 'ops_3' ? 36 : 0;
  const extraEventDv = Math.max(0, metrics.deltaVMargin - params.deltaVSpare);
  const dvBurned = Math.min(
    metrics.achievedDeltaV,
    mission.deltaVReq * reqBurnFraction[phase.id] + extraEventDv + stationKeepingDv,
  );
  const ve = propulsion.isp * GRAVITY_STANDARD;
  const remainingMass =
    ve > 0
      ? Math.max(metrics.dryMassKg, metrics.wetMassKg * Math.exp(-dvBurned / ve))
      : metrics.wetMassKg;

  // Power fluctuates with solar distance (1 -> target sunlightFraction), RTG gentle decay, power drops, and hull wear
  const baseEarthOrRtgW =
    power.kind === 'solar'
      ? power.areaM2 * 150 * (1 + (mission.sunlightFraction - 1) * p)
      : power.basePowerW * (1 - 0.004 * phase.index);
  const hullFactor = params.health <= 0 ? 0 : 0.88 + 0.12 * (params.health / 100);
  const powerW =
    params.health <= 0
      ? 0
      : Math.max(0, Math.round(baseEarthOrRtgW * params.powerMultiplier * hullFactor));

  // Data rate fluctuates with 1/AU^2 distance and antenna/storm downlink multiplier
  const currentAU =
    mission.distanceAU >= 0.02
      ? 0.02 + (mission.distanceAU - 0.02) * p
      : Math.max(0.0008, mission.distanceAU * Math.max(0.25, p));
  const rawRate = (6 * Math.pow(antenna.diameterM, 2) * antenna.txPowerW) / Math.pow(currentAU, 2);
  const dataRateKbps =
    params.health <= 0
      ? 0
      : Number((Math.min(20000, rawRate) * params.downlinkMultiplier).toFixed(1));

  const month = Number((params.prevMonth + phase.durationMonths).toFixed(1));

  return {
    phaseId: phase.id,
    phaseLabel: phase.name,
    month,
    powerW,
    massKg: Math.round(remainingMass),
    dataRateKbps,
    health: Math.round(params.health),
  };
}

export function buildFlightPhases(metrics: EngineeringMetrics): FlightPhaseSpec[] {
  const cruiseHalf = Math.max(0.25, Number((metrics.cruiseMonths / 2).toFixed(1)));
  const opsThird = Math.max(0.3, Number((metrics.scienceMonths / 3).toFixed(1)));
  return [
    {
      id: 'launch',
      index: 0,
      name: 'Launch',
      shortName: 'Launch',
      durationMonths: 0.1,
      kind: 'launch',
    },
    {
      id: 'cruise_1',
      index: 1,
      name: 'Cruise 1',
      shortName: 'Cruise',
      durationMonths: cruiseHalf,
      kind: 'cruise',
    },
    {
      id: 'cruise_2',
      index: 2,
      name: 'Cruise 2',
      shortName: 'Cruise',
      durationMonths: cruiseHalf,
      kind: 'cruise',
    },
    {
      id: 'arrive',
      index: 3,
      name: 'Arrive',
      shortName: 'Arrive',
      durationMonths: 0.2,
      kind: 'arrival',
    },
    {
      id: 'ops_1',
      index: 4,
      name: 'Ops 1',
      shortName: 'Ops',
      durationMonths: opsThird,
      kind: 'ops',
    },
    {
      id: 'ops_2',
      index: 5,
      name: 'Ops 2',
      shortName: 'Ops',
      durationMonths: opsThird,
      kind: 'ops',
    },
    {
      id: 'ops_3',
      index: 6,
      name: 'Ops 3',
      shortName: 'Ops',
      durationMonths: opsThird,
      kind: 'ops',
    },
  ];
}

function clampOdds(val: number): number {
  return Math.max(0.05, Math.min(1, Number(val.toFixed(2))));
}

export function buildRandomEvent(
  kind: RandomEventKind,
  metrics: EngineeringMetrics,
  flight: FlightState,
): FlightEvent {
  const { parts } = metrics;
  const rad = parts.mission.radiationLevel;
  const shield = parts.shielding.efficiency;
  const hasBackups = parts.redundancy.id !== 'single';
  const backupLevel =
    parts.redundancy.id === 'full' ? 2 : parts.redundancy.id === 'cross' ? 1 : 0;
  const isSmallDish = parts.antenna.id === 'small';

  switch (kind) {
    case 'solar_storm': {
      // damage chance = 0.2 x radiation x (1 - shield), capped cleanly
      const damageChance = Math.min(0.95, 0.2 * rad * (1 - shield));
      const keepGoingOdds = clampOdds(1 - damageChance);
      return {
        kind,
        title: 'Solar storm',
        subtitle: `${rad}x rad · ${Math.round(shield * 100)}% shield`,
        options: [
          {
            id: 'safe_mode',
            label: 'Safe mode (-3 wk)',
            oddsText: '100% safe',
            odds: 1.0,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: -0.75,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Safe mode held · -3 weeks',
            },
            onFail: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: -0.75,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Safe mode held · -3 weeks',
            },
          },
          {
            id: 'keep_going',
            label: 'Keep going',
            oddsText: `${Math.round(keepGoingOdds * 100)}% clean`,
            odds: keepGoingOdds,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1.04,
              logText: 'Rode storm · +4% bonus data',
            },
            onFail: {
              healthDelta: -18,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 0.6,
              scienceMult: 1,
              killRandomInstrumentChance: 0.55,
              logText: 'Storm hit · -40% downlink',
            },
          },
        ],
      };
    }

    case 'off_course': {
      const canAffordNow = flight.deltaVSpare >= 55;
      return {
        kind,
        title: 'Off course',
        subtitle: `Δv spare: ${Math.round(flight.deltaVSpare)} m/s`,
        options: [
          {
            id: 'fix_now',
            label: 'Fix now (-55 m/s)',
            oddsText: canAffordNow ? '100% on track' : 'Low Δv!',
            odds: canAffordNow ? 1.0 : 0.35,
            onSuccess: {
              healthDelta: 0,
              dvDelta: -55,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Course fixed · -55 m/s',
            },
            onFail: {
              healthDelta: -15,
              dvDelta: -55,
              monthsDelta: -1,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0.95,
              logText: 'Short burn · Δv depleted',
            },
          },
          {
            id: 'wait_trim',
            label: 'Wait & drift',
            oddsText: '65% cheap / 35% costly',
            odds: 0.65,
            onSuccess: {
              healthDelta: 0,
              dvDelta: -20,
              monthsDelta: -0.5,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Cheap trim · -20 m/s',
            },
            onFail: {
              healthDelta: 0,
              dvDelta: -135, // 110..160 midpoint
              monthsDelta: -1,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0.94,
              logText: 'Costly drift · -135 m/s',
            },
          },
        ],
      };
    }

    case 'computer_fault': {
      const backupOdds = hasBackups ? 0.92 : 0.25;
      const patchOdds = isSmallDish ? 0.62 : 0.92;
      return {
        kind,
        title: 'Computer fault',
        subtitle: `${parts.redundancy.name} CPU`,
        options: [
          {
            id: 'reboot',
            label: 'Reboot CPU',
            oddsText: '55% clear',
            odds: 0.55,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: -0.2,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Reboot clean',
            },
            onFail: {
              healthDelta: -18,
              dvDelta: 0,
              monthsDelta: -1,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0.92,
              logText: 'Reboot glitch · -18% hull',
            },
          },
          {
            id: 'backup_unit',
            label: 'Backup unit',
            oddsText: `${Math.round(backupOdds * 100)}% swap`,
            odds: backupOdds,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Backup unit active',
            },
            onFail: {
              healthDelta: -22,
              dvDelta: 0,
              monthsDelta: -1,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0.9,
              logText: 'No backup · -22% hull',
            },
          },
          {
            id: 'patch',
            label: isSmallDish ? 'Patch (slow)' : 'Upload patch',
            oddsText: `${Math.round(patchOdds * 100)}% ok`,
            odds: patchOdds,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: isSmallDish ? -2.0 : -0.5,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: isSmallDish ? 'Slow dish patch (-2 mo)' : 'Patch uploaded',
            },
            onFail: {
              healthDelta: -12,
              dvDelta: 0,
              monthsDelta: isSmallDish ? -3.0 : -1.0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0.92,
              logText: 'Patch timeout · -12% hull',
            },
          },
        ],
      };
    }

    case 'power_drop':
      return {
        kind,
        title: 'Power drop (-20%)',
        subtitle: `${Math.round(metrics.availablePowerW * 0.8)} W left`,
        options: [
          {
            id: 'shed_hungriest',
            label: 'Shed hungriest',
            oddsText: '100% stable',
            odds: 1.0,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              powerMult: 0.8,
              scienceMult: 1,
              killHungriestInstrument: true,
              logText: 'Top power sensor cut',
            },
            onFail: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              powerMult: 0.8,
              scienceMult: 1,
              killHungriestInstrument: true,
              logText: 'Top power sensor cut',
            },
          },
          {
            id: 'duty_cycle',
            label: 'Duty-cycle all',
            oddsText: '82% steady',
            odds: 0.82,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              powerMult: 0.8,
              scienceMult: 0.88,
              logText: 'Duty-cycled (-12% rate)',
            },
            onFail: {
              healthDelta: -12,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              powerMult: 0.74,
              scienceMult: 0.82,
              logText: 'Bus sag (-12% hull)',
            },
          },
        ],
      };

    case 'antenna_bumped':
      return {
        kind,
        title: 'Antenna bumped',
        subtitle: `${parts.antenna.name}`,
        options: [
          {
            id: 'drop_data',
            label: 'Drop data (-20%)',
            oddsText: '100% $0',
            odds: 1.0,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 0.8,
              scienceMult: 1,
              logText: 'Dropped 20% link data',
            },
            onFail: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 0.8,
              scienceMult: 1,
              logText: 'Dropped 20% link data',
            },
          },
          {
            id: 'pay_6m',
            label: 'Pay $6M',
            oddsText: '100% full link',
            odds: 1.0,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 6,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'DSN boost paid (+$6M)',
            },
            onFail: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 6,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'DSN boost paid (+$6M)',
            },
          },
        ],
      };

    case 'arrival_burn': {
      // Burn now: 94% + 2% per backup level. Check first: -15 m/s, +3%
      const burnNowOdds = clampOdds(0.94 + backupLevel * 0.02);
      const checkOdds = clampOdds(burnNowOdds + 0.03);
      return {
        kind,
        title: 'Arrival burn',
        subtitle: `Δv spare: ${Math.round(flight.deltaVSpare)} m/s`,
        options: [
          {
            id: 'burn_now',
            label: 'Burn now',
            oddsText: `${Math.round(burnNowOdds * 100)}% capture`,
            odds: burnNowOdds,
            onSuccess: {
              healthDelta: 0,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Orbit captured!',
            },
            onFail: {
              healthDelta: -100,
              dvDelta: 0,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0,
              fatalOnFail: true,
              logText: 'Missed capture orbit!',
            },
          },
          {
            id: 'check_first',
            label: 'Check first (-15 m/s)',
            oddsText: `${Math.round(checkOdds * 100)}% capture`,
            odds: checkOdds,
            onSuccess: {
              healthDelta: 0,
              dvDelta: -15,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 1,
              logText: 'Verified capture (-15 m/s)',
            },
            onFail: {
              healthDelta: -100,
              dvDelta: -15,
              monthsDelta: 0,
              costDeltaM: 0,
              downlinkMult: 1,
              scienceMult: 0,
              fatalOnFail: true,
              logText: 'Engine misfire at capture!',
            },
          },
        ],
      };
    }
  }
}

export function pickEventsForFlight(
  seedInput: string,
  metrics: EngineeringMetrics,
): Partial<Record<FlightPhaseId, RandomEventKind>> {
  const rng = createSeededRng(`${seedInput}::events::${metrics.parts.mission.id}`);
  const cruiseAndOpsKinds: RandomEventKind[] = [
    'solar_storm',
    'off_course',
    'computer_fault',
    'power_drop',
    'antenna_bumped',
  ];
  const pool = [...cruiseAndOpsKinds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const { difficulty } = metrics.parts;
  const candidatePhases: FlightPhaseId[] = ['cruise_1', 'cruise_2', 'ops_1', 'ops_2', 'ops_3'];
  const chosenPhases: FlightPhaseId[] = [];
  for (const p of candidatePhases) {
    if (rng() < difficulty.eventProbability && chosenPhases.length < difficulty.maxEvents) {
      chosenPhases.push(p);
    }
  }
  while (chosenPhases.length < difficulty.minEvents) {
    const pick = candidatePhases[Math.floor(rng() * candidatePhases.length)];
    if (!chosenPhases.includes(pick)) chosenPhases.push(pick);
  }

  const map: Partial<Record<FlightPhaseId, RandomEventKind>> = {
    arrive: 'arrival_burn', // Always run arrival burn check at Arrive!
  };
  chosenPhases.forEach((phaseId, idx) => {
    map[phaseId] = pool[idx % pool.length];
  });
  return map;
}

export function stepFlightPhase(
  prev: FlightState,
  metrics: EngineeringMetrics,
  phases: FlightPhaseSpec[],
  eventMap: Partial<Record<FlightPhaseId, RandomEventKind>>,
  seedInput: string,
): FlightState {
  if (prev.finished || prev.pendingEvent) return prev;
  const phase = phases[prev.phaseIndex];
  if (!phase) {
    return { ...prev, finished: true, survived: prev.health > 0 };
  }

  const rng = createSeededRng(`${seedInput}::phase::${phase.id}::${metrics.parts.mission.id}`);
  let health = prev.health;
  let status: FlightLogEntry['status'] = 'nominal';
  let headline = `${phase.name} clear`;
  let explosionReason: string | undefined;

  if (phase.kind === 'launch') {
    const launchRoll = rng();
    if (launchRoll > metrics.parts.rocket.reliability) {
      health = 0;
      status = 'critical';
      headline = `${metrics.parts.rocket.name} rocket failed!`;
      explosionReason = 'Booster failure';
    } else {
      headline = `${metrics.parts.rocket.name} liftoff nominal`;
    }
  } else {
    // Check Δv spare on arrival
    if (phase.kind === 'arrival' && prev.deltaVSpare < 0) {
      health = 0;
      status = 'critical';
      headline = 'Out of Δv at arrival!';
      explosionReason = 'Missed orbit';
    } else {
      // Latch-up hazard per phase = 0.012 x radiation x (1 - 0.8 x shield) x backup multiplier
      const phaseHazardProb = Math.min(0.85, metrics.baseHazardPerPhase);
      if (rng() < phaseHazardProb) {
        const dmg = Math.max(
          8,
          Math.round(10 + metrics.parts.mission.radiationLevel * 3 * (1 - 0.7 * metrics.parts.shielding.efficiency)),
        );
        health = Math.max(0, health - dmg);
        status = health <= 0 ? 'critical' : 'warning';
        headline = health <= 0 ? 'Radiation killed spacecraft!' : `Latch-up (-${dmg}% hull)`;
        if (health <= 0) explosionReason = 'Radiation latch-up';
      }
    }
  }

  const prevHistory =
    prev.telemetryHistory.length > 0
      ? prev.telemetryHistory
      : [createPrelaunchTelemetryPoint(metrics)];
  const prevMonth = prevHistory[prevHistory.length - 1]?.month ?? 0;

  if (health <= 0) {
    const fatalPoint = computePhaseTelemetryPoint(phase, metrics, {
      health: 0,
      deltaVSpare: prev.deltaVSpare,
      downlinkMultiplier: prev.downlinkMultiplier,
      powerMultiplier: prev.powerMultiplier,
      prevMonth,
    });
    return {
      ...prev,
      health: 0,
      phaseIndex: phases.length,
      finished: true,
      survived: false,
      explosionReason,
      telemetryHistory: [...prevHistory, fatalPoint],
      logs: [
        ...prev.logs,
        {
          phaseId: phase.id,
          phaseName: phase.name,
          status: 'critical',
          headline,
          healthAfter: 0,
        },
      ],
    };
  }

  const scheduledEventKind = eventMap[phase.id];
  if (scheduledEventKind) {
    const event = buildRandomEvent(scheduledEventKind, metrics, prev);
    return {
      ...prev,
      health,
      telemetryHistory: prevHistory,
      pendingEvent: event,
      logs: [
        ...prev.logs,
        {
          phaseId: phase.id,
          phaseName: phase.name,
          status: status === 'warning' ? 'warning' : 'nominal',
          headline: `${event.title}!`,
          healthAfter: health,
        },
      ],
    };
  }

  const isOps = phase.kind === 'ops';
  const nextShares = isOps ? prev.scienceCollectedShares + 1 : prev.scienceCollectedShares;
  const activeDownlink = metrics.monthlyDownlinkGb * prev.downlinkMultiplier;
  const activeInstData = metrics.parts.instruments
    .filter((i) => !prev.lostInstrumentIds.includes(i.id))
    .reduce((s, i) => s + i.dataGbPerMonth, 0);
  const phaseDataGb = isOps
    ? Math.min(activeDownlink, activeInstData) * phase.durationMonths
    : 0;
  const nextIndex = prev.phaseIndex + 1;
  const finished = nextIndex >= phases.length;

  const phasePoint = computePhaseTelemetryPoint(phase, metrics, {
    health,
    deltaVSpare: prev.deltaVSpare,
    downlinkMultiplier: prev.downlinkMultiplier,
    powerMultiplier: prev.powerMultiplier,
    prevMonth,
  });

  return {
    ...prev,
    phaseIndex: nextIndex,
    health,
    scienceCollectedShares: nextShares,
    dataDeliveredGb: prev.dataDeliveredGb + phaseDataGb,
    telemetryHistory: [...prevHistory, phasePoint],
    finished,
    survived: health > 0,
    logs: [
      ...prev.logs,
      {
        phaseId: phase.id,
        phaseName: phase.name,
        status,
        headline: isOps ? `${phase.name} · +${Math.round(phaseDataGb)} Gb` : headline,
        healthAfter: health,
      },
    ],
  };
}

export function resolveFlightEventChoice(
  prev: FlightState,
  optionId: string,
  metrics: EngineeringMetrics,
  phases: FlightPhaseSpec[],
  seedInput: string,
): FlightState {
  if (!prev.pendingEvent) return prev;
  const phase = phases[prev.phaseIndex];
  const option =
    prev.pendingEvent.options.find((o) => o.id === optionId) ?? prev.pendingEvent.options[0];
  const rng = createSeededRng(
    `${seedInput}::resolve::${phase.id}::${prev.pendingEvent.kind}::${option.id}`,
  );
  const roll = rng();
  const success = roll <= option.odds;
  const outcome = success ? option.onSuccess : option.onFail;

  let deltaVSpare = Math.round(prev.deltaVSpare + outcome.dvDelta);
  let health = Math.max(0, Math.min(100, prev.health + outcome.healthDelta));
  let explosionReason: string | undefined;

  // Rule: if delta-v spare drops below 0 on arrival/course burn, spacecraft is lost
  if (phase.kind === 'arrival' && deltaVSpare < 0) {
    health = 0;
    explosionReason = 'Out of Δv';
  }
  if (!success && option.onFail.fatalOnFail) {
    health = 0;
    explosionReason = 'Capture burn failed';
  }

  const lostSet = new Set(prev.lostInstrumentIds);
  const liveInstruments = metrics.parts.instruments.filter((i) => !lostSet.has(i.id));
  let killedName = '';

  if (outcome.killHungriestInstrument && liveInstruments.length > 0) {
    const hungriest = [...liveInstruments].sort((a, b) => b.powerW - a.powerW)[0];
    lostSet.add(hungriest.id);
    killedName = hungriest.shortName;
  } else if (
    outcome.killRandomInstrumentChance &&
    liveInstruments.length > 0 &&
    rng() < outcome.killRandomInstrumentChance
  ) {
    const victim = liveInstruments[Math.floor(rng() * liveInstruments.length)];
    lostSet.add(victim.id);
    killedName = victim.shortName;
  }

  const lostInstrumentIds = Array.from(lostSet);
  const extraCostM = prev.extraCostM + outcome.costDeltaM;
  const downlinkMultiplier = Math.max(0.2, prev.downlinkMultiplier * outcome.downlinkMult);
  const powerMultiplier = Math.max(0.25, prev.powerMultiplier * (outcome.powerMult ?? 1));
  const effectiveScienceMonths = Math.max(0.5, prev.effectiveScienceMonths + outcome.monthsDelta);
  const scienceBonusMultiplier = Math.max(
    0.4,
    Math.min(1.15, prev.scienceBonusMultiplier * outcome.scienceMult),
  );

  const survived = health > 0;
  const isOps = phase.kind === 'ops';
  const nextShares = survived && isOps ? prev.scienceCollectedShares + 1 : prev.scienceCollectedShares;
  const activeDownlink = metrics.monthlyDownlinkGb * downlinkMultiplier;
  const activeInstData = metrics.parts.instruments
    .filter((i) => !lostSet.has(i.id))
    .reduce((s, i) => s + i.dataGbPerMonth, 0);
  const phaseDataGb =
    survived && isOps ? Math.min(activeDownlink, activeInstData) * phase.durationMonths : 0;

  const nextIndex = survived ? prev.phaseIndex + 1 : phases.length;
  const finished = !survived || nextIndex >= phases.length;

  const extraNote = killedName ? ` (${killedName} lost!)` : '';

  const prevHistory =
    prev.telemetryHistory.length > 0
      ? prev.telemetryHistory
      : [createPrelaunchTelemetryPoint(metrics)];
  const prevMonth = prevHistory[prevHistory.length - 1]?.month ?? 0;
  const phasePoint = computePhaseTelemetryPoint(phase, metrics, {
    health,
    deltaVSpare,
    downlinkMultiplier,
    powerMultiplier,
    prevMonth,
  });

  return {
    ...prev,
    phaseIndex: nextIndex,
    health,
    deltaVSpare,
    extraCostM,
    downlinkMultiplier,
    powerMultiplier,
    lostInstrumentIds,
    effectiveScienceMonths,
    scienceBonusMultiplier,
    scienceCollectedShares: nextShares,
    dataDeliveredGb: prev.dataDeliveredGb + phaseDataGb,
    telemetryHistory: [...prevHistory, phasePoint],
    pendingEvent: null,
    finished,
    survived,
    explosionReason,
    logs: [
      ...prev.logs,
      {
        phaseId: phase.id,
        phaseName: phase.name,
        status: !survived ? 'critical' : success ? 'nominal' : 'warning',
        headline: `${outcome.logText}${extraNote}`,
        healthAfter: health,
        eventTitle: prev.pendingEvent.title,
        chosenOption: option.label,
        rollOdds: Math.round(option.odds * 100),
        rollSuccess: success,
      },
    ],
  };
}

// ============================================================================
// Debrief Scoring (Exact Formula: 75 Science, 10 Survival, 15 Savings)
// ============================================================================

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

export interface DebriefLesson {
  icon: 'shield' | 'zap' | 'radio' | 'flask' | 'fuel' | 'coins';
  text: string;
  tone: 'positive' | 'warning' | 'info';
}

export interface DebriefResult {
  totalScore: number;
  scienceScore: number; // out of 75
  survivalScore: number; // out of 10
  budgetScore: number; // out of 15
  grade: GradeLetter;
  finalScienceFraction: number;
  finalCostTotal: number;
  lessons: DebriefLesson[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computeDebrief(
  metrics: EngineeringMetrics,
  flight: FlightState,
): DebriefResult {
  const { parts } = metrics;

  // Surviving instruments contribute to final science
  const survivingInstruments = parts.instruments.filter(
    (inst) => !flight.lostInstrumentIds.includes(inst.id),
  );
  const sumSurvivingValues = survivingInstruments.reduce(
    (s, inst) => s + inst.values[parts.mission.id],
    0,
  );
  const instFraction =
    metrics.topFourValues > 0 ? Math.min(1, sumSurvivingValues / metrics.topFourValues) : 0;

  const monthlySurvivingDataGb = survivingInstruments.reduce(
    (s, i) => s + i.dataGbPerMonth,
    0,
  );
  const effectiveDownlinkGb = metrics.monthlyDownlinkGb * flight.downlinkMultiplier;
  const dataReturned =
    survivingInstruments.length === 0
      ? 0
      : monthlySurvivingDataGb > 0
        ? Math.min(1, effectiveDownlinkGb / monthlySurvivingDataGb)
        : 1;

  const timeFraction =
    parts.mission.monthsNeeded > 0
      ? Math.min(1, flight.effectiveScienceMonths / parts.mission.monthsNeeded)
      : 0;

  const collectedShareFraction = flight.scienceCollectedShares / 3;
  const hasSampler = survivingInstruments.some((i) => i.id === 'sampler');
  const samplerMult = parts.mission.requiresSampler && !hasSampler ? 0.4 : 1.0;

  const rawScience =
    instFraction *
    dataReturned *
    timeFraction *
    samplerMult *
    flight.scienceBonusMultiplier *
    collectedShareFraction;

  const finalScienceFraction = clamp(rawScience, 0, 1);
  const scienceScore = Math.round(finalScienceFraction * 75);
  const survivalScore = flight.survived ? 10 : 0;

  // Score = 75 x science + 10 if survived + 15 x clamp(unspent budget / (25% of budget), 0, 1)
  const finalCostTotal = Number((metrics.cost.total + flight.extraCostM).toFixed(1));
  const unspent = Math.max(0, metrics.effectiveBudgetCap - finalCostTotal);
  const savingsFraction =
    metrics.effectiveBudgetCap > 0
      ? clamp(unspent / (0.25 * metrics.effectiveBudgetCap), 0, 1)
      : 0;
  const budgetScore = Math.round(15 * savingsFraction);

  const totalScore = Math.min(100, scienceScore + survivalScore + budgetScore);

  const grade: GradeLetter =
    totalScore >= 85
      ? 'S'
      : totalScore >= 70
        ? 'A'
        : totalScore >= 55
          ? 'B'
          : totalScore >= 40
            ? 'C'
            : 'D';

  // Build 1 to 3 short, icon-led lessons based on actual build & flight
  const lessons: DebriefLesson[] = [];

  if (!flight.survived) {
    if (flight.explosionReason?.includes('Radiation') || parts.mission.radiationLevel >= 3) {
      lessons.push({
        icon: 'shield',
        text: 'Radiation won. Add vault and backups.',
        tone: 'warning',
      });
    } else if (flight.explosionReason?.includes('Δv') || flight.explosionReason?.includes('orbit')) {
      lessons.push({
        icon: 'fuel',
        text: 'Fuel ran dry. Add more Δv.',
        tone: 'warning',
      });
    } else {
      lessons.push({
        icon: 'shield',
        text: 'Rocket failed. Pick higher reliability.',
        tone: 'warning',
      });
    }
  }

  if (parts.mission.requiresSampler && !hasSampler) {
    lessons.push({
      icon: 'flask',
      text: 'Sampler missing. Science cut to 40%.',
      tone: 'warning',
    });
  }

  if (dataReturned < 0.75) {
    lessons.push({
      icon: 'radio',
      text: `${Math.round((1 - dataReturned) * 100)}% data stranded. Use larger dish.`,
      tone: 'warning',
    });
  }

  const reqPower = Math.max(metrics.averageDrawW, metrics.ionPowerRequiredW);
  if (metrics.availablePowerW > 0 && reqPower / metrics.availablePowerW < 0.35) {
    const unusedPct = Math.round((1 - reqPower / metrics.availablePowerW) * 100);
    lessons.push({
      icon: 'zap',
      text: `${unusedPct}% of power unused. Trim the array.`,
      tone: 'info',
    });
  }

  if (parts.propulsion.id === 'ion' && flight.effectiveScienceMonths < parts.mission.monthsNeeded) {
    lessons.push({
      icon: 'fuel',
      text: 'Ion cruise too slow. Try chemical.',
      tone: 'warning',
    });
  }

  if (lessons.length === 0) {
    lessons.push({
      icon: 'flask',
      text:
        grade === 'S' || grade === 'A'
          ? 'Balanced craft. Top science delivered.'
          : 'Try higher-value sensors for S rank.',
      tone: grade === 'S' || grade === 'A' ? 'positive' : 'info',
    });
  }

  if (lessons.length < 2 && budgetScore >= 12) {
    lessons.push({
      icon: 'coins',
      text: `Smart budget. Saved $${unspent.toFixed(0)}M.`,
      tone: 'positive',
    });
  }

  return {
    totalScore,
    scienceScore,
    survivalScore,
    budgetScore,
    grade,
    finalScienceFraction,
    finalCostTotal,
    lessons: lessons.slice(0, 3),
  };
}

// ============================================================================
// localStorage Best Scores per Target (wrapped safely in try/catch)
// ============================================================================

const BEST_SCORE_STORAGE_KEY = 'mission_architect_best_scores_v1';

export type BestScoresMap = Partial<Record<string, { score: number; grade: GradeLetter }>>;

export function loadBestScores(): BestScoresMap {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBestScore(
  missionId: string,
  score: number,
  grade: GradeLetter,
): BestScoresMap {
  const current = loadBestScores();
  const prev = current[missionId];
  if (!prev || score > prev.score) {
    const updated: BestScoresMap = {
      ...current,
      [missionId]: { score, grade },
    };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // Ignore storage quota / privacy errors
    }
    return updated;
  }
  return current;
}

// ============================================================================
// localStorage Spacecraft Draft Save & Load (wrapped safely in try/catch)
// ============================================================================

const DRAFT_STORAGE_KEY = 'mission_architect_draft_v1';

export interface SavedDraft {
  config: SpacecraftConfig;
  step: StepId;
  savedAt: number;
}

export function loadSavedDraft(): SavedDraft | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedDraft> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.config) return null;
    const mergedConfig: SpacecraftConfig = {
      ...DEFAULT_CONFIG,
      ...parsed.config,
      instruments: Array.isArray(parsed.config.instruments)
        ? parsed.config.instruments
        : DEFAULT_CONFIG.instruments,
    };
    const validMission = MISSIONS.some((m) => m.id === mergedConfig.missionId);
    if (!validMission) return null;
    const stepVal: StepId = parsed.step === 3 ? 3 : 2;
    return {
      config: mergedConfig,
      step: stepVal,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveCraftDraft(config: SpacecraftConfig, step: StepId): SavedDraft {
  const draft: SavedDraft = {
    config,
    step: step === 3 ? 3 : 2,
    savedAt: Date.now(),
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  } catch {
    // Ignore storage quota / privacy errors
  }
  return draft;
}

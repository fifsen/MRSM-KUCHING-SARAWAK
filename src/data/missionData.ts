export type MissionId = 'lunar' | 'mars' | 'asteroid' | 'europa';
export type BusSize = 'small' | 'medium' | 'large';
export type PowerOptionId = 'solar_3' | 'solar_8' | 'solar_18' | 'rtg_1' | 'rtg_2' | 'rtg_3';
export type PropulsionType = 'chemical' | 'ion';
export type AntennaSize = 'small' | 'medium' | 'large';
export type ShieldingLevel = 'none' | 'standard' | 'vault';
export type RedundancyLevel = 'single' | 'cross' | 'full';
export type RocketId = 'light' | 'medium' | 'heavy' | 'super_heavy';
export type DifficultyId = 'training' | 'standard' | 'hardcore';
export type StepId = 1 | 2 | 3 | 4 | 5 | 6;

export const OPS_COST_PER_MONTH = 2.0; // $2M/month mission operations
export const AUTO_FUEL_RESERVE_DV = 200; // Auto-fuel targets required dv + 200 m/s
export const MIN_REVIEW_SPARE_DV = 150; // Review requires >= 150 m/s spare

export interface DifficultySpec {
  id: DifficultyId;
  name: string;
  budgetMultiplier: number;
  hazardMultiplier: number;
  eventProbability: number;
  minEvents: number;
  maxEvents: number;
}

export interface MissionTarget {
  id: MissionId;
  name: string;
  difficultyStars: 1 | 2 | 3 | 4;
  deltaVReq: number; // m/s
  distanceAU: number;
  sunlightFraction: number;
  radiationLevel: number;
  budgetCap: number; // $M
  missionWindow: number; // total months
  monthsNeeded: number; // science months needed
  chemCruiseMonths: number;
  ionCruiseMonths: number;
  requiresSampler?: boolean;
  noteChip?: string;
}

export interface BusSpec {
  id: BusSize;
  name: string;
  massKg: number;
  powerW: number;
  costM: number;
  payloadCapacityKg: number;
  maxPropellantKg: number;
  dimensionsLabel: string;
}

export interface PowerSpec {
  id: PowerOptionId;
  kind: 'solar' | 'rtg';
  name: string;
  areaM2: number;
  rtgCount: number;
  basePowerW: number;
  massKg: number;
  costM: number;
}

export interface PropulsionSpec {
  id: PropulsionType;
  name: string;
  isp: number;
  engineMassKg: number;
  costM: number;
  tankFraction: number; // 0.08 chemical, 0.12 ion
  propCostPerKg: number; // $0.02M chemical, $0.05M ion
  cruisePowerW: number; // 0 chemical, 700 ion (+ bus power)
}

export interface AntennaSpec {
  id: AntennaSize;
  name: string;
  diameterM: number;
  txPowerW: number;
  massKg: number;
  powerW: number; // draw for average power equation (dish power / 3)
  costM: number;
}

export interface ShieldingSpec {
  id: ShieldingLevel;
  name: string;
  efficiency: number; // 0, 0.5, 0.85
  massKg: number;
  costM: number;
}

export interface RedundancySpec {
  id: RedundancyLevel;
  name: string;
  massFraction: number; // +0%, +8%, +18% of bus mass
  costFraction: number; // +0%, +12%, +28% of bus cost
  multiplier: number; // 1.0, 0.6, 0.35
  arrivalBonusPct: number; // 0, 2, 4 -> 94% + 2% per backup level
}

export interface InstrumentSpec {
  id: string;
  name: string;
  shortName: string;
  massKg: number;
  powerW: number;
  dataGbPerMonth: number;
  costM: number;
  values: Record<MissionId, number>; // 0..10
}

export interface RocketSpec {
  id: RocketId;
  name: string;
  capacityKg: number;
  costM: number;
  reliability: number;
}

export interface SpacecraftConfig {
  difficulty: DifficultyId;
  missionId: MissionId;
  bus: BusSize;
  power: PowerOptionId;
  propulsion: PropulsionType;
  propellantKg: number;
  autoFuel: boolean;
  antenna: AntennaSize;
  shielding: ShieldingLevel;
  redundancy: RedundancyLevel;
  instruments: string[];
  rocket: RocketId;
}

export const DIFFICULTIES: DifficultySpec[] = [
  {
    id: 'training',
    name: 'Training',
    budgetMultiplier: 1.2,
    hazardMultiplier: 0.65,
    eventProbability: 0.35,
    minEvents: 1,
    maxEvents: 2,
  },
  {
    id: 'standard',
    name: 'Standard',
    budgetMultiplier: 1.0,
    hazardMultiplier: 1.0,
    eventProbability: 0.58,
    minEvents: 2,
    maxEvents: 4,
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    budgetMultiplier: 0.85,
    hazardMultiplier: 1.45,
    eventProbability: 0.82,
    minEvents: 3,
    maxEvents: 5,
  },
];

export const MISSIONS: MissionTarget[] = [
  {
    id: 'lunar',
    name: 'Lunar Orbiter',
    difficultyStars: 1,
    deltaVReq: 4100,
    distanceAU: 0.0026,
    sunlightFraction: 1.0,
    radiationLevel: 1.0,
    budgetCap: 420,
    missionWindow: 18,
    monthsNeeded: 12,
    chemCruiseMonths: 0.5,
    ionCruiseMonths: 9,
  },
  {
    id: 'mars',
    name: 'Mars Orbiter',
    difficultyStars: 2,
    deltaVReq: 5000,
    distanceAU: 1.5,
    sunlightFraction: 0.43,
    radiationLevel: 1.2,
    budgetCap: 560,
    missionWindow: 36,
    monthsNeeded: 24,
    chemCruiseMonths: 8,
    ionCruiseMonths: 16,
  },
  {
    id: 'asteroid',
    name: 'Asteroid Sampler',
    difficultyStars: 3,
    deltaVReq: 5600,
    distanceAU: 1.3,
    sunlightFraction: 0.55,
    radiationLevel: 1.5,
    budgetCap: 600,
    missionWindow: 48,
    monthsNeeded: 20,
    chemCruiseMonths: 14,
    ionCruiseMonths: 22,
    requiresSampler: true,
    noteChip: 'Needs Sampler',
  },
  {
    id: 'europa',
    name: 'Europa Explorer',
    difficultyStars: 4,
    deltaVReq: 5200,
    distanceAU: 5.2,
    sunlightFraction: 0.037,
    radiationLevel: 6.0,
    budgetCap: 1500,
    missionWindow: 108,
    monthsNeeded: 30,
    chemCruiseMonths: 72,
    ionCruiseMonths: 100,
  },
];

export const BUSES: BusSpec[] = [
  {
    id: 'small',
    name: 'Small Bus',
    massKg: 120,
    powerW: 40,
    costM: 40,
    payloadCapacityKg: 50,
    maxPropellantKg: 12000,
    dimensionsLabel: '1.1m × 1.1m',
  },
  {
    id: 'medium',
    name: 'Medium Bus',
    massKg: 250,
    powerW: 70,
    costM: 80,
    payloadCapacityKg: 110,
    maxPropellantKg: 12000,
    dimensionsLabel: '1.8m × 1.6m',
  },
  {
    id: 'large',
    name: 'Large Bus',
    massKg: 480,
    powerW: 120,
    costM: 140,
    payloadCapacityKg: 220,
    maxPropellantKg: 12000,
    dimensionsLabel: '2.6m × 2.3m',
  },
];

export const POWER_OPTIONS: PowerSpec[] = [
  {
    id: 'solar_3',
    kind: 'solar',
    name: 'Solar 3 m²',
    areaM2: 3,
    rtgCount: 0,
    basePowerW: 450,
    massKg: 12,
    costM: 5,
  },
  {
    id: 'solar_8',
    kind: 'solar',
    name: 'Solar 8 m²',
    areaM2: 8,
    rtgCount: 0,
    basePowerW: 1200,
    massKg: 32,
    costM: 11,
  },
  {
    id: 'solar_18',
    kind: 'solar',
    name: 'Solar 18 m²',
    areaM2: 18,
    rtgCount: 0,
    basePowerW: 2700,
    massKg: 72,
    costM: 22,
  },
  {
    id: 'rtg_1',
    kind: 'rtg',
    name: 'RTG ×1',
    areaM2: 0,
    rtgCount: 1,
    basePowerW: 110,
    massKg: 45,
    costM: 90,
  },
  {
    id: 'rtg_2',
    kind: 'rtg',
    name: 'RTG ×2',
    areaM2: 0,
    rtgCount: 2,
    basePowerW: 220,
    massKg: 90,
    costM: 170,
  },
  {
    id: 'rtg_3',
    kind: 'rtg',
    name: 'RTG ×3',
    areaM2: 0,
    rtgCount: 3,
    basePowerW: 330,
    massKg: 135,
    costM: 245,
  },
];

export const PROPULSION_OPTIONS: PropulsionSpec[] = [
  {
    id: 'chemical',
    name: 'Chemical',
    isp: 320,
    engineMassKg: 25,
    costM: 20,
    tankFraction: 0.08,
    propCostPerKg: 0.02,
    cruisePowerW: 0,
  },
  {
    id: 'ion',
    name: 'Ion Drive',
    isp: 3000,
    engineMassKg: 45,
    costM: 45,
    tankFraction: 0.12,
    propCostPerKg: 0.05,
    cruisePowerW: 700,
  },
];

export const ANTENNAS: AntennaSpec[] = [
  {
    id: 'small',
    name: 'Small Dish',
    diameterM: 0.5,
    txPowerW: 15,
    massKg: 6,
    powerW: 25,
    costM: 8,
  },
  {
    id: 'medium',
    name: 'Medium Dish',
    diameterM: 1.5,
    txPowerW: 35,
    massKg: 22,
    powerW: 60,
    costM: 18,
  },
  {
    id: 'large',
    name: 'Large Dish',
    diameterM: 3.0,
    txPowerW: 80,
    massKg: 55,
    powerW: 130,
    costM: 35,
  },
];

export const SHIELDING_OPTIONS: ShieldingSpec[] = [
  {
    id: 'none',
    name: 'None',
    efficiency: 0,
    massKg: 0,
    costM: 0,
  },
  {
    id: 'standard',
    name: 'Standard',
    efficiency: 0.5,
    massKg: 25,
    costM: 10,
  },
  {
    id: 'vault',
    name: 'Vault',
    efficiency: 0.85,
    massKg: 70,
    costM: 40,
  },
];

export const REDUNDANCY_OPTIONS: RedundancySpec[] = [
  {
    id: 'single',
    name: 'Single',
    massFraction: 0,
    costFraction: 0,
    multiplier: 1.0,
    arrivalBonusPct: 0,
  },
  {
    id: 'cross',
    name: 'Cross-strapped',
    massFraction: 0.08,
    costFraction: 0.12,
    multiplier: 0.6,
    arrivalBonusPct: 2,
  },
  {
    id: 'full',
    name: 'Full Backup',
    massFraction: 0.18,
    costFraction: 0.28,
    multiplier: 0.35,
    arrivalBonusPct: 4,
  },
];

export const INSTRUMENTS: InstrumentSpec[] = [
  {
    id: 'camera',
    name: 'Camera',
    shortName: 'Camera',
    massKg: 18,
    powerW: 35,
    dataGbPerMonth: 90,
    costM: 25,
    values: { lunar: 9, mars: 9, asteroid: 8, europa: 8 },
  },
  {
    id: 'spectrometer',
    name: 'Spectrometer',
    shortName: 'Spec',
    massKg: 12,
    powerW: 22,
    dataGbPerMonth: 25,
    costM: 30,
    values: { lunar: 8, mars: 10, asteroid: 9, europa: 8 },
  },
  {
    id: 'radar',
    name: 'Radar',
    shortName: 'Radar',
    massKg: 40,
    powerW: 90,
    dataGbPerMonth: 140,
    costM: 55,
    values: { lunar: 6, mars: 8, asteroid: 3, europa: 10 },
  },
  {
    id: 'magnetometer',
    name: 'Magnetometer',
    shortName: 'Mag',
    massKg: 3,
    powerW: 5,
    dataGbPerMonth: 1,
    costM: 8,
    values: { lunar: 4, mars: 5, asteroid: 6, europa: 10 },
  },
  {
    id: 'neutron',
    name: 'Neutron detector',
    shortName: 'Neutron',
    massKg: 15,
    powerW: 20,
    dataGbPerMonth: 4,
    costM: 22,
    values: { lunar: 10, mars: 8, asteroid: 8, europa: 5 },
  },
  {
    id: 'thermal',
    name: 'Thermal imager',
    shortName: 'Thermal',
    massKg: 9,
    powerW: 15,
    dataGbPerMonth: 25,
    costM: 16,
    values: { lunar: 8, mars: 9, asteroid: 7, europa: 7 },
  },
  {
    id: 'plasma',
    name: 'Plasma detector',
    shortName: 'Plasma',
    massKg: 8,
    powerW: 10,
    dataGbPerMonth: 3,
    costM: 14,
    values: { lunar: 3, mars: 6, asteroid: 5, europa: 9 },
  },
  {
    id: 'altimeter',
    name: 'Laser altimeter',
    shortName: 'Altimeter',
    massKg: 14,
    powerW: 28,
    dataGbPerMonth: 8,
    costM: 20,
    values: { lunar: 10, mars: 8, asteroid: 9, europa: 6 },
  },
  {
    id: 'sampler',
    name: 'Sampler',
    shortName: 'Sampler',
    massKg: 60,
    powerW: 40,
    dataGbPerMonth: 0,
    costM: 85,
    values: { lunar: 4, mars: 2, asteroid: 10, europa: 2 },
  },
];

export const ROCKETS: RocketSpec[] = [
  {
    id: 'light',
    name: 'Light',
    capacityKg: 600,
    costM: 15,
    reliability: 0.92,
  },
  {
    id: 'medium',
    name: 'Medium',
    capacityKg: 3000,
    costM: 55,
    reliability: 0.95,
  },
  {
    id: 'heavy',
    name: 'Heavy',
    capacityKg: 9000,
    costM: 120,
    reliability: 0.96,
  },
  {
    id: 'super_heavy',
    name: 'Super-heavy',
    capacityKg: 22000,
    costM: 260,
    reliability: 0.97,
  },
];

export const DEFAULT_CONFIG: SpacecraftConfig = {
  difficulty: 'standard',
  missionId: 'lunar',
  bus: 'small',
  power: 'solar_3',
  propulsion: 'chemical',
  propellantKg: 1020,
  autoFuel: true,
  antenna: 'small',
  shielding: 'standard',
  redundancy: 'cross',
  instruments: ['neutron', 'altimeter', 'thermal'],
  rocket: 'medium',
};

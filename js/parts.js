import { CELL_SIZE, GRAVITY, WATER_DENSITY } from './constants.js';

const cubeVolume = CELL_SIZE ** 3;
const maxBuoyancyPerCell = WATER_DENSITY * GRAVITY * cubeVolume;

export const PARTS = {
  block: {
    id: 'block',
    name: 'Hull Block',
    color: '#788a9a',
    mass: 72,
    volume: cubeVolume,
    buoyancyVolume: cubeVolume,
    description: 'Main buoyant hull cell.',
    tags: ['buoyant', 'structure'],
  },
  gun: {
    id: 'gun',
    name: 'Gun',
    color: '#b08c54',
    mass: 98,
    volume: cubeVolume,
    buoyancyVolume: cubeVolume * 0.92,
    description: 'Heavy deck fitting that raises top-side mass.',
    tags: ['weight'],
  },
  boiler: {
    id: 'boiler',
    name: 'Boiler',
    color: '#a95d3d',
    mass: 92,
    volume: cubeVolume,
    buoyancyVolume: cubeVolume * 0.95,
    enginePower: 1,
    description: 'Adds engine power for propellers.',
    tags: ['engine'],
  },
  propeller: {
    id: 'propeller',
    name: 'Propeller',
    color: '#e2a84a',
    mass: 42,
    volume: cubeVolume,
    buoyancyVolume: cubeVolume * 0.65,
    thrust: 1650,
    dragBoost: 18,
    description: 'Provides thrust while submerged.',
    tags: ['propulsion'],
  },
  rudder: {
    id: 'rudder',
    name: 'Rudder',
    color: '#d36f6f',
    mass: 30,
    volume: cubeVolume,
    buoyancyVolume: cubeVolume * 0.55,
    steerPower: 540,
    dragBoost: 12,
    description: 'Generates turning force in water flow.',
    tags: ['steering'],
  },
};

export const PART_ORDER = ['block', 'gun', 'boiler', 'propeller', 'rudder'];

export function getPartDefinition(partId) {
  return PARTS[partId] ?? PARTS.block;
}

export function estimateFloatMargin(partId) {
  const part = getPartDefinition(partId);
  const maxLiftMassEquivalent = (WATER_DENSITY * part.buoyancyVolume);
  return maxLiftMassEquivalent - part.mass;
}

export function getPartStatsText(partId) {
  const part = getPartDefinition(partId);
  const floatMargin = estimateFloatMargin(partId);
  const floatLabel = floatMargin >= 0 ? 'floats' : 'sinks';
  return `${part.name}: ${part.mass.toFixed(0)}kg, ${floatLabel} margin ${floatMargin.toFixed(0)}kg/cell, max cell buoyancy ${(maxBuoyancyPerCell).toFixed(0)}N.`;
}

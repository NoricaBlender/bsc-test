import { CELL_SIZE } from './constants.js';

function keyFromCoords(x, y, z) {
  return `${x},${y},${z}`;
}

function parseKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

export class ShipBlueprint {
  constructor() {
    this.parts = new Map();
  }

  clone() {
    const copy = new ShipBlueprint();
    for (const [key, value] of this.parts.entries()) {
      copy.parts.set(key, { ...value });
    }
    return copy;
  }

  clear() {
    this.parts.clear();
  }

  setPart(x, y, z, partId) {
    const key = keyFromCoords(x, y, z);
    this.parts.set(key, { key, x, y, z, partId });
    return this.parts.get(key);
  }

  removePart(x, y, z) {
    return this.parts.delete(keyFromCoords(x, y, z));
  }

  getPart(x, y, z) {
    return this.parts.get(keyFromCoords(x, y, z)) ?? null;
  }

  hasPart(x, y, z) {
    return this.parts.has(keyFromCoords(x, y, z));
  }

  entries() {
    return Array.from(this.parts.values());
  }

  isEmpty() {
    return this.parts.size === 0;
  }

  toJSON() {
    return this.entries();
  }

  loadFromArray(items) {
    this.clear();
    for (const item of items) {
      this.setPart(item.x, item.y, item.z, item.partId);
    }
  }

  getBounds() {
    const items = this.entries();
    if (items.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
    }
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const part of items) {
      min.x = Math.min(min.x, part.x);
      min.y = Math.min(min.y, part.y);
      min.z = Math.min(min.z, part.z);
      max.x = Math.max(max.x, part.x);
      max.y = Math.max(max.y, part.y);
      max.z = Math.max(max.z, part.z);
    }
    return { min, max };
  }

  getBlockCount() {
    return this.parts.size;
  }
}

export function gridToLocalPosition(x, y, z) {
  return new BABYLON.Vector3(x * CELL_SIZE, y * CELL_SIZE, z * CELL_SIZE);
}

export function localPositionToGrid(vec) {
  return {
    x: Math.round(vec.x / CELL_SIZE),
    y: Math.round(vec.y / CELL_SIZE),
    z: Math.round(vec.z / CELL_SIZE),
  };
}

export function buildSampleBlueprint() {
  const bp = new ShipBlueprint();

  const hull = [
    [-1, 0, -4], [0, 0, -4], [1, 0, -4],
    [-1, 0, -3], [0, 0, -3], [1, 0, -3],
    [-2, 0, -2], [-1, 0, -2], [0, 0, -2], [1, 0, -2], [2, 0, -2],
    [-2, 0, -1], [-1, 0, -1], [0, 0, -1], [1, 0, -1], [2, 0, -1],
    [-2, 0, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0],
    [-2, 0, 1], [-1, 0, 1], [0, 0, 1], [1, 0, 1], [2, 0, 1],
    [-1, 0, 2], [0, 0, 2], [1, 0, 2],
    [-1, 1, -1], [0, 1, -1], [1, 1, -1],
    [0, 1, 0],
  ];

  for (const [x, y, z] of hull) {
    bp.setPart(x, y, z, 'block');
  }

  bp.setPart(0, 1, -2, 'gun');
  bp.setPart(0, 1, 1, 'boiler');
  bp.setPart(-1, 0, 3, 'propeller');
  bp.setPart(1, 0, 3, 'propeller');
  bp.setPart(0, 0, 4, 'rudder');

  return bp;
}

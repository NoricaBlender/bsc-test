import { CELL_SIZE } from './constants.js';
import { getPartDefinition } from './parts.js';
import { gridToLocalPosition } from './shipBlueprint.js';

function makeColor3(hex) {
  return BABYLON.Color3.FromHexString(hex);
}

export class ShipRenderer {
  constructor(scene) {
    this.scene = scene;
    this.materials = new Map();
  }

  getMaterial(partId, options = {}) {
    const key = `${partId}:${options.ghost ? 'ghost' : 'solid'}`;
    if (this.materials.has(key)) {
      return this.materials.get(key);
    }
    const part = getPartDefinition(partId);
    const mat = new BABYLON.StandardMaterial(`mat-${key}`, this.scene);
    const color = makeColor3(part.color);
    mat.diffuseColor = color;
    mat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    if (options.ghost) {
      mat.alpha = 0.45;
      mat.emissiveColor = color.scale(0.25);
    }
    this.materials.set(key, mat);
    return mat;
  }

  createPartMesh(part, parent, options = {}) {
    const def = getPartDefinition(part.partId);
    const meshName = `${def.id}-${part.x}-${part.y}-${part.z}`;
    let mesh;

    switch (part.partId) {
      case 'gun':
        mesh = this.createGunMesh(meshName, parent, options);
        break;
      case 'boiler':
        mesh = this.createBoilerMesh(meshName, parent, options);
        break;
      case 'propeller':
        mesh = this.createPropellerMesh(meshName, parent, options);
        break;
      case 'rudder':
        mesh = this.createRudderMesh(meshName, parent, options);
        break;
      case 'block':
      default:
        mesh = BABYLON.MeshBuilder.CreateBox(meshName, { size: CELL_SIZE * 0.98 }, this.scene);
        mesh.material = this.getMaterial(part.partId, options);
        break;
    }

    mesh.position.copyFrom(gridToLocalPosition(part.x, part.y, part.z));
    mesh.metadata = { ...part, partId: part.partId };
    mesh.isPickable = !options.nonPickable;
    if (parent) mesh.parent = parent;
    return mesh;
  }

  createGunMesh(name, parent, options) {
    const root = new BABYLON.TransformNode(`${name}-root`, this.scene);
    if (parent) root.parent = parent;

    const base = BABYLON.MeshBuilder.CreateBox(`${name}-base`, {
      width: CELL_SIZE * 0.9,
      height: CELL_SIZE * 0.35,
      depth: CELL_SIZE * 0.9,
    }, this.scene);
    base.parent = root;
    base.material = this.getMaterial('gun', options);
    base.position.y = -CELL_SIZE * 0.05;

    const turret = BABYLON.MeshBuilder.CreateCylinder(`${name}-turret`, {
      height: CELL_SIZE * 0.25,
      diameter: CELL_SIZE * 0.4,
      tessellation: 12,
    }, this.scene);
    turret.parent = root;
    turret.material = this.getMaterial('gun', options);
    turret.position.y = CELL_SIZE * 0.08;

    const barrel = BABYLON.MeshBuilder.CreateBox(`${name}-barrel`, {
      width: CELL_SIZE * 0.16,
      height: CELL_SIZE * 0.16,
      depth: CELL_SIZE * 0.7,
    }, this.scene);
    barrel.parent = root;
    barrel.material = this.getMaterial('gun', options);
    barrel.position.y = CELL_SIZE * 0.1;
    barrel.position.z = -CELL_SIZE * 0.22;

    return root;
  }

  createBoilerMesh(name, parent, options) {
    const root = new BABYLON.TransformNode(`${name}-root`, this.scene);
    if (parent) root.parent = parent;

    const body = BABYLON.MeshBuilder.CreateCylinder(`${name}-body`, {
      height: CELL_SIZE * 0.8,
      diameter: CELL_SIZE * 0.55,
      tessellation: 14,
    }, this.scene);
    body.parent = root;
    body.material = this.getMaterial('boiler', options);
    body.rotation.z = Math.PI / 2;

    const chimney = BABYLON.MeshBuilder.CreateCylinder(`${name}-chimney`, {
      height: CELL_SIZE * 0.4,
      diameterTop: CELL_SIZE * 0.18,
      diameterBottom: CELL_SIZE * 0.25,
      tessellation: 12,
    }, this.scene);
    chimney.parent = root;
    chimney.material = this.getMaterial('boiler', options);
    chimney.position.y = CELL_SIZE * 0.22;

    return root;
  }

  createPropellerMesh(name, parent, options) {
    const root = new BABYLON.TransformNode(`${name}-root`, this.scene);
    if (parent) root.parent = parent;

    const shaft = BABYLON.MeshBuilder.CreateCylinder(`${name}-shaft`, {
      height: CELL_SIZE * 0.45,
      diameter: CELL_SIZE * 0.08,
      tessellation: 10,
    }, this.scene);
    shaft.parent = root;
    shaft.material = this.getMaterial('propeller', options);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = CELL_SIZE * 0.08;

    for (let i = 0; i < 3; i += 1) {
      const blade = BABYLON.MeshBuilder.CreateBox(`${name}-blade-${i}`, {
        width: CELL_SIZE * 0.08,
        height: CELL_SIZE * 0.22,
        depth: CELL_SIZE * 0.02,
      }, this.scene);
      blade.parent = root;
      blade.material = this.getMaterial('propeller', options);
      blade.position.z = CELL_SIZE * 0.21;
      blade.rotation.z = i * (Math.PI * 2 / 3);
      blade.position.y = Math.cos(blade.rotation.z) * CELL_SIZE * 0.1;
      blade.position.x = Math.sin(blade.rotation.z) * CELL_SIZE * 0.1;
    }

    return root;
  }

  createRudderMesh(name, parent, options) {
    const root = new BABYLON.TransformNode(`${name}-root`, this.scene);
    if (parent) root.parent = parent;

    const fin = BABYLON.MeshBuilder.CreateBox(`${name}-fin`, {
      width: CELL_SIZE * 0.1,
      height: CELL_SIZE * 0.75,
      depth: CELL_SIZE * 0.42,
    }, this.scene);
    fin.parent = root;
    fin.material = this.getMaterial('rudder', options);
    fin.position.y = -CELL_SIZE * 0.1;

    return root;
  }

  rebuild(root, blueprint, options = {}) {
    root.getChildMeshes(false).forEach((mesh) => mesh.dispose());
    root.getChildTransformNodes(false).forEach((node) => {
      if (node !== root) node.dispose();
    });

    for (const part of blueprint.entries()) {
      this.createPartMesh(part, root, options);
    }
  }

  createGhost(partId, parent) {
    const ghostPart = { x: 0, y: 0, z: 0, partId };
    const ghost = this.createPartMesh(ghostPart, parent, { ghost: true, nonPickable: true });
    return ghost;
  }
}

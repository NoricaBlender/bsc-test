import { BUILD_BOUNDS, CELL_SIZE } from './constants.js';
import { gridToLocalPosition, localPositionToGrid } from './shipBlueprint.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class ShipEditor {
  constructor({ scene, canvas, blueprint, renderer, shipRoot, onChange, onHover }) {
    this.scene = scene;
    this.canvas = canvas;
    this.blueprint = blueprint;
    this.renderer = renderer;
    this.shipRoot = shipRoot;
    this.onChange = onChange;
    this.onHover = onHover;

    this.enabled = true;
    this.selectedPart = 'block';
    this.currentLayer = 0;
    this.hoverCell = { x: 0, y: 0, z: 0 };

    this.layerRoot = new BABYLON.TransformNode('layer-root', scene);
    this.layerPlane = BABYLON.MeshBuilder.CreatePlane('layer-plane', { size: 60 }, scene);
    this.layerPlane.rotation.x = Math.PI / 2;
    this.layerPlane.isVisible = false;
    this.layerPlane.isPickable = true;
    this.layerPlane.parent = this.layerRoot;

    this.gridLines = null;
    this.ghostRoot = new BABYLON.TransformNode('ghost-root', scene);
    this.ghost = this.renderer.createGhost(this.selectedPart, this.ghostRoot);

    this.refreshLayerVisuals();
    this.installEvents();
    this.updateGhostVisual();
  }

  installEvents() {
    this.canvas.addEventListener('contextmenu', (evt) => evt.preventDefault());

    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.enabled) return;

      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        this.updateHoverFromPointer();
      }

      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const evt = pointerInfo.event;
        if (evt.button === 0) {
          this.tryPlaceAtHover();
        }
      }
    });

    this.keyboardObserver = this.scene.onKeyboardObservable.add((kbInfo) => {
      if (!this.enabled || kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN) return;

      if (kbInfo.event.key === '[') this.changeLayer(-1);
      if (kbInfo.event.key === ']') this.changeLayer(1);
    });
  }

  dispose() {
    if (this.pointerObserver) this.scene.onPointerObservable.remove(this.pointerObserver);
    if (this.keyboardObserver) this.scene.onKeyboardObservable.remove(this.keyboardObserver);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.layerRoot.setEnabled(enabled);
    this.ghostRoot.setEnabled(enabled);
  }

  setSelectedPart(partId) {
    this.selectedPart = partId;
    if (this.ghost) this.ghost.dispose();
    this.ghost = partId === 'erase' ? null : this.renderer.createGhost(partId, this.ghostRoot);
    this.updateGhostVisual();
  }

  setLayer(value) {
    this.currentLayer = clamp(value, BUILD_BOUNDS.minY, BUILD_BOUNDS.maxY);
    this.refreshLayerVisuals();
    this.hoverCell.y = this.currentLayer;
    this.updateGhostVisual();
    this.onHover?.(this.hoverCell);
  }

  changeLayer(delta) {
    this.setLayer(this.currentLayer + delta);
  }

  refreshLayerVisuals() {
    this.layerPlane.position.y = this.currentLayer * CELL_SIZE;
    if (this.gridLines) {
      this.gridLines.dispose();
    }

    const lines = [];
    const y = this.currentLayer * CELL_SIZE;
    const minX = BUILD_BOUNDS.minX * CELL_SIZE - CELL_SIZE * 0.5;
    const maxX = BUILD_BOUNDS.maxX * CELL_SIZE + CELL_SIZE * 0.5;
    const minZ = BUILD_BOUNDS.minZ * CELL_SIZE - CELL_SIZE * 0.5;
    const maxZ = BUILD_BOUNDS.maxZ * CELL_SIZE + CELL_SIZE * 0.5;

    for (let gx = BUILD_BOUNDS.minX; gx <= BUILD_BOUNDS.maxX + 1; gx += 1) {
      const x = gx * CELL_SIZE - CELL_SIZE * 0.5;
      lines.push([new BABYLON.Vector3(x, y, minZ), new BABYLON.Vector3(x, y, maxZ)]);
    }
    for (let gz = BUILD_BOUNDS.minZ; gz <= BUILD_BOUNDS.maxZ + 1; gz += 1) {
      const z = gz * CELL_SIZE - CELL_SIZE * 0.5;
      lines.push([new BABYLON.Vector3(minX, y, z), new BABYLON.Vector3(maxX, y, z)]);
    }

    this.gridLines = BABYLON.MeshBuilder.CreateLineSystem('build-grid', {
      lines,
      updatable: false,
    }, this.scene);
    this.gridLines.parent = this.layerRoot;
    this.gridLines.color = new BABYLON.Color3(0.35, 0.55, 0.75);
  }

  updateHoverFromPointer() {
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.layerPlane);
    if (!pick?.hit || !pick.pickedPoint) return;

    const snapped = localPositionToGrid(pick.pickedPoint);
    const x = clamp(snapped.x, BUILD_BOUNDS.minX, BUILD_BOUNDS.maxX);
    const y = this.currentLayer;
    const z = clamp(snapped.z, BUILD_BOUNDS.minZ, BUILD_BOUNDS.maxZ);
    this.hoverCell = { x, y, z };
    this.updateGhostVisual();
    this.onHover?.(this.hoverCell);
  }

  updateGhostVisual() {
    if (!this.ghost) return;
    const pos = gridToLocalPosition(this.hoverCell.x, this.hoverCell.y, this.hoverCell.z);
    this.ghost.position.copyFrom(pos);

    const isOccupied = this.blueprint.hasPart(this.hoverCell.x, this.hoverCell.y, this.hoverCell.z);
    const ghostMeshes = this.ghost.getChildMeshes?.() ?? [];
    if (this.ghost.material) {
      this.ghost.material.alpha = isOccupied ? 0.18 : 0.45;
    }
    ghostMeshes.forEach((mesh) => {
      if (mesh.material) mesh.material.alpha = isOccupied ? 0.18 : 0.45;
    });
  }

  tryPlaceAtHover() {
    const { x, y, z } = this.hoverCell;
    if (this.selectedPart === 'erase') {
      this.blueprint.removePart(x, y, z);
    } else {
      this.blueprint.setPart(x, y, z, this.selectedPart);
    }
    this.renderer.rebuild(this.shipRoot, this.blueprint);
    this.updateGhostVisual();
    this.onChange?.();
  }

}

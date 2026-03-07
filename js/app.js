import { CAMERA, CELL_SIZE, SEA } from './constants.js';
import { ShipEditor } from './editor.js';
import { getPartStatsText, PART_ORDER } from './parts.js';
import { ShipRenderer } from './renderShip.js';
import { buildSampleBlueprint, ShipBlueprint } from './shipBlueprint.js';
import { ShipSimulator } from './shipSimulator.js';

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const app = {
  scene: null,
  renderer: null,
  blueprint: new ShipBlueprint(),
  editor: null,
  simulator: null,
  previewRoot: null,
  simRoot: null,
  water: null,
  buildCamera: null,
  testCamera: null,
  mode: 'build',
  ui: {},
  testState: {
    throttle: 0,
    rudder: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  },
};

function $(id) {
  return document.getElementById(id);
}

function bindUI() {
  app.ui = {
    partButtons: document.querySelectorAll('[data-part]'),
    layerValue: $('layerValue'),
    hoverValue: $('hoverValue'),
    shipStats: $('shipStats'),
    testStats: $('testStats'),
    modeLabel: $('modeLabel'),
    buildPanel: $('buildPanel'),
    testPanel: $('testPanel'),
    statusLine: $('statusLine'),
    partInfo: $('partInfo'),
    btnLayerUp: $('btnLayerUp'),
    btnLayerDown: $('btnLayerDown'),
    btnSample: $('btnSample'),
    btnClear: $('btnClear'),
    btnCopy: $('btnCopy'),
    btnPaste: $('btnPaste'),
    btnTest: $('btnTest'),
    btnBackToBuild: $('btnBackToBuild'),
    testControlsWrap: $('testControlsWrap'),
    launchWrap: $('launchWrap'),
    btnThrottleUp: $('btnThrottleUp'),
    btnThrottleDown: $('btnThrottleDown'),
    btnThrottleZero: $('btnThrottleZero'),
    btnRudderLeft: $('btnRudderLeft'),
    btnRudderRight: $('btnRudderRight'),
  };

  app.ui.partButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const partId = button.dataset.part;
      setSelectedPart(partId);
    });
  });

  app.ui.btnLayerUp.addEventListener('click', () => app.editor.changeLayer(1));
  app.ui.btnLayerDown.addEventListener('click', () => app.editor.changeLayer(-1));

  app.ui.btnSample.addEventListener('click', () => {
    app.blueprint = buildSampleBlueprint();
    app.editor.blueprint = app.blueprint;
    app.renderer.rebuild(app.previewRoot, app.blueprint);
    updateBuildStats();
    setSelectedPart('block');
  });

  app.ui.btnClear.addEventListener('click', () => {
    app.blueprint.clear();
    app.renderer.rebuild(app.previewRoot, app.blueprint);
    updateBuildStats();
  });

  app.ui.btnCopy.addEventListener('click', async () => {
    const json = JSON.stringify(app.blueprint.toJSON(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      app.ui.statusLine.textContent = 'Blueprint JSON copied to clipboard.';
    } catch {
      window.prompt('Copy your blueprint JSON:', json);
    }
  });

  app.ui.btnPaste.addEventListener('click', () => {
    const text = window.prompt('Paste blueprint JSON array here:');
    if (!text) return;
    try {
      const data = JSON.parse(text);
      app.blueprint.loadFromArray(data);
      app.renderer.rebuild(app.previewRoot, app.blueprint);
      updateBuildStats();
      app.ui.statusLine.textContent = 'Blueprint loaded.';
    } catch (err) {
      app.ui.statusLine.textContent = `Load failed: ${err.message}`;
    }
  });

  app.ui.btnTest.addEventListener('click', enterTestMode);
  app.ui.btnBackToBuild.addEventListener('click', enterBuildMode);
  app.ui.btnThrottleZero.addEventListener('click', () => {
    app.testState.throttle = 0;
  });

  wireHoldButton(app.ui.btnThrottleUp, 'up');
  wireHoldButton(app.ui.btnThrottleDown, 'down');
  wireHoldButton(app.ui.btnRudderLeft, 'left');
  wireHoldButton(app.ui.btnRudderRight, 'right');
}

function wireHoldButton(button, key) {
  const on = () => { app.testState[key] = true; };
  const off = () => { app.testState[key] = false; };
  ['pointerdown', 'mousedown', 'touchstart'].forEach((evt) => button.addEventListener(evt, on));
  ['pointerup', 'pointerleave', 'mouseup', 'touchend', 'touchcancel'].forEach((evt) => button.addEventListener(evt, off));
}

function setSelectedPart(partId) {
  app.editor.setSelectedPart(partId);
  app.ui.partButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.part === partId);
  });
  const info = partId === 'erase'
    ? 'Erase: click any occupied grid cell on the current layer to remove it.'
    : getPartStatsText(partId);
  app.ui.partInfo.textContent = info;
}

function createAxisLines(scene) {
  const len = 3;
  const lines = BABYLON.MeshBuilder.CreateLineSystem('axes', {
    lines: [
      [new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(len, 0, 0)],
      [new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, len, 0)],
      [new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, -len)],
    ],
  }, scene);
  lines.color = new BABYLON.Color3(1, 1, 1);
}

function createSea(scene) {
  const water = BABYLON.MeshBuilder.CreateGround('water', {
    width: SEA.size,
    height: SEA.size,
    subdivisions: 1,
  }, scene);
  const mat = new BABYLON.StandardMaterial('water-mat', scene);
  mat.diffuseColor = BABYLON.Color3.FromHexString(SEA.color);
  mat.emissiveColor = BABYLON.Color3.FromHexString('#0d3358');
  mat.alpha = 0.92;
  mat.specularColor = new BABYLON.Color3(0.35, 0.35, 0.35);
  water.material = mat;
  water.position.y = 0;
  water.isPickable = false;
  water.setEnabled(false);
  return water;
}

function createBuildPad(scene) {
  const pad = BABYLON.MeshBuilder.CreateGround('build-pad', { width: 14, height: 18 }, scene);
  const mat = new BABYLON.StandardMaterial('build-pad-mat', scene);
  mat.diffuseColor = BABYLON.Color3.FromHexString('#1c2530');
  mat.emissiveColor = BABYLON.Color3.FromHexString('#0a0f14');
  pad.material = mat;
  pad.position.y = -0.005;
  pad.isPickable = false;
  return pad;
}

async function createScene() {
  const scene = new BABYLON.Scene(engine);
  app.scene = scene;
  scene.clearColor = BABYLON.Color4.FromHexString('#9ec8ffff');
  scene.ambientColor = new BABYLON.Color3(0.35, 0.35, 0.35);

  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0.1, 1, 0.15), scene);
  hemi.intensity = 0.92;
  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.2, -1, 0.25), scene);
  dir.position = new BABYLON.Vector3(10, 18, -8);
  dir.intensity = 0.7;

  createAxisLines(scene);
  createBuildPad(scene);
  app.water = createSea(scene);

  app.buildCamera = new BABYLON.ArcRotateCamera('build-cam', -Math.PI / 2, 1.05, CAMERA.buildRadius, new BABYLON.Vector3(0, 1.5, 0), scene);
  app.buildCamera.wheelDeltaPercentage = 0.01;
  app.buildCamera.lowerRadiusLimit = 6;
  app.buildCamera.upperRadiusLimit = 40;
  app.buildCamera.attachControl(canvas, true);
  if (app.buildCamera.inputs.attached.pointers) {
    app.buildCamera.inputs.attached.pointers.buttons = [2];
  }

  app.testCamera = new BABYLON.FreeCamera('test-cam', new BABYLON.Vector3(0, 4, 10), scene);
  app.testCamera.minZ = 0.1;
  app.testCamera.fov = 0.9;
  app.testCamera.setTarget(BABYLON.Vector3.Zero());

  scene.activeCamera = app.buildCamera;

  app.renderer = new ShipRenderer(scene);
  app.previewRoot = new BABYLON.TransformNode('preview-root', scene);
  app.simRoot = new BABYLON.TransformNode('sim-root', scene);
  app.simRoot.setEnabled(false);

  app.blueprint = buildSampleBlueprint();
  app.renderer.rebuild(app.previewRoot, app.blueprint);

  app.editor = new ShipEditor({
    scene,
    canvas,
    blueprint: app.blueprint,
    renderer: app.renderer,
    shipRoot: app.previewRoot,
    onChange: updateBuildStats,
    onHover: (cell) => {
      app.ui.hoverValue.textContent = `${cell.x}, ${cell.y}, ${cell.z}`;
    },
  });

  bindUI();
  setSelectedPart('block');
  updateBuildStats();
  enterBuildMode();

  window.addEventListener('keydown', (evt) => handleKey(evt, true));
  window.addEventListener('keyup', (evt) => handleKey(evt, false));

  return scene;
}

function handleKey(evt, isDown) {
  if (app.mode !== 'test') return;
  const key = evt.key.toLowerCase();
  if (key === 'w') app.testState.up = isDown;
  if (key === 's') app.testState.down = isDown;
  if (key === 'a') app.testState.left = isDown;
  if (key === 'd') app.testState.right = isDown;
  if (key === 'x' && isDown) app.testState.throttle = 0;
  if (key === 'r' && isDown) {
    app.simulator?.reset();
    app.testState.throttle = 0;
    app.testState.rudder = 0;
  }
}

function updateBuildStats() {
  const parts = app.blueprint.entries();
  const counts = new Map();
  parts.forEach((p) => counts.set(p.partId, (counts.get(p.partId) ?? 0) + 1));
  const summary = [
    `Cells: ${parts.length}`,
    ...PART_ORDER.map((id) => `${id}: ${counts.get(id) ?? 0}`),
  ].join(' · ');

  app.ui.layerValue.textContent = `${app.editor.currentLayer}`;
  app.ui.shipStats.textContent = summary;
  app.ui.statusLine.textContent = parts.length === 0
    ? 'Add at least a few hull blocks first. Boats need enough displaced volume to carry their own weight.'
    : 'Build mode: left click places on the selected layer, right-drag orbits the camera, mouse wheel zooms.';
}

function enterBuildMode() {
  app.mode = 'build';
  app.previewRoot.setEnabled(true);
  app.simRoot.setEnabled(false);
  app.water.setEnabled(false);
  app.editor.setEnabled(true);
  if (app.simulator) {
    app.simulator.dispose();
    app.simulator = null;
  }
  app.scene.activeCamera = app.buildCamera;
  app.buildCamera.attachControl(canvas, true);
  app.ui.modeLabel.textContent = 'Build Mode';
  app.ui.buildPanel.classList.remove('hidden');
  app.ui.testPanel.classList.add('hidden');
  app.ui.launchWrap.classList.remove('hidden');
  app.ui.testControlsWrap.classList.add('hidden');
  updateBuildStats();
}

function enterTestMode() {
  if (app.blueprint.isEmpty()) {
    app.ui.statusLine.textContent = 'Cannot launch an empty ship.';
    return;
  }

  app.mode = 'test';
  app.previewRoot.setEnabled(false);
  app.simRoot.setEnabled(true);
  app.water.setEnabled(true);
  app.editor.setEnabled(false);
  app.buildCamera.detachControl(canvas);

  if (app.simulator) app.simulator.dispose();
  app.simulator = new ShipSimulator({
    scene: app.scene,
    renderer: app.renderer,
    blueprint: app.blueprint,
    shipRoot: app.simRoot,
  });
  app.simulator.setRunning(true);

  app.testState = {
    throttle: 0,
    rudder: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  app.scene.activeCamera = app.testCamera;
  app.ui.modeLabel.textContent = 'Sea Trial';
  app.ui.buildPanel.classList.add('hidden');
  app.ui.testPanel.classList.remove('hidden');
  app.ui.launchWrap.classList.add('hidden');
  app.ui.testControlsWrap.classList.remove('hidden');
  app.ui.statusLine.textContent = 'Sea trial: W/S throttle, A/D steer, X neutral throttle, R reset.';
  updateTestStats();
}

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function updateTestInput(dt) {
  if (!app.simulator) return;

  if (app.testState.up) app.testState.throttle = Math.min(1, app.testState.throttle + dt * 0.45);
  if (app.testState.down) app.testState.throttle = Math.max(-1, app.testState.throttle - dt * 0.45);

  const rudderTarget = app.testState.left ? -1 : app.testState.right ? 1 : 0;
  app.testState.rudder = moveTowards(app.testState.rudder, rudderTarget, dt * 3.5);
  app.simulator.setInput({ throttle: app.testState.throttle, rudder: app.testState.rudder });
}

function updateFollowCamera(dt) {
  if (!app.simulator) return;

  const status = app.simulator.getStatus();
  const root = app.simRoot;
  const rot = root.rotationQuaternion ?? BABYLON.Quaternion.Identity();
  const matrix = BABYLON.Matrix.FromQuaternion(rot);
  const forward = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 0, -1), matrix).normalize();
  const up = BABYLON.Vector3.TransformNormal(BABYLON.Axis.Y, matrix).normalize();

  const target = root.position.add(forward.scale(3.0)).add(up.scale(0.9));
  const backDistance = CAMERA.testFollowDistance + Math.min(4, status.speed * 0.6);
  const desiredPos = root.position.subtract(forward.scale(backDistance)).add(up.scale(CAMERA.testHeight));

  app.testCamera.position = BABYLON.Vector3.Lerp(app.testCamera.position, desiredPos, 1 - Math.exp(-dt * 5));
  app.testCamera.setTarget(BABYLON.Vector3.Lerp(app.testCamera.getTarget(), target, 1 - Math.exp(-dt * 6)));
}

function updateTestStats() {
  if (!app.simulator) return;
  const s = app.simulator.getStatus();
  app.ui.testStats.textContent = [
    `Speed ${s.speed.toFixed(2)} m/s`,
    `Throttle ${(s.throttle * 100).toFixed(0)}%`,
    `Rudder ${s.rudderDeg.toFixed(0)}°`,
    `Mass ${s.totalMass.toFixed(0)} kg`,
    `Boilers ${s.engineUnits}`,
    `Props ${s.propellerCount}`,
    `Rudders ${s.rudderCount}`,
    `Draft ${s.draft.toFixed(2)} m`,
    `Buoyancy ratio ${s.buoyancyRatio.toFixed(2)}`,
  ].join(' · ');
}

createScene().then((scene) => {
  app.scene = scene;

  let lastTime = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    if (app.mode === 'test' && app.simulator) {
      updateTestInput(dt);
      app.simulator.update(dt);
      updateFollowCamera(dt);
      updateTestStats();
    }

    scene.render();
  });
});

window.addEventListener('resize', () => engine.resize());

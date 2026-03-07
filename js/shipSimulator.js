import { CELL_SIZE, GRAVITY, INPUT, WATER_DENSITY, WATER_LEVEL } from './constants.js';
import { getPartDefinition } from './parts.js';
import { gridToLocalPosition } from './shipBlueprint.js';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function vec(x = 0, y = 0, z = 0) {
  return new BABYLON.Vector3(x, y, z);
}

export class ShipSimulator {
  constructor({ scene, renderer, blueprint, shipRoot }) {
    this.scene = scene;
    this.renderer = renderer;
    this.blueprint = blueprint.clone();
    this.shipRoot = shipRoot;

    this.running = false;
    this.time = 0;
    this.position = new BABYLON.Vector3(0, 1.2, 0);
    this.rotation = BABYLON.Quaternion.Identity();
    this.linearVelocity = BABYLON.Vector3.Zero();
    this.angularVelocity = BABYLON.Vector3.Zero();
    this.throttle = 0;
    this.rudderInput = 0;

    this.totalMass = 1;
    this.elements = [];
    this.propellerNodes = [];
    this.rudderNodes = [];
    this.engineUnits = 0;
    this.propellerCount = 0;
    this.rudderCount = 0;
    this.localInertia = new BABYLON.Vector3(1, 1, 1);
    this.localInverseInertia = new BABYLON.Vector3(1, 1, 1);
    this.status = {
      totalMass: 0,
      engineUnits: 0,
      propellerCount: 0,
      rudderCount: 0,
      speed: 0,
      draft: 0,
      throttle: 0,
      rudderDeg: 0,
      buoyancyRatio: 0,
      floating: false,
    };

    this.prepareShip();
  }

  dispose() {
    this.shipRoot.getChildMeshes(false).forEach((mesh) => mesh.dispose());
    this.shipRoot.getChildTransformNodes(false).forEach((node) => {
      if (node !== this.shipRoot) node.dispose();
    });
  }

  prepareShip() {
    const entries = this.blueprint.entries();
    if (entries.length === 0) return;

    let totalMass = 0;
    const weightedPos = vec(0, 0, 0);

    const raw = entries.map((part) => {
      const def = getPartDefinition(part.partId);
      const localPos = gridToLocalPosition(part.x, part.y, part.z);
      totalMass += def.mass;
      weightedPos.addInPlace(localPos.scale(def.mass));
      return {
        ...part,
        def,
        mass: def.mass,
        localPos,
        volume: def.volume,
        buoyancyVolume: def.buoyancyVolume,
        halfExtents: vec(CELL_SIZE * 0.245, CELL_SIZE * 0.245, CELL_SIZE * 0.245),
        dragArea: 1 + (def.dragBoost ?? 0) * 0.05,
      };
    });

    const com = weightedPos.scale(1 / Math.max(totalMass, 1));

    this.totalMass = totalMass;
    this.engineUnits = raw.filter((e) => e.partId === 'boiler').length;
    this.propellerCount = raw.filter((e) => e.partId === 'propeller').length;
    this.rudderCount = raw.filter((e) => e.partId === 'rudder').length;

    let ixx = 0;
    let iyy = 0;
    let izz = 0;

    raw.forEach((item) => {
      item.localPos = item.localPos.subtract(com);
      const p = item.localPos;
      const hx = item.halfExtents.x;
      const hy = item.halfExtents.y;
      const hz = item.halfExtents.z;
      const cubeIxx = (item.mass / 12) * ((2 * hy) ** 2 + (2 * hz) ** 2);
      const cubeIyy = (item.mass / 12) * ((2 * hx) ** 2 + (2 * hz) ** 2);
      const cubeIzz = (item.mass / 12) * ((2 * hx) ** 2 + (2 * hy) ** 2);

      ixx += cubeIxx + item.mass * (p.y * p.y + p.z * p.z);
      iyy += cubeIyy + item.mass * (p.x * p.x + p.z * p.z);
      izz += cubeIzz + item.mass * (p.x * p.x + p.y * p.y);
    });

    this.localInertia = vec(Math.max(ixx, 1), Math.max(iyy, 1), Math.max(izz, 1));
    this.localInverseInertia = vec(1 / this.localInertia.x, 1 / this.localInertia.y, 1 / this.localInertia.z);
    this.elements = raw;

    this.rebuildVisuals();
    this.reset();
  }

  rebuildVisuals() {
    this.shipRoot.getChildMeshes(false).forEach((mesh) => mesh.dispose());
    this.shipRoot.getChildTransformNodes(false).forEach((node) => {
      if (node !== this.shipRoot) node.dispose();
    });

    this.propellerNodes = [];
    this.rudderNodes = [];

    for (const element of this.elements) {
      const visual = this.renderer.createPartMesh(element, this.shipRoot, { nonPickable: true });
      visual.position.copyFrom(element.localPos);
      if (element.partId === 'propeller') this.propellerNodes.push(visual);
      if (element.partId === 'rudder') this.rudderNodes.push(visual);
    }
  }

  reset() {
    this.time = 0;
    this.throttle = 0;
    this.rudderInput = 0;
    this.linearVelocity = BABYLON.Vector3.Zero();
    this.angularVelocity = BABYLON.Vector3.Zero();
    this.rotation = BABYLON.Quaternion.Identity();

    const bounds = this.getApproxBounds();
    const draftGuess = Math.max(0.2, (this.totalMass / (WATER_DENSITY * Math.max(this.totalBuoyancyVolume(), 0.001))) * (bounds.maxY - bounds.minY + CELL_SIZE));
    this.position = new BABYLON.Vector3(0, WATER_LEVEL + draftGuess + 0.8, 0);
    this.syncRoot();
    this.updateStatus(0.0, true);
  }

  totalBuoyancyVolume() {
    return this.elements.reduce((sum, item) => sum + item.buoyancyVolume, 0);
  }

  getApproxBounds() {
    const ys = this.elements.map((e) => e.localPos.y);
    return {
      minY: Math.min(...ys, 0),
      maxY: Math.max(...ys, 0),
    };
  }

  setRunning(flag) {
    this.running = flag;
  }

  setInput({ throttle, rudder }) {
    this.throttle = clamp(throttle, -INPUT.maxThrottle, INPUT.maxThrottle);
    this.rudderInput = clamp(rudder, -1, 1);
  }

  getAxes() {
    const matrix = BABYLON.Matrix.FromQuaternion(this.rotation);
    const xAxis = BABYLON.Vector3.TransformNormal(BABYLON.Axis.X, matrix).normalize();
    const yAxis = BABYLON.Vector3.TransformNormal(BABYLON.Axis.Y, matrix).normalize();
    const zAxis = BABYLON.Vector3.TransformNormal(BABYLON.Axis.Z, matrix).normalize();
    return { matrix, xAxis, yAxis, zAxis };
  }

  localToWorld(localVec, axes) {
    return this.position
      .add(axes.xAxis.scale(localVec.x))
      .add(axes.yAxis.scale(localVec.y))
      .add(axes.zAxis.scale(localVec.z));
  }

  localDirToWorld(localVec, axes) {
    return axes.xAxis.scale(localVec.x)
      .add(axes.yAxis.scale(localVec.y))
      .add(axes.zAxis.scale(localVec.z));
  }

  worldDirToLocal(worldVec, axes) {
    return vec(
      BABYLON.Vector3.Dot(worldVec, axes.xAxis),
      BABYLON.Vector3.Dot(worldVec, axes.yAxis),
      BABYLON.Vector3.Dot(worldVec, axes.zAxis),
    );
  }

  verticalHalfExtent(element, axes) {
    return Math.abs(axes.xAxis.y) * element.halfExtents.x
      + Math.abs(axes.yAxis.y) * element.halfExtents.y
      + Math.abs(axes.zAxis.y) * element.halfExtents.z;
  }

  pointVelocity(worldPoint) {
    const r = worldPoint.subtract(this.position);
    return this.linearVelocity.add(BABYLON.Vector3.Cross(this.angularVelocity, r));
  }

  addForceAtPoint(force, worldPoint, accum) {
    accum.force.addInPlace(force);
    const r = worldPoint.subtract(this.position);
    accum.torque.addInPlace(BABYLON.Vector3.Cross(r, force));
  }

  update(dt) {
    if (!this.running || this.elements.length === 0) {
      this.updateStatus(0, false);
      return;
    }

    this.time += dt;
    const axes = this.getAxes();
    const accum = { force: vec(0, -this.totalMass * GRAVITY, 0), torque: vec(0, 0, 0) };

    let submergedCount = 0;
    let draft = 0;

    const engineFactor = Math.max(0.12, this.engineUnits * 0.68);
    const desiredRudderAngle = BABYLON.Angle.FromDegrees(INPUT.maxRudderAngleDeg * this.rudderInput).radians();

    for (const element of this.elements) {
      const worldPoint = this.localToWorld(element.localPos, axes);
      const pointVelocity = this.pointVelocity(worldPoint);
      const halfExtentY = this.verticalHalfExtent(element, axes);
      const bottomY = worldPoint.y - halfExtentY;
      const topY = worldPoint.y + halfExtentY;
      const submergedHeight = clamp(WATER_LEVEL - bottomY, 0, topY - bottomY);
      const submergedRatio = (topY - bottomY) > 0 ? submergedHeight / (topY - bottomY) : 0;
      if (submergedRatio <= 0) continue;

      submergedCount += submergedRatio;
      draft = Math.max(draft, WATER_LEVEL - bottomY);

      const buoyancyForce = vec(0, WATER_DENSITY * GRAVITY * element.buoyancyVolume * submergedRatio, 0);
      this.addForceAtPoint(buoyancyForce, worldPoint, accum);

      const localVel = this.worldDirToLocal(pointVelocity, axes);
      const dragCoeffX = 18 * element.dragArea;
      const dragCoeffY = 26 * element.dragArea;
      const dragCoeffZ = 8 * element.dragArea;
      const localDrag = vec(
        -localVel.x * (dragCoeffX + Math.abs(localVel.x) * 10),
        -localVel.y * (dragCoeffY + Math.abs(localVel.y) * 16),
        -localVel.z * (dragCoeffZ + Math.abs(localVel.z) * 4),
      ).scale(submergedRatio * 0.85);
      const worldDrag = this.localDirToWorld(localDrag, axes);
      this.addForceAtPoint(worldDrag, worldPoint, accum);

      if (element.partId === 'propeller') {
        const thrustMag = element.def.thrust * engineFactor * this.throttle * submergedRatio;
        const thrustDir = this.localDirToWorld(vec(0, 0, -1), axes);
        const thrustForce = thrustDir.scale(thrustMag);
        this.addForceAtPoint(thrustForce, worldPoint, accum);
      }

      if (element.partId === 'rudder') {
        const forwardSpeed = -localVel.z;
        const sideForceLocal = vec(
          -desiredRudderAngle * forwardSpeed * Math.abs(forwardSpeed) * element.def.steerPower * submergedRatio,
          0,
          -Math.abs(desiredRudderAngle) * forwardSpeed * Math.abs(forwardSpeed) * 80 * submergedRatio,
        );
        const rudderForce = this.localDirToWorld(sideForceLocal, axes);
        this.addForceAtPoint(rudderForce, worldPoint, accum);
      }
    }

    const airDrag = this.linearVelocity.scale(-0.35 - this.linearVelocity.length() * 0.03);
    accum.force.addInPlace(airDrag);

    const angularDamping = 0.92 - clamp(submergedCount / Math.max(this.elements.length, 1), 0, 1) * 0.12;

    const linearAcc = accum.force.scale(1 / Math.max(this.totalMass, 1));
    this.linearVelocity.addInPlace(linearAcc.scale(dt));
    this.position.addInPlace(this.linearVelocity.scale(dt));

    const localTorque = this.worldDirToLocal(accum.torque, axes);
    const localAngularAcc = vec(
      localTorque.x * this.localInverseInertia.x,
      localTorque.y * this.localInverseInertia.y,
      localTorque.z * this.localInverseInertia.z,
    );
    const worldAngularAcc = this.localDirToWorld(localAngularAcc, axes);
    this.angularVelocity.addInPlace(worldAngularAcc.scale(dt));
    this.angularVelocity.scaleInPlace(Math.pow(angularDamping, dt * 60));

    const omegaMag = this.angularVelocity.length();
    if (omegaMag > 0.0001) {
      const delta = BABYLON.Quaternion.RotationAxis(this.angularVelocity.scale(1 / omegaMag), omegaMag * dt);
      this.rotation = delta.multiply(this.rotation).normalize();
    }

    this.syncRoot(desiredRudderAngle, dt);
    this.updateStatus(draft, submergedCount > 0.15);
  }

  syncRoot(rudderAngle = 0, dt = 0) {
    this.shipRoot.position.copyFrom(this.position);
    this.shipRoot.rotationQuaternion = this.rotation.clone();

    const spinRate = 13 * this.throttle;
    this.propellerNodes.forEach((node) => {
      node.rotation = node.rotation || BABYLON.Vector3.Zero();
      node.rotation.z += spinRate * dt * Math.PI * 2;
    });
    this.rudderNodes.forEach((node) => {
      node.rotation = node.rotation || BABYLON.Vector3.Zero();
      node.rotation.y = rudderAngle;
    });
  }

  updateStatus(draft, floating) {
    this.status = {
      totalMass: this.totalMass,
      engineUnits: this.engineUnits,
      propellerCount: this.propellerCount,
      rudderCount: this.rudderCount,
      speed: this.linearVelocity.length(),
      draft,
      throttle: this.throttle,
      rudderDeg: this.rudderInput * INPUT.maxRudderAngleDeg,
      buoyancyRatio: this.totalBuoyancyVolume() * WATER_DENSITY / Math.max(this.totalMass, 1),
      floating,
    };
  }

  getStatus() {
    return this.status;
  }
}

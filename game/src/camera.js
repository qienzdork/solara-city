// Third-person follow camera: trails the player or the car, orbits with
// mouse drag, zooms with the wheel, and looks a little ahead of motion.
// Staged screenshot scenes snap it to a fixed pose instead.

import { CAMERA } from './config.js';

const THREE = window.THREE;

export function createCameraRig(camera) {
  let yaw = 0; // orbit around the target
  let pitch = 0.32; // radians above horizontal
  let distance = CAMERA.followDistance;
  let currentPos = new THREE.Vector3(0, 8, 16);
  let currentLook = new THREE.Vector3(0, 1, 0);
  let snap = null; // {pos, look} set by a staged shot

  return {
    get yaw() {
      return yaw;
    },
    snapTo(pos, look) {
      snap = { pos: pos.clone(), look: look.clone() };
      currentPos.copy(pos);
      currentLook.copy(look);
    },
    clearSnap() {
      snap = null;
    },
    // call every frame while playing; autoAlign (driving) lets the camera
    // settle behind the direction of travel, on foot it stays where the
    // mouse put it so diagonal movement stays straight
    update(dt, targetPos, targetHeading, speed, input, autoAlign = true) {
      if (snap) {
        // the snap pose is authoritative: resetBehind may move currentPos
        // (it also sets the yaw on-foot movement reads), but the staged
        // camera must stay exactly where stageShot put it
        camera.position.copy(snap.pos);
        camera.lookAt(snap.look);
        return;
      }
      const drag = input.consumeMouseDelta();
      yaw -= drag.x * CAMERA.orbitSpeed;
      pitch += drag.y * CAMERA.orbitSpeed;
      pitch = Math.max(0.08, Math.min(1.1, pitch));
      distance += input.consumeWheel() * 0.01;
      distance = Math.max(CAMERA.minDistance, Math.min(CAMERA.maxDistance, distance));
      // when not dragging, the camera settles behind the direction of travel
      if (autoAlign && drag.x === 0 && drag.y === 0) {
        let diff = targetHeading - yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        yaw += diff * Math.min(1, dt * 1.6);
      }
      const dist = distance + Math.min(4, speed * 0.06);
      const height = CAMERA.followHeight + Math.min(2.5, speed * 0.03);
      const desired = new THREE.Vector3(
        targetPos.x - Math.sin(yaw) * Math.cos(pitch) * dist,
        targetPos.y + height + Math.sin(pitch) * dist * 0.4,
        targetPos.z - Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      const look = new THREE.Vector3(
        targetPos.x + Math.sin(targetHeading) * CAMERA.lookAhead * 0.4,
        targetPos.y + 1.4,
        targetPos.z + Math.cos(targetHeading) * CAMERA.lookAhead * 0.4,
      );
      const k = 1 - Math.exp(-dt * 7);
      currentPos.lerp(desired, k);
      currentLook.lerp(look, k);
      camera.position.copy(currentPos);
      camera.lookAt(currentLook);
    },
    // point the camera at a target instantly (used on mission teleports)
    resetBehind(targetPos, heading) {
      yaw = heading;
      pitch = 0.32;
      distance = CAMERA.followDistance;
      currentPos.set(
        targetPos.x - Math.sin(yaw) * distance,
        targetPos.y + CAMERA.followHeight,
        targetPos.z - Math.cos(yaw) * distance,
      );
      currentLook.copy(targetPos);
    },
  };
}

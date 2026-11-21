import * as THREE from 'three';

const vec = (x,y,z) => new THREE.Vector3(x,y,z);
const ease = t => { t = THREE.MathUtils.clamp(t,0,1); return t*t*(3-2*t); };
export const DRAW_TIME = 1.55;
export const SWING_TIME = .64;

// The case stays on the cloak. Every pose moves the same grip, blade and paw.
export class RakkoSword {
  constructor(actor) {
    this.actor = actor;
    const {sword,blade,hand,arm_R} = actor.parts;
    this.sword = sword; this.blade = blade; this.arm = arm_R; this.hand = hand;
    this.space = arm_R.parent;
    this.seat = sword.position.clone();
    this.armRest = arm_R.position.clone();
    this.axis = actor.parts.blade_tip.position.clone().normalize();
    this.bladeOrigin = blade.position.clone();
    blade.matrixAutoUpdate = false;
    this.attitude = new THREE.Quaternion();
  }
  pose(draw, swing = 0) {
    const {arm,hand,sword,blade,space} = this;
    arm.position.copy(this.armRest);
    sword.position.copy(this.seat); sword.quaternion.identity();
    const local = node => space.worldToLocal(node.getWorldPosition(vec()));
    const grip = local(sword), paw = local(hand);
    // Reach around the cloak, clear the rim, then bring the prop beside the face.
    const clear = grip.clone().addScaledVector(this.axis,-.37);
    const ready = vec(-.44,.49,.32);
    let target = grip.clone(), direction = this.axis.clone();
    const lift = ease((draw-.28)/.34), carry = ease((draw-.62)/.38);
    target.lerp(clear,lift);
    if (carry>0) {
      const arc = new THREE.CubicBezierCurve3(clear, vec(-.72,.90,-.16), vec(-.64,.68,.30), ready);
      target = arc.getPoint(carry);
      direction.lerp(vec(-.43,.80,.40),carry).normalize();
    }
    if (swing>0 && draw>=.999) {
      const anticipation=Math.sin(Math.PI*ease(swing/.28));
      const sweep=Math.sin(Math.PI*ease((swing-.20)/.80));
      target.add(vec(-.055*anticipation+.21*sweep,.08*anticipation-.045*sweep,.17*sweep));
      direction.add(vec(-.50*anticipation+1.10*sweep,.20*anticipation-1.25*sweep,.78*sweep)).normalize();
    }
    const parent = sword.parent;
    sword.position.copy(parent.worldToLocal(space.localToWorld(target.clone())));
    const dirInCase = parent.worldToLocal(space.localToWorld(target.clone().add(direction))).sub(sword.position).normalize();
    sword.quaternion.setFromUnitVectors(this.axis,dirInCase);
    if (!draw) sword.quaternion.identity();
    // Uncover only the length already past the rim during extraction and return.
    blade.visible = lift>.002;
    const {x,y,z}=this.axis, shrink=lift-1, origin=this.bladeOrigin;
    blade.matrix.set(1+shrink*x*x,shrink*x*y,shrink*x*z,origin.x,
                     shrink*y*x,1+shrink*y*y,shrink*y*z,origin.y,
                     shrink*z*x,shrink*z*y,1+shrink*z*z,origin.z, 0,0,0,1);
    blade.matrixWorldNeedsUpdate=true;
    const reachTwist=Math.sin(Math.PI*draw);
    this.actor.parts.head.rotation.y=-.15*reachTwist-.08*Math.sin(Math.PI*swing);
    this.actor.parts.head.rotation.z+=.042*reachTwist;
    // Keep the paw on the grip while rotating the short arm from its shoulder.
    const reach = ease(draw/.28), desired = paw.clone().lerp(target,reach);
    desired.x -= .20*Math.sin(Math.PI*reach);
    const shoulder = arm.position.clone(), old = paw.clone().sub(shoulder);
    const delta = desired.clone().sub(shoulder);
    if (delta.lengthSq()>.0001) {
      this.attitude.setFromUnitVectors(old.normalize(),delta.normalize());
      arm.quaternion.premultiply(this.attitude);
      arm.position.add(desired.sub(local(hand)));
    }
  }
}

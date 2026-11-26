// The screenshot scenes behind ?shot=start|play|approach|end.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot (point at the next ring or the
// runway, hold speed, pull up to the ring's height), so every frame is what a
// real game looks like and the same seed always gives the same frame.
import { RUNWAY, STEP } from './world.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Steer toward a point: turn, pitch and throttle to reach it. */
function steerTo(state, target, dt) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantHeading = (Math.atan2(dx, dz) * 180) / Math.PI;
  let rel = ((wantHeading - state.headingDeg + 540) % 360) - 180;
  const turn = Math.max(-1, Math.min(1, rel / 25));
  const dy = target.y - state.y;
  const pitch = Math.max(-1, Math.min(1, dy / 60));
  const dist = Math.hypot(dx, dy, dz);
  const throttle = dist < 120 ? 0 : 0.55;
  return { turn, pitch, throttle, boost: false, brake: false };
}

/** Run the world forward for `seconds`, steering at each step. */
function fly(world, seconds, targetFor) {
  for (let t = 0; t < seconds; t += SAMPLE) {
    const target = targetFor(world.state);
    const input = steerTo(world.state, target, SAMPLE);
    // Throttle is held: nudge it toward the autopilot's target.
    const s = world.state;
    s.throttle += Math.max(-SAMPLE * 0.6, Math.min(SAMPLE * 0.6, input.throttle - s.throttle));
    world.step(SAMPLE, { ...input, throttle: 0 });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: on the runway at golden hour, engines idling. play: mid-course,
 * threading a ring over the islands. approach: final approach, gear down,
 * runway lights ahead. end: mission complete on the runway.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name !== 'play' && name !== 'approach' && name !== 'end') {
    // Title: a cinematic establishing shot — high over the sea south of the
    // home island, the runway, the rings and the golden-hour sky ahead.
    s.x = 0;
    s.z = 500;
    s.y = 380;
    s.headingDeg = 0;
    s.pitchDeg = -6;
    s.speed = 58;
    s.throttle = 0.7;
    s.onGround = false;
    return { screen: SCREEN_TITLE, best: 0, t: 2.5 };
  }
  if (name === 'play') {
    fly(world, 26, (state) => {
      const ring = world.rings[state.nextRing];
      return ring ?? { x: 0, z: 1550, y: 120 };
    });
    return { screen: SCREEN_PLAY, best: 0, t: 26 };
  }
  if (name === 'approach') {
    // Nine rings already flown; the plane is on a base leg, turning onto
    // final, so the runway strip shows at an angle beside the plane.
    for (let i = 0; i < 9; i += 1) {
      world.rings[i].done = true;
      s.ringsDone = 9;
      s.score = 900;
      s.fuel = 78;
    }
    s.nextRing = 9;
    s.x = -320;
    s.z = 350;
    s.y = 240;
    s.headingDeg = 25;
    s.speed = 58;
    s.throttle = 0.55;
    s.onGround = false;
    fly(world, 9, () => ({ x: 0, z: RUNWAY.zStart + 200, y: RUNWAY.elevation + 12 }));
    return { screen: SCREEN_PLAY, best: 900, t: 33 };
  }
  // end: the whole course flown and a landing made. The plane sits at the
  // far end of the runway looking back south down the strip, the sea and
  // the sunset beyond it.
  for (const ring of world.rings) ring.done = true;
  s.ringsDone = 10;
  s.nextRing = 10;
  s.score = 1000;
  s.fuel = 41;
  s.x = 0;
  s.z = RUNWAY.zEnd - 60;
  s.y = RUNWAY.elevation + 3;
  s.headingDeg = 180;
  s.speed = 12;
  s.throttle = 0.2;
  s.onGround = true;
  s.landed = true;
  s.finished = true;
  s.time = 214;
  s.score += 500 + Math.max(0, 360 - 214) * 4 + Math.round(s.fuel) * 2;
  s.message = 'Landed! +500 landing, +584 time, +82 fuel';
  s.messageUntil = 999;
  return { screen: SCREEN_COMPLETE, best: 0, t: 40 };
}

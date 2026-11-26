// Golden Hour: Island Run — the world and the flight rules.
// A tropical archipelago at golden hour: one big island with a runway, smaller
// islands to thread rings around, open sea between them. The plane flies a real
// arcade flight model: throttle, bank, pitch, lift, stall, fuel and terrain.
import { COURSE, PLANE } from './config.js';
import { mulberry32, range } from './random.js';

export const STEP = 1 / 60;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_OVER = 8;
export const EVENT_FUEL_EMPTY = 16;

const DEG = Math.PI / 180;

/** The runway: a flat strip on the home island, heading north. */
export const RUNWAY = {
  x: 0,
  zStart: 1150,
  zEnd: 1950,
  halfWidth: 22,
  // The strip sits on the home island's flat top (52), a touch above it, so
  // the runway reads over the grass instead of sinking under it.
  elevation: 54,
  headingDeg: 0, // north, +z
};

function makeIslands(rng) {
  const islands = [
    // Home island: big, flat-topped, holds the runway.
    { x: 0, z: 1550, r: 980, h: 52, flat: true },
    { x: -1450, z: 2600, r: 520, h: 120 },
    { x: 1350, z: 2900, r: 430, h: 95 },
    { x: -2100, z: 600, r: 380, h: 80 },
    { x: 1900, z: 700, r: 460, h: 140 },
    { x: -900, z: 3900, r: 350, h: 70 },
    { x: 900, z: 4300, r: 400, h: 110 },
    { x: -2600, z: 3300, r: 300, h: 65 },
    { x: 2500, z: 3400, r: 320, h: 90 },
    { x: 0, z: -900, r: 420, h: 75 },
    { x: -1500, z: -1400, r: 300, h: 60 },
    { x: 1600, z: -1200, r: 340, h: 85 },
  ];
  // A few palm clusters on each island, placed by seed.
  for (const island of islands) {
    island.palms = [];
    const count = Math.floor(range(rng, 5, 11));
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const d = rng() * island.r * 0.72;
      island.palms.push({ x: island.x + Math.cos(a) * d, z: island.z + Math.sin(a) * d, s: range(rng, 0.7, 1.4) });
    }
  }
  return islands;
}

function makeRings() {
  // A course that loops the archipelago and comes home to the runway.
  const stops = [
    { x: 0, z: 2300, y: 110 },
    { x: -900, z: 2900, y: 150 },
    { x: -1900, z: 2400, y: 170 },
    { x: -1800, z: 900, y: 130 },
    { x: -600, z: -400, y: 160 },
    { x: 1200, z: -900, y: 180 },
    { x: 2100, z: 500, y: 140 },
    { x: 1700, z: 2400, y: 150 },
    { x: 900, z: 3400, y: 170 },
    { x: 0, z: 2600, y: 120 },
  ];
  return stops.map((s, i) => ({ ...s, r: COURSE.ringRadius, index: i, done: false }));
}

function makeClouds(rng) {
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      azimuthDeg: rng() * 360,
      elevationDeg: range(rng, 6, 26),
      size: range(rng, 60, 220),
      speed: range(rng, 0.1, 0.5),
    });
  }
  return clouds;
}

/** Height of the ground at (x, z): 0 over open sea, island bumps on land. */
export function groundHeight(islands, x, z) {
  let h = 0;
  for (const island of islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d2 = dx * dx + dz * dz;
    const r2 = island.r * island.r;
    if (d2 >= r2 * 2.25) continue;
    const fall = Math.exp(-d2 / (r2 * 0.55));
    const top = island.flat ? Math.min(1, fall * 1.6) : fall;
    h = Math.max(h, island.h * top);
  }
  // The runway strip is graded flat.
  if (Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth + 60 && z > RUNWAY.zStart - 60 && z < RUNWAY.zEnd + 60) {
    const blend = Math.min(1, (RUNWAY.halfWidth + 60 - Math.abs(x - RUNWAY.x)) / 60);
    h = Math.max(h * (1 - blend), RUNWAY.elevation * blend);
    if (Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth && z > RUNWAY.zStart && z < RUNWAY.zEnd) h = RUNWAY.elevation;
  }
  return h;
}

export function overRunway(x, z) {
  return Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth && z > RUNWAY.zStart && z < RUNWAY.zEnd;
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.islands = makeIslands(rng);
    this.rings = makeRings();
    this.clouds = makeClouds(rng);
    this.reset();
  }

  reset() {
    this.state = {
      x: RUNWAY.x,
      z: RUNWAY.zStart + 60,
      y: RUNWAY.elevation + 2,
      headingDeg: 0,
      pitchDeg: 0,
      bankDeg: 0,
      speed: 0,
      throttle: 0,
      fuel: PLANE.startFuel,
      ringsDone: 0,
      score: 0,
      time: 0,
      onGround: true,
      crashed: false,
      landed: false,
      finished: false,
      crashReason: '',
      message: '',
      messageUntil: 0,
      nextRing: 0,
    };
    for (const ring of this.rings) ring.done = false;
    this.time = 0;
  }

  groundAt(x, z) {
    return groundHeight(this.islands, x, z);
  }

  /** One physics step. `input` is {turn, pitch, throttle, boost, brake}. Returns events. */
  step(dt, input) {
    const s = this.state;
    if (s.finished || s.crashed) return 0;
    s.time += dt;
    this.time = s.time;
    let events = 0;

    // Throttle and speed: thrust fights quadratic drag plus rolling resistance.
    s.throttle = Math.max(0, Math.min(1, s.throttle + (input.throttle ?? 0) * dt * 0.9));
    if (input.boost && s.fuel > 0) s.throttle = 1;
    const thrust = s.throttle * 26;
    const dragForce = 0.0032 * s.speed * s.speed + (s.onGround ? 2.5 : 0);
    const climbCost = Math.max(0, Math.sin(s.pitchDeg * DEG)) * 9;
    s.speed += (thrust - dragForce - climbCost) * dt;
    if (input.brake) s.speed -= 22 * dt;
    s.speed = Math.max(0, Math.min(PLANE.maxSpeed, s.speed));

    // Bank and turn: the turn rate grows with bank and speed.
    const targetBank = (input.turn ?? 0) * PLANE.maxBankDeg;
    s.bankDeg += (targetBank - s.bankDeg) * Math.min(1, dt * 3.2);
    // Turn rate grows with bank and speed: ~11 deg/s at full bank, cruise speed.
    s.headingDeg = (s.headingDeg + s.bankDeg * s.speed * 0.004 * dt + 360) % 360;

    // Pitch: the nose follows the stick, softened at low speed.
    const targetPitch = (input.pitch ?? 0) * PLANE.maxPitchDeg;
    const authority = Math.min(1, s.speed / 40);
    s.pitchDeg += (targetPitch - s.pitchDeg) * Math.min(1, dt * 2.4 * authority);

    // Lift: climb when fast and pitched up; sink when slow (stall).
    // On the ground the wheels hold the plane down: no vertical movement.
    const flying = !s.onGround;
    let vs = s.speed * Math.sin(s.pitchDeg * DEG);
    if (s.speed < PLANE.stallSpeed && flying) vs -= (PLANE.stallSpeed - s.speed) * 0.55;
    if (flying) s.y += vs * dt;

    // Move over the ground.
    const hdg = s.headingDeg * DEG;
    s.x += Math.sin(hdg) * s.speed * Math.cos(s.pitchDeg * DEG) * dt;
    s.z += Math.cos(hdg) * s.speed * Math.cos(s.pitchDeg * DEG) * dt;

    // Fuel.
    const drain = (input.boost ? PLANE.fuelBoostDrain : PLANE.fuelDrain) * (0.4 + s.throttle);
    s.fuel = Math.max(0, s.fuel - drain * dt);
    if (s.fuel <= 0 && !s.onGround) s.throttle = 0; // glide: the ground decides

    // Takeoff: fast enough on the runway and pulling up.
    if (s.onGround && s.speed > PLANE.takeoffSpeed && s.pitchDeg > 2) {
      s.onGround = false;
      s.graceUntil = s.time + 1.5; // climbing away: the ground must not catch it
      this.say('Airborne! Follow the rings');
    }

    // Ground contact (skipped during the touch-and-go grace window).
    const ground = this.groundAt(s.x, s.z);
    if (s.y <= ground + 3 && s.time > (s.graceUntil ?? 0)) {
      s.y = ground + 3;
      if (!s.onGround) {
        if (overRunway(s.x, s.z) && Math.abs(vs) < 9 && s.speed < 58 && Math.abs(s.bankDeg) < 20) {
          s.onGround = true;
          s.landed = true;
          events |= EVENT_LANDED;
          if (s.ringsDone >= COURSE.rings) {
            s.finished = true;
            const timeBonus = Math.max(0, (COURSE.parSeconds - s.time) | 0) * COURSE.timeBonusPerSecond;
            const fuelBonus = Math.round(s.fuel) * 2;
            s.score += COURSE.landingBonus + timeBonus + fuelBonus;
            this.say(`Landed! +${COURSE.landingBonus} landing, +${timeBonus} time, +${fuelBonus} fuel`);
          } else {
            // Touch-and-go: not all rings are done. Bounce back into the air
            // with a climb and a short grace window so the runway does not
            // catch the plane again on the next step.
            this.say(`Landed — ${COURSE.rings - s.ringsDone} rings left. Take off again!`);
            s.onGround = false;
            s.y = ground + 26;
            s.pitchDeg = 10;
            s.graceUntil = s.time + 2.5;
          }
          if (s.finished) events |= EVENT_OVER;
        } else {
          return this.crash(s, s.y <= 2 ? 'Ditched in the sea' : 'Hit the hillside', events);
        }
      }
      // (No forced stop here: rolling resistance in the speed step brings the
      // plane to rest on its own, and zeroing low speed would block takeoff.)
    }
    // Rolling on the ground follows the terrain down as well as up.
    if (s.onGround) s.y = ground + 3;

    // Rings: fly through the glowing hoop.
    const ring = this.rings[s.nextRing];
    if (ring && !ring.done) {
      const dx = s.x - ring.x;
      const dy = s.y - ring.y;
      const dz = s.z - ring.z;
      if (dx * dx + dy * dy + dz * dz < (ring.r + 8) * (ring.r + 8)) {
        ring.done = true;
        s.ringsDone += 1;
        s.score += COURSE.ringScore;
        s.fuel = Math.min(100, s.fuel + PLANE.ringFuel);
        events |= EVENT_RING;
        s.nextRing = Math.min(COURSE.rings, s.nextRing + 1);
        this.say(s.ringsDone >= COURSE.rings
          ? `Last ring! Land on the runway`
          : `Ring ${s.ringsDone}/${COURSE.rings}! +${COURSE.ringScore}`);
      }
    }

    // World edge: turn the plane back with a warning instead of a wall.
    if (Math.abs(s.x) > 5200 || Math.abs(s.z) > 5200) {
      this.say('Turn back — open ocean ahead');
      s.headingDeg = (s.headingDeg + 180) % 360;
      s.x = Math.max(-5000, Math.min(5000, s.x));
      s.z = Math.max(-5000, Math.min(5000, s.z));
    }
    return events;
  }

  crash(s, reason, events) {
    s.crashed = true;
    s.finished = true;
    s.crashReason = reason;
    this.say(reason);
    return events | EVENT_CRASHED | EVENT_OVER;
  }

  say(text) {
    const s = this.state;
    s.message = text;
    s.messageUntil = s.time + 3.2;
  }
}

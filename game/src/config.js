// Golden Hour: Island Run — configuration.
// One place for every number the flight model, the world and the renderer share,
// so a tweak here retunes the whole game without touching the rules.
export const VIEW = { width: 1280, height: 720, fov: 70 };

export const PLANE = {
  name: 'Kancil-1',
  cruiseSpeed: 62, // m/s at full throttle, level flight
  maxSpeed: 95,
  stallSpeed: 26, // below this the wing stops flying and the plane sinks
  takeoffSpeed: 32,
  maxBankDeg: 48,
  maxPitchDeg: 16,
  minPitchDeg: -14,
  climbRate: 13, // m/s at full climb
  fuelDrain: 0.32, // per second at cruise throttle
  fuelBoostDrain: 0.9, // per second while boosting
  ringFuel: 22, // fuel a ring gives back
  startFuel: 100,
};

export const COURSE = {
  rings: 10,
  ringRadius: 26,
  ringScore: 100,
  landingBonus: 500,
  timeBonusPerSecond: 4, // bonus for finishing fast, from a 360 s par
  parSeconds: 360,
};

export const SUN = {
  // Golden hour: the sun sits low in the west, so the start heading looks into it.
  azimuthDeg: 262,
  elevationDeg: 11,
};

export const COLORS = {
  skyTop: '#274b7d',
  skyMid: '#e8915a',
  skyLow: '#ffd9a0',
  seaDeep: '#1d5f7e',
  seaGlitter: '#ffb347',
  sand: '#f2d8a0',
  palmGreen: '#2f7d4f',
  hillGreen: '#4c9a58',
  hillDark: '#35703f',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ring: '#ffd94a',
  ringDone: '#7dff8a',
  hudAmber: '#ffb347',
  panel: '#10151d',
};

// Solara City — every tuning number in one place, so the game can be balanced
// by editing this file alone. All distances are metres, all speeds m/s.

// --- City layout -----------------------------------------------------------
export const CITY = {
  pitch: 58, // street centreline to street centreline
  streets: 7, // streets per axis (centrelines at -3..3 * pitch)
  streetWidth: 14,
  blockSize: 44,
  bounds: 260, // playable clamp (half-extent)
  coastX: 225, // water starts east of here
  beachWidth: 22,
};

// --- Player on foot --------------------------------------------------------
export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  radius: 0.55,
  height: 1.8,
  health: 100,
  punchRange: 2.4,
  punchDamage: 30,
  punchCooldown: 0.45,
  shootCooldown: 0.24,
  gunDamage: 55,
  gunRange: 90,
};

// --- Cars ------------------------------------------------------------------
export const CAR = {
  maxSpeed: 40, // player sports car
  maxSpeedTraffic: 13,
  maxSpeedPolice: 42,
  accel: 22,
  brake: 34,
  reverseMax: 11,
  steerMax: 0.55, // radians of front-wheel angle at low speed
  grip: 7.5, // lateral velocity damping (lower = more slide)
  handbrakeGrip: 1.6,
  radius: 1.7,
  health: 100,
  trafficCount: 18,
  parkedCount: 10,
};

// --- Wanted / police -------------------------------------------------------
export const WANTED = {
  maxStars: 5,
  // police cars on the road per star level
  carsPerStar: [0, 1, 2, 3, 4, 5],
  spawnDistance: 85,
  despawnDistance: 190,
  bustDistance: 3.2, // police this close to a slow player on foot -> caught
  bustTime: 1.6, // seconds inside bustDistance to get caught
  decayDelay: 8, // seconds unseen before stars start falling
  decayInterval: 4, // seconds per lost star
  ramDamage: 14, // health lost when a police car rams the player on foot
  ramCooldown: 1.0,
};

// --- Missions --------------------------------------------------------------
export const MISSION_REWARDS = [150, 300, 500];
export const FARE_REWARD_MIN = 100;
export const FARE_REWARD_MAX = 250;

// --- Look ------------------------------------------------------------------
export const LOOK = {
  skyColor: 0x8ec9ee,
  fogColor: 0xa8c8e0,
  fogNear: 120,
  fogFar: 420,
  sunColor: 0xfff1cf,
  sunIntensity: 1.35,
  hemiSky: 0xbfd9ff,
  hemiGround: 0x8a7a5a,
  hemiIntensity: 0.85,
  waterColor: 0x1e6f8e,
  sandColor: 0xe0c98f,
  asphalt: 0x2e3138,
  sidewalk: 0x9aa0a3,
  grass: 0x5d8a4a,
};

// --- Camera ----------------------------------------------------------------
export const CAMERA = {
  followDistance: 9.5,
  followHeight: 3.6,
  minDistance: 5,
  maxDistance: 20,
  orbitSpeed: 0.005,
  lookAhead: 6,
};

// --- Save ------------------------------------------------------------------
export const SAVE_KEY = 'solara-city-save-v1';

// --- Screenshot staging ----------------------------------------------------
export const SHOT_SIZE = { width: 1280, height: 800 };

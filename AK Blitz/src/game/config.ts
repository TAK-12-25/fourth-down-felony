// ============================================================================
// config.ts — field geometry + gameplay tuning. Tweak feel here.
// World units = yards. Offense always drives toward +Z.
// ============================================================================

export const FIELD = {
  HALF_W: 13, // sideline at x = +/-13  (26 wide arcade field)
  LEN: 80, // field of play z = 0..80
  EZ: 10, // end zone depth
  get GOAL_Z() {
    return this.LEN;
  }, // defense goal line (offense scores crossing this)
};

export const PLAYER = {
  RADIUS: 0.9,
  HEIGHT: 2.0,
  Y: 1.0, // capsule center height
  MAX_SPEED: 13.5, // units/s at speed=100
  TURBO_MULT: 1.4,
  ACCEL: 60, // approach rate
  TURN_RATE: 12, // facing lerp
};

export const BALL = {
  RADIUS: 0.35,
  SPEED: 34, // throw travel speed (units/s)
  CATCH_RADIUS: 2.2,
  GRAVITY: 26,
};

export const RULES = {
  DOWNS: 4,
  FIRST_DOWN_YDS: 10,
  TD_POINTS: 7,
  TARGET_SCORE: 21,
  QUARTER_SECONDS: 120, // single-period arcade clock for the slice
};

export const CAMERA = {
  HEIGHT: 22,
  BACK: 26, // distance behind the focus along -Z
  FOV: 0.8,
  FOLLOW_LERP: 3.2, // higher = snappier
  LOOK_AHEAD: 6, // look slightly downfield of focus
  SHAKE_DECAY: 6,
};

export const TURBO = {
  MAX: 100,
  DRAIN: 38, // per second while held
  REGEN: 18, // per second while not held
};

export const MAYHEM = {
  MAX: 100,
  GAIN_BIGHIT: 22,
  GAIN_DIRTY: 28,
  GAIN_TD: 40,
  GAIN_INT: 35,
  GAIN_SACK: 18,
  GAIN_HURDLE: 10,
  GAIN_STIFF: 8,
  GAIN_LONG: 20,
};

export const HEAT = {
  DURATION: 9, // seconds on fire
  SPEED_BOOST: 1.18,
  HIT_BOOST: 1.4,
};

export const WANTED = {
  MAX: 100,
  GAIN_DIRTY: 18,
  GAIN_CARTOFF: 25,
  GAIN_TAUNT: 10,
};

// NEON HARBOR — shared tuning and world constants.
// One place for the numbers every other module reads: city geometry, physics
// feel, wanted-level pressure and the colour language of Azura Bay. Nothing
// here touches the DOM or three.js, so the headless checks can import it too.

export const CITY = {
  // The street grid: square blocks separated by two-lane roads. Road centre
  // lines sit at multiples of PITCH; buildings live inside the blocks.
  pitch: 74,
  roadHalf: 8,          // half the road width in metres
  sidewalk: 3.2,        // sidewalk band between road edge and block face
  blocks: 3,            // blocks run -BLOCKS..+BLOCKS on both axes
  get extent() { return this.blocks * this.pitch + this.pitch / 2; },
};

export const PLAYER = {
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  radius: 0.55,
  maxHealth: 100,
  maxArmor: 100,
  startCash: 120,
};

export const CAR = {
  accel: 14,
  brake: 26,
  reverseMax: 9,
  drag: 0.55,
  gripTurn: 2.15,       // steering responsiveness at speed
  radius: 1.35,
};

export const WANTED = {
  // Crime points per act; every 100 points is a star, capped at five.
  theft: 55,
  assault: 45,
  shooting: 30,
  hitAndRun: 85,
  copKill: 120,
  propertyDamage: 18,
  missionHeat: 100,
  decayPerSecond: 2.2,  // only while no cop can see the player
  washCostPerStar: 110, // Suds & Shine respray price
};

export const DAY_LENGTH_SECONDS = 260; // one full Azura Bay day

export const PALETTE = {
  sky: { dawn: 0xffb37a, day: 0x8fd4ff, dusk: 0xff8a5c, night: 0x0b1026 },
  sun: 0xffe3b3,
  road: 0x2b2f36,
  roadLine: 0xf7d774,
  sidewalk: 0x9aa0a8,
  grass: 0x3f9e63,
  sand: 0xe8d29a,
  water: 0x1d6f9f,
  buildingBase: [0xf2e3c9, 0xdfe8ee, 0xf6cfc0, 0xcfe3d8, 0xe8dff2, 0xf9ecc8],
  neon: [0xff5d8f, 0x35c4b5, 0xffb454, 0x7a6cff, 0xffe14d],
  carPaint: [0xd64545, 0x3f7fd1, 0xf2f2f2, 0x22262c, 0x35c4b5, 0xffb454,
             0x7a6cff, 0x8bc34a, 0xff5d8f, 0xc0c6cc, 0x8a5a2b, 0x2e8b6e],
  copPaint: 0x1c2733,
  copStripe: 0xf5f7fa,
};

export const NAMES = {
  city: 'Azura Bay',
  hero: 'Rio',
  heroFull: 'Rio Santoso',
  fixer: 'Mama Lala',
  friend: 'Dedi',
  copChief: 'Inspector Ratna',
  gang: 'the Coral Kings',
  washShop: 'Suds & Shine',
  gunStore: 'Bima Arms',
  hospital: 'Azura General',
  precinct: 'Bay Precinct',
  safehouse: 'Palm Court Motel',
  diner: 'Warung Senja',
  club: 'Club Kelapa',
  garage: 'Bengkel Jaya',
};

export const CONTROLS_HELP = [
  ['W A S D', 'move / drive'],
  ['Mouse', 'orbit camera — click the game to lock the pointer'],
  ['Shift', 'sprint on foot / handbrake in a car'],
  ['F', 'enter / exit a car'],
  ['Left click', 'shoot (on foot)'],
  ['E', 'talk / buy / use'],
  ['Tab', 'next radio station (in a car)'],
  ['P or Esc', 'pause'],
  ['M', 'mute'],
];

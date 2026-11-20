// config.js — shared tuning values for NEON HARBOR.
// Everything gameplay-related that more than one module needs lives here so
// the balance can be adjusted in a single place.

export const CONFIG = {
  // World layout. Azura Bay is a square grid of blocks; the bay itself sits
  // along the eastern edge, beyond the last avenue.
  worldSize: 640,
  blockSize: 64,
  roadWidth: 14,
  roadSpacing: 78,
  sidewalkWidth: 3.2,
  beachX: 268,
  waterX: 292,

  // Player on foot.
  walkSpeed: 5.2,
  runSpeed: 9.0,
  playerRadius: 0.55,
  playerHealth: 100,

  // Vehicles.
  carAccel: 26,
  carBrake: 42,
  carReverseAccel: 12,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  bikeMaxSpeed: 40,
  copMaxSpeed: 37,
  trafficMaxSpeed: 13,
  steerRate: 1.9,
  gripDry: 9.5,
  gripWet: 4.2,
  driftGrip: 2.1,
  handbrakeDrag: 3.2,

  // Combat.
  pistolDamage: 34,
  pistolRange: 90,
  pistolCooldown: 0.22,
  muzzleLife: 0.05,

  // Wanted system. Points accumulate; stars are derived from thresholds.
  wantedThresholds: [0, 12, 30, 55, 85, 125],
  heatCarCrime: 10,
  heatShotFired: 6,
  heatHitPed: 26,
  heatHitCop: 40,
  heatVehicleTheft: 8,
  heatDecayPerSecond: 1.1,
  bustRadius: 3.4,
  bustFillRate: 0.55,
  bustDrainRate: 0.8,

  // Economy.
  startingCash: 250,
  resprayCost: 150,
  hospitalCost: 100,

  // Day cycle / atmosphere.
  fogColor: 0x2a1e3f,
  skyTop: 0x3b2a63,
  skyHorizon: 0xff8c5a,
  sunColor: 0xffb36b,

  // Traffic and population density.
  trafficCount: 14,
  pedestrianCount: 26,
  copCarCount: 4,
  copFootCount: 5,
};

// The eight named places of Azura Bay. Coordinates are world units with the
// city centre at the origin; x grows east (toward the water), z grows south.
export const LANDMARKS = [
  { name: "Pelangi Motel", x: -196, z: -150 },
  { name: "Mama Lala's Diner", x: -60, z: -84 },
  { name: "Club Sirena", x: 96, z: -168 },
  { name: "Haris Auto Repair", x: -150, z: 40 },
  { name: "Toko Senjata Budi", x: 30, z: 96 },
  { name: "Splash & Go Car Wash & Respray", x: 150, z: 60 },
  { name: "Santa Rosa Hospital", x: -96, z: 176 },
  { name: "Azura Bay Police Precinct", x: 60, z: -30 },
];

// Sunset-and-neon palette shared by city dressing and vehicle paint.
export const PALETTE = {
  buildingA: 0x8a5a7a,
  buildingB: 0x5a6a9a,
  buildingC: 0x9a6a4a,
  buildingD: 0x4a7a8a,
  neonPink: 0xff3d8a,
  neonCyan: 0x2ee6e6,
  neonAmber: 0xffb02e,
  neonViolet: 0x9a5cff,
  asphalt: 0x2b2b33,
  sidewalk: 0x8f8a96,
  sand: 0xd9b380,
  water: 0x1d5f7a,
  palmTrunk: 0x7a5a3a,
  palmLeaf: 0x2e8a5a,
  carPaint: [
    0xd94f6a, 0x3f7ad9, 0xf2b134, 0x53c98a, 0xe8e4da,
    0x8a5cff, 0x2ee6e6, 0xd96a2e, 0x5a6270, 0xf27ad9,
  ],
};

// NEON HARBOR v2 — central tuning and naming table.
// Every other module reads its numbers from here so the whole game can be
// rebalanced from one file. Nothing in this file touches the DOM or three.js.

export const CFG = {
  world: {
    blocksPerSide: 5,        // city is 5 x 5 blocks
    blockSize: 58,           // buildable square inside one block (metres)
    roadWidth: 22,           // asphalt between blocks
    get pitch() { return this.blockSize + this.roadWidth; },
    get span() { return this.blocksPerSide * this.blockSize + (this.blocksPerSide + 1) * this.roadWidth; },
    get half() { return this.span / 2; },
    beachWidth: 46,          // sand strip east of the last road
    waterLevel: -1.4,
    groundLevel: 0,
  },
  day: {
    startHour: 8,            // new games begin at 08:00
    minutesPerSecond: 1.6,   // game minutes per real second
    dawnHour: 5.5,
    duskHour: 18.5,
  },
  player: {
    walkSpeed: 6.2,
    sprintSpeed: 10.5,
    radius: 0.55,
    maxHealth: 100,
    maxArmour: 100,
    startCash: 120,
    gravity: 22,
  },
  vehicles: {
    carAccel: 16,
    carBrake: 30,
    carReverse: 7,
    carTopSpeed: 34,
    bikeTopSpeed: 42,
    bikeAccel: 22,
    turnRate: 1.55,          // radians per second at full lock
    gripDry: 7.5,
    gripWet: 3.4,
    trafficTopSpeed: 13,
    copTopSpeed: 30,
    trafficCount: 14,
    parkedCount: 16,
  },
  weapons: {
    pistol: { name: "PISTOL", damage: 34, range: 85, cooldown: 0.26, spread: 0.012 },
    fists: { name: "FISTS", damage: 0, range: 0, cooldown: 0.5, spread: 0 },
  },
  wanted: {
    // points needed to *reach* each star count (index = stars)
    thresholds: [0, 30, 80, 160, 280, 430],
    decayPerSecond: 2.2,     // applied only while unseen
    unseenAfterSeconds: 6,
    crimePoints: {
      theft: 26,
      shotFired: 9,
      hitPerson: 55,
      killPerson: 90,
      hitCar: 14,
      hitCopCar: 40,
      missionHeat: 30,
    },
    copCarsPerStar: [0, 1, 2, 3, 4, 6],
    footOfficersAtStars: 3,  // foot officers join from this star count
    roadblockAtStars: 4,
    bustFillPerSecond: 0.55,
    bustDrainPerSecond: 0.8,
    bustRange: 4.2,
  },
  prices: {
    respray: 250,
    hospitalBill: 150,
    bustFineBase: 120,       // plus per-star amount below
    bustFinePerStar: 90,
    armourPickup: 0,         // armour is a mission reward, not sold
  },
  economy: {
    courierBase: 140,
    courierPerMetre: 0.55,
  },
  palette: {
    skyDay: 0x87c9e8,
    skyNight: 0x0a1030,
    skyDusk: 0xff9a62,
    fogDay: 0xa8c8dc,
    water: 0x0d4a63,
    sand: 0xe0c491,
    asphalt: 0x59616c,
    sidewalk: 0xa8a9a4,
    buildingTones: [0xc9b8a3, 0x9fb4c7, 0xd8cfae, 0xb7a6c9, 0xa3c9b8, 0xd9a08a, 0x8fa3b8, 0xe0d6c2],
    carPaints: [0xd64550, 0x3f7fbf, 0xf2b134, 0x4caf7d, 0xe8e6df, 0x22262e, 0x8e44ad, 0xef7f45, 0x37b8a5, 0xc0c6ce],
    neonSigns: [0xff4d8d, 0x37e0d8, 0xffc857, 0x7dff9a, 0x6db3ff],
    copPaint: 0xf2f2f2,
    copTrim: 0x1c2f6e,
    gangShirt: 0xff7f45,
  },
};

export const NAMES = {
  city: "Azura Bay",
  hero: "Rio Santoso",
  fixer: "Mama Lala",
  rivalLeader: 'Bima "Reef" Prasetyo',
  rivalGang: "Coral Kings",
  landmarks: {
    motel: "Pelangi Motel",
    diner: "Mama Lala's Diner",
    club: "Club Sirena",
    garage: "Haris Auto Repair",
    arms: "Toko Senjata Budi",
    wash: "Splash & Go Car Wash",
    hospital: "Santa Rosa Hospital",
    precinct: "Azura Bay Precinct",
  },
  radioStations: [
    { name: "Harbour FM", style: "pop" },
    { name: "Sirena Nights", style: "chill" },
    { name: "Bay Talk AM", style: "talk" },
  ],
};

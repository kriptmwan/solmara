// Solmara — configuration: world size, road grid, tuning numbers, palettes and named places.
// Every number the rest of the game shares lives here so a tweak lands in one place.
export const STEP = 1 / 60;
export const WORLD = { w: 4800, h: 3600 };

// Road grid. Roads are centred on these lines; ROAD_W is the asphalt width, SIDEWALK the
// pavement strip on each side. Blocks (and their buildings) fill the space between roads.
export const ROAD_W = 130;
export const SIDEWALK = 26;
export const V_ROADS = [500, 1100, 1700, 2300, 2900, 3500, 4100];
export const H_ROADS = [450, 950, 1450, 1950, 2450, 2950];

// The sea is the whole west edge: water, then a sand beach, then the city starts.
export const WATER_X = 150;
export const BEACH_X = 340;

// Car models: top speed (px/s), acceleration, handling and size. All six appear in the city.
export const CAR_MODELS = {
  sedan:   { top: 380, accel: 260, steer: 2.6, len: 52, wid: 26, label: 'Sedan' },
  taxi:    { top: 400, accel: 280, steer: 2.7, len: 52, wid: 26, label: 'Taxi' },
  van:     { top: 310, accel: 200, steer: 2.1, len: 60, wid: 28, label: 'Van' },
  pickup:  { top: 360, accel: 240, steer: 2.4, len: 56, wid: 27, label: 'Pickup' },
  sports:  { top: 540, accel: 420, steer: 3.1, len: 54, wid: 25, label: 'Comet GT' },
  police:  { top: 480, accel: 360, steer: 3.0, len: 54, wid: 26, label: 'Cruiser' },
};

export const CAR_COLORS = {
  sedan: ['#c0392b', '#2e6fb0', '#7d8a96', '#3f7d4e', '#b08a2e', '#5b4a68'],
  taxi: ['#f2c200'],
  van: ['#d8d8d8', '#8a6f4d', '#4d6f8a'],
  pickup: ['#a0522d', '#2f5d3a', '#6b7c8a'],
  sports: ['#e8232a', '#ffd21f', '#1fd6c9'],
  police: ['#e8e8e8'],
};

// Named places the missions and side jobs point at. Waypoints sit on roads so cars can reach them.
export const SPOTS = {
  spawn:     { x: 1750, y: 1030, label: 'Celia\u2019s Cafe' },
  cafe:      { x: 1700, y: 950,  label: 'Celia\u2019s Cafe' },
  garage:    { x: 2900, y: 1950, label: 'Ray\u2019s Garage' },
  marinaCar: { x: 430,  y: 3050, label: 'Marina' },
  docks:     { x: 430,  y: 2650, label: 'The Docks' },
  safehouse: { x: 4100, y: 450,  label: 'Safehouse' },
  bank:      { x: 2300, y: 1520, label: 'Solmara National Bank' },
  boat:      { x: 300,  y: 3180, label: 'Escape Boat' },
  hospital:  { x: 1100, y: 2450, label: 'Solmara General' },
  taxiStand: { x: 1100, y: 950,  label: 'Taxi Stand' },
};

// Ten hidden packages, scattered where a player who explores will find them.
export const PACKAGE_SPOTS = [
  { x: 500,  y: 450 },  { x: 1100, y: 1450 }, { x: 1700, y: 2450 }, { x: 2300, y: 950 },
  { x: 2900, y: 450 },  { x: 3500, y: 1950 }, { x: 4100, y: 1450 }, { x: 600,  y: 3200 },
  { x: 2600, y: 2700 }, { x: 3800, y: 2900 },
];

// Tuning for the player, the wanted system and the economy.
export const PLAYER = {
  walk: 205, run: 345, radius: 14, health: 100,
  pistolMag: 12, reloadTime: 1.1, meleeRange: 46, meleeDamage: 34,
};
export const WANTED = {
  // Heat thresholds for each star: 0, 1, 2, 3, 4, 5.
  stars: [0, 12, 32, 55, 80, 101],
  decayPerSec: 1.6,      // heat lost while no cop can see the player and no recent crime
  stealHeat: 14, hitPedHeat: 18, killPedHeat: 30, killCopHeat: 45,
  maxCruisers: 3, maxFootCops: 4,
};
export const ECONOMY = {
  missionPay: [150, 400, 600, 900, 2500],
  packagePay: 150, fareMin: 25, fareMax: 60,
};

// Colours for the sun-soaked look: warm concrete, dark asphalt, turquoise sea.
export const PALETTE = {
  ground: '#b3a98f', road: '#3b4048', roadEdge: '#2e3238', sidewalk: '#9d968a',
  lane: '#e8d44d', laneWhite: '#e8e8e8', crosswalk: '#e8e8e8',
  sand: '#ecd9a0', water: '#2f8fb5', waterDeep: '#1f6f92',
  park: '#69a85c', parkDark: '#4f8a44',
  building: ['#c98a5e', '#a8674d', '#d9b380', '#8fa3b0', '#b5766a', '#7d8a7a', '#c2a878'],
  tower: ['#5d7d99', '#6d8aa0', '#7a6d8a', '#4d6d7d'],
  roof: '#8a7a66',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmara.save.v1';

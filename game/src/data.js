// The campaign's real content: 8 routes, 24 contracts (3 per route), 12 aircraft upgrades,
// 10 pilot feats and 6 weather conditions. Every number in the entry's title is one of these
// tables, and the game really plays them: contracts complete in order, upgrades are bought
// with earned credits in the hangar and change the plane, feats unlock on the conditions named.
export const ROUTES = [
  { id: 1, name: 'Coral Coast', from: 'Marina Bay', to: 'Coral Light', weather: 'Dawn Clear', rings: 12, lengthKm: 84 },
  { id: 2, name: 'Ember Strait', from: 'Coral Light', to: 'Ember Point', weather: 'Sea Haze', rings: 14, lengthKm: 96 },
  { id: 3, name: 'Lantern Isles', from: 'Ember Point', to: 'Lantern Rock', weather: 'Low Clouds', rings: 14, lengthKm: 102 },
  { id: 4, name: 'Storm Shelf', from: 'Lantern Rock', to: 'Shelf Station', weather: 'Storm Cells', rings: 16, lengthKm: 118 },
  { id: 5, name: 'Glass Lagoon', from: 'Shelf Station', to: 'Glassport', weather: 'Dawn Clear', rings: 12, lengthKm: 88 },
  { id: 6, name: 'Tidewater Run', from: 'Glassport', to: 'Tidewater', weather: 'Crosswind', rings: 16, lengthKm: 124 },
  { id: 7, name: 'Aurora Ridge', from: 'Tidewater', to: 'Ridge Camp', weather: 'Mountain Wind', rings: 18, lengthKm: 142 },
  { id: 8, name: 'Homecoming', from: 'Ridge Camp', to: 'Marina Bay', weather: 'Dawn Clear', rings: 18, lengthKm: 150 },
];

export const CONTRACTS = [
  { id: 1, route: 1, name: 'Dawn Parcels', rings: 12, cargo: 5, par: 150, pay: 240 },
  { id: 2, route: 1, name: 'Lighthouse Post', rings: 12, cargo: 5, par: 140, pay: 260 },
  { id: 3, route: 1, name: 'Coral Samples', rings: 12, cargo: 6, par: 135, pay: 300 },
  { id: 4, route: 2, name: 'Ember Medicine', rings: 14, cargo: 5, par: 160, pay: 320 },
  { id: 5, route: 2, name: 'Strait Charts', rings: 14, cargo: 6, par: 155, pay: 340 },
  { id: 6, route: 2, name: 'Ferry Spares', rings: 14, cargo: 6, par: 150, pay: 360 },
  { id: 7, route: 3, name: 'Lantern Oil', rings: 14, cargo: 5, par: 165, pay: 380 },
  { id: 8, route: 3, name: 'Isle Mail', rings: 14, cargo: 6, par: 160, pay: 400 },
  { id: 9, route: 3, name: 'Rock Survey', rings: 14, cargo: 7, par: 155, pay: 430 },
  { id: 10, route: 4, name: 'Storm Relay', rings: 16, cargo: 5, par: 180, pay: 460 },
  { id: 11, route: 4, name: 'Shelf Rescue', rings: 16, cargo: 6, par: 175, pay: 490 },
  { id: 12, route: 4, name: 'Beacon Parts', rings: 16, cargo: 7, par: 170, pay: 520 },
  { id: 13, route: 5, name: 'Lagoon Glass', rings: 12, cargo: 5, par: 150, pay: 420 },
  { id: 14, route: 5, name: 'Glassport Wine', rings: 12, cargo: 6, par: 145, pay: 450 },
  { id: 15, route: 5, name: 'Tide Tables', rings: 12, cargo: 6, par: 140, pay: 480 },
  { id: 16, route: 6, name: 'Tidewater Nets', rings: 16, cargo: 6, par: 180, pay: 540 },
  { id: 17, route: 6, name: 'Harbour Master', rings: 16, cargo: 7, par: 175, pay: 570 },
  { id: 18, route: 6, name: 'Storm Warning', rings: 16, cargo: 7, par: 170, pay: 600 },
  { id: 19, route: 7, name: 'Ridge Supplies', rings: 18, cargo: 6, par: 200, pay: 660 },
  { id: 20, route: 7, name: 'Aurora Film', rings: 18, cargo: 7, par: 195, pay: 700 },
  { id: 21, route: 7, name: 'Camp Medicine', rings: 18, cargo: 8, par: 190, pay: 740 },
  { id: 22, route: 8, name: 'Homecoming Mail', rings: 18, cargo: 7, par: 200, pay: 800 },
  { id: 23, route: 8, name: 'Festival Lights', rings: 18, cargo: 8, par: 195, pay: 850 },
  { id: 24, route: 8, name: 'Aurora Contract', rings: 18, cargo: 8, par: 185, pay: 1000 },
];

export const UPGRADES = [
  { id: 1, name: 'Kite Engine Mk II', cost: 200, effect: '+18 kt top speed' },
  { id: 2, name: 'Long-Range Tank', cost: 220, effect: '+25 fuel capacity' },
  { id: 3, name: 'Feather Wings', cost: 240, effect: '+20% turn rate' },
  { id: 4, name: 'Ring Magnet', cost: 260, effect: 'rings count from 20% wider' },
  { id: 5, name: 'Cargo Net', cost: 180, effect: '+1 cargo slot per run' },
  { id: 6, name: 'Storm Plating', cost: 300, effect: '+1 hull, hits hurt less' },
  { id: 7, name: 'Dawn Lanterns', cost: 160, effect: 'rings glow in haze' },
  { id: 8, name: 'Wind Reader', cost: 200, effect: 'shows gust warnings early' },
  { id: 9, name: 'Fuel Sipper', cost: 280, effect: '-20% fuel drain' },
  { id: 10, name: 'Combo Radio', cost: 240, effect: 'combo lasts 4 s longer' },
  { id: 11, name: 'Glass Cockpit', cost: 320, effect: 'instruments stay lit in storm' },
  { id: 12, name: 'Aurora Paint', cost: 400, effect: 'the fleet flagship livery' },
];

export const FEATS = [
  { id: 1, name: 'First Ring', test: 'Fly your first ring' },
  { id: 2, name: 'Perfect Dozen', test: '12 rings in a row, no miss' },
  { id: 3, name: 'Full Hold', test: 'Collect every cargo pod on a run' },
  { id: 4, name: 'Storm Rider', test: 'Finish a Storm Shelf contract' },
  { id: 5, name: 'Fuel Saver', test: 'Land with more than half a tank' },
  { id: 6, name: 'Combo Eight', test: 'Reach the x8 multiplier' },
  { id: 7, name: 'Speed Bird', test: 'Hold over 200 kt for 10 s' },
  { id: 8, name: 'Night Owl', test: 'Fly a full route without a hit' },
  { id: 9, name: 'Courier Prime', test: 'Complete 12 contracts' },
  { id: 10, name: 'Aurora Legend', test: 'Complete all 24 contracts' },
];

export const WEATHER = [
  { id: 1, name: 'Dawn Clear', wind: 6, haze: 0.0, gusts: 0 },
  { id: 2, name: 'Sea Haze', wind: 9, haze: 0.35, gusts: 1 },
  { id: 3, name: 'Low Clouds', wind: 12, haze: 0.2, gusts: 1 },
  { id: 4, name: 'Storm Cells', wind: 18, haze: 0.3, gusts: 3 },
  { id: 5, name: 'Crosswind', wind: 22, haze: 0.1, gusts: 2 },
  { id: 6, name: 'Mountain Wind', wind: 16, haze: 0.15, gusts: 2 },
];

export function routeOf(contract) {
  return ROUTES[contract.route - 1];
}
export function weatherOf(route) {
  return WEATHER.find((w) => w.name === route.weather) ?? WEATHER[0];
}

import { G } from './game.js';
import { S } from './state.js';
import { Village } from '../world/village.js';

export const currentTown = () => S.ferry?.away ? 1 : 0;
export const townsOpen = () => !!S.ferry && S.day >= S.ferry.ready;
// Saves from before the ferry had separate rosters belong to the original town.
export const townOf = record => record?.town ?? 0;
export const siteLot = site => typeof site === 'number' ? site : site?.lot;
export const townName = town => town === currentTown() ? S.village.name : S.ferry.other?.village.name || S.ferry.name;
export const residentsOf = (town = currentTown()) => S.residents.filter(id => townOf(S.villagers[id]) === town);
export const residentAt = lot => residentsOf().find(id => S.villagers[id].lot === lot);

let unvisited;
export function townLand(town) {
  if (town === currentTown()) return G.village;
  if (!townsOpen()) return null;
  if (S.ferry.other) return S.ferry.other.village.data;
  if (unvisited?.seed !== S.ferry.seed) {
    const {lots,buildings} = Village.create(S.ferry.seed);
    unvisited = {seed:S.ferry.seed,lots,buildings};
  }
  return unvisited;
}

export function reservedLots(town = currentTown(), exceptProject, exceptStory) {
  const sites=(S.prog?.pend.sites || []).filter(s => s !== exceptStory && townOf(s) === town).map(siteLot);
  const projects=(S.islandLife?.projects || []).filter(p => p !== exceptProject && townOf(p) === town);
  return sites.concat(projects.map(p => p.lot));
}

export function freeLots(town = currentTown(), exceptProject, exceptStory) {
  const land=townLand(town);
  if (!land) return [];
  const used=new Set(reservedLots(town, exceptProject, exceptStory));
  for (const id of residentsOf(town)) used.add(S.villagers[id].lot);
  return land.lots.map((_,i) => i).filter(i => !used.has(i));
}

export function refreshHouse(town, lot) {
  if (town === currentTown() && G.world) G.world.refreshBuilding(G.village.buildings[G.village.lots[lot]]);
}

import { findObject } from './inventory.js';
import { activeEncounter, resolveAttack } from './combat.js';

export const metals = ['steel', 'iron'];
export const capacity = 8;

export function reservesText(state) {
  return metals.map(metal =>
    `${metal}: ${state.reserves[metal]}/${capacity}${state.burning[metal] ? ' (burning)' : ''}`
  ).join(' · ');
}

export function toggleBurn(state, verb, metal) {
  if (!metals.includes(metal)) return `Try ${verb} steel or ${verb} iron.`;
  if (verb === 'extinguish') {
    if (!state.burning[metal]) return `You aren’t burning ${metal}.`;
    state.burning[metal] = false;
    return `You extinguish ${metal}.`;
  }
  if (state.burning[metal]) return `You’re already burning ${metal}.`;
  if (state.reserves[metal] < 2) return `You need at least two measures to light and use ${metal}. Type REFILL for more.`;
  state.reserves[metal]--;
  state.burning[metal] = true;
  return `You burn ${metal}. Blue lines point toward nearby metal. You can now ${metal === 'steel' ? 'push' : 'pull'}.`;
}

export function refill(state) {
  for (const metal of metals) state.reserves[metal] = capacity;
  return 'You swallow fresh flakes from your emergency pouch. Both reserves are full.';
}

export function manipulate(state, world, verb, target) {
  const metal = verb === 'push' ? 'steel' : 'iron';
  if (!target) return { message: `What would you like to ${verb}?` };
  if (!state.burning[metal]) return { message: `Burn ${metal} first to ${verb} metal.` };
  const entry = findObject(state, world, target, state.room);
  if (!entry) return { message: 'You need a target you can see here and aren’t carrying.' };
  const [id, object] = entry;
  if (!object.metal) return { message: 'No blue line leads to that. You can only move metal.' };
  if (!object.metal.manipulable) return { message: 'That metal is fixed in place and gives you no safe leverage.' };

  const effect = object.allomancy?.[verb];
  if (!effect) return { message: 'You can’t get a useful angle from here.' };
  if (effect.requires && !state.flags[effect.requires]) return { message: effect.blocked };
  if (!effect.message) return { message: effect.blocked };
  if (effect.flag && state.flags[effect.flag]) return { message: 'You’ve already done that.' };
  if (effect.attack && !activeEncounter(state, world)) return { message: 'The practice bout is over.' };

  const cost = object.metal.mass >= 10 ? 2 : 1;
  if (state.reserves[metal] < cost) return { message: `This takes ${cost} measures of ${metal}. Type REFILL for more.` };
  state.reserves[metal] -= cost;
  if (!state.reserves[metal]) state.burning[metal] = false;
  if (effect.attack) {
    const result = resolveAttack(state, world, verb);
    return {
      message: result.blocked ? 'The metal glances off the shield.' : effect.message,
      combat: result.text, moved: result.moved
    };
  }
  if (effect.flag) state.flags[effect.flag] = true;
  if (object.metal.anchored && effect.moveTo) {
    state.room = effect.moveTo;
    return { message: effect.message, moved: true };
  }
  if (!object.metal.anchored && effect.collect) state.locations[id] = 'inventory';
  return { message: effect.message };
}

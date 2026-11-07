import { capacity } from './allomancy.js';
import { findObject } from './inventory.js';

function setFlag(state, effect) {
  if (state.flags[effect.flag]) return 'You’ve already done that.';
  state.flags[effect.flag] = true;
  return effect.message;
}

export function interact(state, world, verb, target) {
  const separator = verb === 'aim' ? ' at ' : ' on ';
  const boundary = target.indexOf(separator);
  const name = boundary < 0 || verb === 'search' ? target : target.slice(0, boundary);
  const destination = boundary < 0 ? undefined : target.slice(boundary + separator.length);
  const object = findObject(state, world, name, verb === 'use' ? 'inventory' : state.room);
  if (!object) {
    if (!name) return `What would you like to ${verb}?`;
    return verb === 'use' ? 'You need to take that before using it.' : 'You don’t see that here.';
  }
  const [id, item] = object;
  if (verb === 'search') {
    const effect = item.search;
    if (!effect) return 'You search it and find nothing tucked away.';
    if (effect.requires && !state.flags[effect.requires]) return effect.blocked;
    return setFlag(state, effect);
  }
  if (verb === 'aim') {
    const effect = item.aim;
    if (!effect) return 'That can’t be aimed.';
    const color = destination?.replace(/^(the|a|an) /, '').replace(/ lantern$/, '');
    return color === effect.target ? setFlag(state, effect) : effect.hint;
  }
  if (item.unlock) {
    const lock = findObject(state, world, destination?.replace(/^(the|a|an) /, ''), state.room);
    return lock?.[0] === item.unlock.target ? setFlag(state, item.unlock) : 'What would you like to unlock? Try USE KEY ON LOCK at the archive door.';
  }
  if (!item.supply || destination) return 'You can’t use that this way.';
  const supplies = Object.entries(item.supply);
  if (supplies.every(([metal]) => state.reserves[metal] === capacity)) {
    return 'Those reserves are already full. You keep the vial for later.';
  }
  for (const [metal, amount] of supplies) {
    state.reserves[metal] = Math.min(capacity, state.reserves[metal] + amount);
  }
  state.locations[id] = 'consumed';
  return `You drink the ${item.name} and replenish your metal reserves.`;
}

export function signal(state, world, target) {
  const bell = world.rooms[state.room].signal;
  if (!bell) return 'There’s no signal bell here.';
  if (target !== bell.pattern) return bell.hint;
  return setFlag(state, { flag: bell.flag, message: bell.success });
}

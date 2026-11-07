import { capacity, metals } from './allomancy.js';
import { hitDamage, maxHealth } from './combat.js';

const key = 'the-skaas-secret.save';
const version = 2;
const originalObjects = new Set(['slate', 'grate', 'moth', 'pin', 'lever', 'ring']);

export function serialize(state) {
  return JSON.stringify({ version, state });
}

export function deserialize(raw, world) {
  const data = JSON.parse(raw);
  if (data?.version !== version && data?.version !== 1) throw new Error('This save version is unsupported.');
  const state = data.state;
  if (data.version === 1 && state?.locations && state.flags) {
    for (const [id, object] of Object.entries(world.objects)) {
      if (!originalObjects.has(id)) state.locations[id] = object.room;
    }
    state.encounters = {};
    if (state.room === 'refuge' || state.flags.victory === true) {
      Object.assign(state.flags, { gateOpen: true, sparWon: true, archiveOpen: true, mirrorAligned: true });
    }
  }
  const validNumber = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  const roomExists = room => typeof room === 'string' && Object.hasOwn(world.rooms, room);
  const knownFlags = new Set(Object.values(world.characters).map(character => character.flag));
  for (const object of Object.values(world.objects)) {
    for (const effect of [object.search, object.aim, object.unlock]) {
      if (effect) knownFlags.add(effect.flag);
    }
    for (const effect of Object.values(object.allomancy ?? {})) {
      if (effect.flag) knownFlags.add(effect.flag);
    }
  }
  for (const room of Object.values(world.rooms)) {
    if (room.signal) knownFlags.add(room.signal.flag);
    if (room.encounter) knownFlags.add(room.encounter.flag);
  }
  const flags = state?.flags;
  const encounters = state?.encounters;
  if (!roomExists(state?.room) || !validNumber(state.health, maxHealth)
    || !metals.every(metal => validNumber(state.reserves?.[metal], capacity)
      && typeof state.burning?.[metal] === 'boolean'
      && (!state.burning[metal] || state.reserves[metal] > 0))
    || !Object.keys(world.objects).every(id => {
      const location = state.locations?.[id];
      return roomExists(location) || (location === 'inventory' && world.objects[id].portable)
        || (location === 'consumed' && world.objects[id].supply);
    })
    || !flags || typeof flags !== 'object' || Array.isArray(flags)
    || !Object.entries(flags).every(([flag, value]) => knownFlags.has(flag) && typeof value === 'boolean')
    || !encounters || typeof encounters !== 'object' || Array.isArray(encounters)
    || !Object.entries(encounters).every(([room, progress]) => {
      const encounter = roomExists(room) && world.rooms[room].encounter;
      return encounter && !flags[encounter.flag] && validNumber(progress?.health, encounter.health - hitDamage)
        && progress.health > 0 && (encounter.health - progress.health) % hitDamage === 0
        && ['push', 'pull'].includes(progress.lastVerb);
    })) {
    throw new Error('This save contains invalid game data.');
  }
  return state;
}

export function createSaveSlot(storage, world) {
  return {
    save(state) { storage.setItem(key, serialize(state)); },
    load() {
      const raw = storage.getItem(key);
      return raw === null ? null : deserialize(raw, world);
    }
  };
}

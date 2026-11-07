import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createState, describeRoom, execute } from '../src/engine.js';
import { parseCommand } from '../src/parser.js';
import { createSaveSlot, deserialize, serialize } from '../src/save.js';

const world = JSON.parse(readFileSync(new URL('../world/luthadel.json', import.meta.url), 'utf8'));
const unlockLoft = ['north', 'burn iron', 'pull moth', 'south', 'east', 'talk Mara', 'west', 'north', 'west'];
const openShutter = ['pull pin', 'burn steel', 'push lever', 'north'];
const reachLanding = [...unlockLoft, ...openShutter, 'pull ring'];
const enterCheckpoint = ['signal short long short', 'north'];
const winSpar = ['push puck', 'pull weight', 'push puck'];
const unlockArchive = ['search locker', 'take key', 'use key on lock', 'east'];

function play(commands, state = createState(world)) {
  let result = { state, events: [] };
  for (const command of commands) result = execute(result.state, command, world);
  return result;
}

test('parses aliases, articles, direction shorthand, and multiword targets', () => {
  assert.deepEqual(parseCommand('  LOOK   at the brass moth '), { verb: 'examine', target: 'brass moth' });
  assert.deepEqual(parseCommand('speak to Mara'), { verb: 'talk', target: 'mara' });
  assert.deepEqual(parseCommand('GO W'), { verb: 'go', target: 'west' });
  assert.deepEqual(parseCommand('N'), { verb: 'go', target: 'north' });
  assert.deepEqual(parseCommand('  '), { verb: '', target: '' });
});

test('moves through real exits, reports obstacles, and leaves input sessions untouched', () => {
  const initial = createState(world);
  const { state, events } = play(['n'], initial);
  assert.equal(state.room, 'alley');
  assert.equal(initial.room, 'courtyard');
  assert.equal(events[0].type, 'room');
  assert.match(play(['west'], state).events[0].text, /Mara/);
  for (const direction of ['east', 'constructor', 'north east']) {
    assert.match(play([direction === 'east' ? direction : `go ${direction}`], state).events[0].text, /no exit/);
  }
});

test('takes, drops and lists objects once reachable', () => {
  const { state } = play(['north']);
  assert.match(play(['take moth'], state).events[0].text, /grate/);
  assert.match(play(['take grate'], state).events[0].text, /stay/);
  const loose = play(['burn iron', 'pull moth', 'drop moth'], state).state;
  assert.equal(loose.locations.moth, 'alley');
  const carried = play(['grab the brass moth', 'i'], loose);
  assert.equal(carried.state.locations.moth, 'inventory');
  assert.match(carried.events[0].text, /brass moth/);
});

test('charges for ignition and successful abilities while observation and mistakes are free', () => {
  const before = play(['north', 'burn iron', 'burn iron', 'look', 'status', 'pull grate']);
  assert.equal(before.state.reserves.iron, 7);
  assert.equal(before.state.burning.iron, true);
  const after = play(['pull moth', 'extinguish iron'], before.state);
  assert.equal(after.state.reserves.iron, 6);
  assert.equal(after.state.burning.iron, false);
  assert.match(play(['pull grate'], after.state).events[0].text, /Burn iron first/);
});

test('Mara checks for the token and unlocks the loft', () => {
  assert.match(play(['east', 'talk']).events[0].text, /slate/);
  const loft = play(unlockLoft).state;
  assert.equal(loft.room, 'loft');
  assert.equal(loft.flags.trusted, true);
});

test('removing the pin with iron frees the shutter for a steelpush', () => {
  const loft = play(unlockLoft).state;
  const blocked = play(['burn steel', 'push lever'], loft);
  assert.match(blocked.events[0].text, /Pull the pin first/);
  assert.equal(blocked.state.reserves.steel, 7);
  const towpath = play(['pull pin', 'drop pin', 'push lever', 'north'], blocked.state).state;
  assert.equal(towpath.room, 'towpath');
  assert.equal(towpath.flags.shutterOpen, true);
  assert.equal(towpath.reserves.steel, 6);
});

test('the heavy anchored ring moves the player and opens a reusable bridge', () => {
  const towpath = play([...unlockLoft, ...openShutter]).state;
  assert.match(play(['east'], towpath).events[0].text, /no exit/);
  const { state, events } = play(['pull ring'], towpath);
  assert.equal(state.room, 'landing');
  assert.equal(state.locations.ring, 'towpath');
  assert.equal(state.reserves.iron, towpath.reserves.iron - 2);
  assert.equal(events[1].type, 'room');
  const back = play(['west'], state).state;
  assert.match(describeRoom(back, world).text, /lowered footbridge/);
  assert.equal(play(['east'], back).state.room, 'landing');
});

test('players can recover from low reserves, and spending the last measure extinguishes the metal', () => {
  const towpath = play([...unlockLoft, ...openShutter]).state;
  towpath.reserves.iron = 1;
  const blocked = play(['pull ring'], towpath);
  assert.match(blocked.events[0].text, /REFILL/);
  assert.equal(blocked.state.reserves.iron, 1);
  assert.equal(play(['refill', 'pull ring'], blocked.state).state.room, 'landing');
  towpath.reserves.iron = 2;
  const spent = play(['pull ring'], towpath).state;
  assert.equal(spent.reserves.iron, 0);
  assert.equal(spent.burning.iron, false);
  assert.match(play(['burn iron'], spent).events[0].text, /REFILL/);
});

test('saves round-trip state, reject malformed data, and expose storage requests as events', () => {
  const state = play(unlockLoft).state;
  const memory = new Map();
  const slot = createSaveSlot({
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  }, world);
  assert.equal(slot.load(), null);
  slot.save(state);
  assert.deepEqual(slot.load(), state);
  assert.notEqual(slot.load(), state);
  assert.throws(() => deserialize('?', world), SyntaxError);
  assert.throws(() => deserialize('{"version":99}', world), /unsupported/);
  assert.throws(() => deserialize(serialize({ ...state, room: 'nowhere' }), world), /invalid/);
  for (const action of ['save', 'load', 'restart']) {
    assert.deepEqual(play([action], state).events, [{ type: 'session', action }]);
  }
});

test('finding Tavin sets victory once and a fresh session starts independently', () => {
  const refuge = play([...reachLanding, ...enterCheckpoint, ...winSpar, ...unlockArchive, 'aim mirror at blue', 'east']).state;
  assert.equal(refuge.flags.victory, undefined);
  const victory = play(['talk to the courier'], refuge);
  assert.equal(victory.state.flags.victory, true);
  assert.ok(victory.events.some(event => event.type === 'victory'));
  assert.ok(play(['talk Tavin'], victory.state).events.every(event => event.type !== 'victory'));
  assert.deepEqual(deserialize(serialize(victory.state), world), victory.state);
  assert.deepEqual(createState(world).flags, {});
});

test('search reveals hidden vials, which restore reserves once and cap at capacity', () => {
  const laundry = play(['east']).state;
  assert.doesNotMatch(describeRoom(laundry, world).text, /steel vial/);
  assert.match(play(['take steel vial'], laundry).events[0].text, /don’t see/);
  const found = play(['search apron', 'take steel vial', 'use steel vial'], laundry);
  assert.match(found.events[0].text, /already full/);
  assert.equal(found.state.locations.steelVial, 'inventory');
  const used = play(['burn steel', 'drink steel vial'], found.state).state;
  assert.equal(used.reserves.steel, 8);
  assert.equal(used.locations.steelVial, 'consumed');
  assert.deepEqual(deserialize(serialize(used), world), used);
  assert.doesNotMatch(play(['i'], used).events[0].text, /steel vial/);
  const landing = play(reachLanding).state;
  const mixed = play(['search bench', 'take mixed vial', 'use mixed vial'], landing).state;
  assert.equal(mixed.reserves.steel, 8);
  assert.equal(mixed.reserves.iron, landing.reserves.iron + 4);
});

test('bell, locker key, and mirror gate progression and allow corrected attempts', () => {
  const landing = play(reachLanding).state;
  assert.match(play(['examine bell'], landing).events[0].text, /dot, a dash, and a dot/);
  assert.equal(play(['signal long short long', 'north'], landing).state.room, 'landing');
  const checkpoint = play(enterCheckpoint, landing).state;
  assert.match(play(['search locker'], checkpoint).events[0].text, /finish the practice/);
  const won = play(winSpar, checkpoint).state;
  assert.equal(play(['east'], won).state.room, 'checkpoint');
  const key = play(['search locker', 'take key', 'drop key', 'use key on lock'], won).state;
  assert.equal(key.flags.archiveOpen, undefined);
  const archive = play(['take key', 'use key on the lock', 'east'], key).state;
  assert.equal(archive.room, 'archive');
  assert.equal(play(['aim mirror at red', 'east'], archive).state.room, 'archive');
  assert.equal(play(['aim mirror at the blue lantern', 'east'], archive).state.room, 'refuge');
});

test('combat uses attack direction, tracks both sides, and saves a live bout', () => {
  const checkpoint = play([...reachLanding, ...enterCheckpoint]).state;
  const wrongAngle = play(['push weight'], checkpoint);
  assert.match(wrongAngle.events[0].text, /send it away/);
  assert.deepEqual(wrongAngle.state, checkpoint);
  const hit = play(['push puck'], checkpoint).state;
  assert.equal(hit.health, 8);
  assert.deepEqual(hit.encounters.checkpoint, { health: 4, lastVerb: 'push' });
  assert.equal(hit.reserves.steel, checkpoint.reserves.steel - 1);
  const blocked = play(['push puck'], hit);
  assert.match(blocked.events[1].text, /guarding/);
  assert.equal(blocked.state.health, 6);
  assert.equal(blocked.state.encounters.checkpoint.health, 4);
  const restored = deserialize(serialize(blocked.state), world);
  const won = play(['pull weight', 'push puck'], restored).state;
  assert.equal(won.health, 4);
  assert.equal(won.flags.sparWon, true);
  assert.deepEqual(won.encounters, {});
});

test('the landing offers rest and a loss resets the bout for a retry', () => {
  const checkpoint = play([...reachLanding, ...enterCheckpoint]).state;
  const rested = play(['push puck', 'south', 'rest', 'north'], checkpoint).state;
  assert.equal(rested.health, 10);
  assert.equal(rested.encounters.checkpoint.health, 4);
  const loss = play(['refill', ...Array(5).fill('push puck')], checkpoint).state;
  assert.equal(loss.room, 'landing');
  assert.equal(loss.health, 10);
  assert.deepEqual(loss.encounters, {});
  assert.equal(play(['refill', 'north', ...winSpar], loss).state.flags.sparWon, true);
});

test('version one saves preserve old progress and gain new object locations', () => {
  const { encounters, ...legacy } = play(reachLanding).state;
  const originalIds = ['slate', 'grate', 'moth', 'pin', 'lever', 'ring'];
  legacy.locations = Object.fromEntries(originalIds.map(id => [id, legacy.locations[id]]));
  const loadLegacy = state => deserialize(JSON.stringify({ version: 1, state }), world);
  const landing = loadLegacy(legacy);
  assert.equal(landing.locations.moth, 'inventory');
  assert.equal(landing.locations.mixedVial, 'landing');
  assert.equal(landing.flags.gateOpen, undefined);
  const refuge = loadLegacy({ ...legacy, room: 'refuge' });
  assert.equal(play(['west', 'east', 'talk Tavin'], refuge).state.flags.victory, true);
});

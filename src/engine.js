import { parseCommand } from './parser.js';
import { findObject, inventoryCommand, isRevealed, matches } from './inventory.js';
import { capacity, manipulate, refill, reservesText, toggleBurn } from './allomancy.js';
import { activeEncounter, maxHealth } from './combat.js';
import { interact, signal } from './interactions.js';

export { maxHealth };
export const helpText = [
  'LOOK (L), EXAMINE <thing> (X), GO <direction> or N / S / E / W',
  'TAKE <thing>, DROP <thing>, INVENTORY (I), TALK <person>, STATUS',
  'BURN / EXTINGUISH <steel or iron>, PUSH / PULL <thing>, RESERVES, REFILL',
  'SEARCH <thing>, USE <item> [ON <thing>], SIGNAL <rhythm>, AIM <thing> AT <target>, REST',
  'HELP, SAVE, LOAD, RESTART',
  'Try examining objects or talking to people if you get stuck. Metal is spent when you start burning or successfully push or pull. You can refill from your pouch anywhere.'
].join('\n');

export function createState(world) {
  return {
    room: world.start,
    health: maxHealth,
    reserves: { steel: capacity, iron: capacity },
    burning: { steel: false, iron: false },
    locations: Object.fromEntries(Object.entries(world.objects).map(([id, object]) => [id, object.room])),
    flags: {},
    encounters: {}
  };
}

export function exitsFrom(state, world) {
  return Object.fromEntries(Object.entries(world.rooms[state.room].exits)
    .filter(([, exit]) => !exit.revealedBy || state.flags[exit.revealedBy]));
}

export function describeRoom(state, world) {
  const room = world.rooms[state.room];
  const alternate = room.descriptionAfter;
  const description = alternate && state.flags[alternate.flag] ? alternate.text : room.description;
  const objects = Object.entries(world.objects)
    .filter(([id, object]) => state.locations[id] === state.room && isRevealed(state, object))
    .map(([, object]) => object.name);
  const people = Object.values(world.characters)
    .filter(character => character.room === state.room)
    .map(character => character.name);
  const exits = Object.entries(exitsFrom(state, world))
    .map(([direction, exit]) => exit.requires && !state.flags[exit.requires]
      ? `${direction} (blocked)` : direction);
  return {
    type: 'room', title: room.name,
    text: [description, objects.length && `You notice: ${objects.join(', ')}.`,
      people.length && `Here: ${people.join(', ')}.`, `Exits: ${exits.join(', ')}.`]
      .filter(Boolean).join('\n')
  };
}

function nearbyCharacter(state, world, target) {
  const nearby = Object.values(world.characters).filter(character => character.room === state.room);
  return target ? nearby.find(character => matches(character, target))
    : nearby.length === 1 ? nearby[0] : undefined;
}

export function execute(state, input, world) {
  const { verb, target } = parseCommand(input);
  const next = structuredClone(state);
  const events = [];
  const tell = (text, type = 'narrative') => events.push({ type, text });
  switch (verb) {
    case 'look':
      events.push(describeRoom(next, world));
      break;
    case 'go': {
      const exits = exitsFrom(next, world);
      const exit = Object.hasOwn(exits, target) ? exits[target] : undefined;
      if (!exit) tell(target ? 'There’s no exit that way. Try LOOK for nearby exits.' : 'Which direction? Try north, south, east, or west.');
      else if (exit.requires && !next.flags[exit.requires]) tell(exit.blocked);
      else {
        next.room = typeof exit === 'string' ? exit : exit.to;
        events.push(describeRoom(next, world));
      }
      break;
    }
    case 'examine': {
      const object = findObject(next, world, target)?.[1];
      const person = target && nearbyCharacter(next, world, target);
      tell(object?.description ?? person?.description ??
        (target ? 'You don’t see anything by that name here.' : 'What would you like to examine?'));
      break;
    }
    case 'talk': {
      const person = nearbyCharacter(next, world, target);
      if (!person) tell(target ? 'There’s nobody by that name here.' : 'Who would you like to talk to?');
      else if (next.flags[person.flag]) tell(person.repeat);
      else if (!person.success || (person.requiresItem && next.locations[person.requiresItem] !== 'inventory')) tell(person.waiting);
      else {
        next.flags[person.flag] = true;
        tell(person.success);
        if (person.flag === 'victory') tell('Adventure complete. You found Tavin and restored the lantern signal.', 'victory');
      }
      break;
    }
    case 'take':
    case 'drop':
    case 'inventory':
      tell(inventoryCommand(next, world, verb, target));
      break;
    case 'burn':
    case 'extinguish':
      tell(toggleBurn(next, verb, target));
      break;
    case 'push':
    case 'pull': {
      const { message, combat, moved } = manipulate(next, world, verb, target);
      tell(message);
      if (combat) tell(combat, 'combat');
      if (moved) events.push(describeRoom(next, world));
      break;
    }
    case 'search':
    case 'use':
    case 'aim':
      tell(interact(next, world, verb, target));
      break;
    case 'signal':
      tell(signal(next, world, target));
      break;
    case 'rest':
      if (world.rooms[next.room].rest) {
        next.health = maxHealth;
        tell('You sit on the bench and catch your breath. Your health is full.');
      } else tell('The bench at the canal landing is a good place to rest.');
      break;
    case 'refill':
      tell(refill(next));
      break;
    case 'reserves':
      tell(reservesText(next));
      break;
    case 'status': {
      tell(`Health: ${next.health}/${maxHealth} · ${reservesText(next)}\n${next.flags.victory ? 'You found Tavin.' : 'Find Tavin, the missing courier.'}`);
      const encounter = activeEncounter(next, world);
      if (encounter) {
        const opponent = world.characters[encounter.opponent].name;
        tell(`${opponent}’s practice health: ${next.encounters[next.room]?.health ?? encounter.health}/${encounter.health}.`);
      }
      break;
    }
    case 'help':
      tell(helpText);
      break;
    case 'save':
    case 'load':
    case 'restart':
      events.push({ type: 'session', action: verb });
      break;
    case '':
      break;
    default:
      tell('I don’t understand that command. Type HELP for things to try.');
  }
  return { state: next, events };
}

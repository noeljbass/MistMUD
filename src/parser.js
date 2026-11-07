const directions = { n: 'north', s: 'south', e: 'east', w: 'west' };
const aliases = {
  l: 'look', x: 'examine', inspect: 'examine', walk: 'go', move: 'go',
  get: 'take', grab: 'take', i: 'inventory', inv: 'inventory', speak: 'talk',
  h: 'help', '?': 'help', metals: 'reserves', stop: 'extinguish', drink: 'use'
};

export function parseCommand(input) {
  const [word = '', ...rest] = input.trim().toLowerCase().split(/\s+/);
  const verb = Object.hasOwn(aliases, word) ? aliases[word] : word;
  let target = rest.join(' ');
  if (Object.hasOwn(directions, verb) || Object.values(directions).includes(verb)) {
    return { verb: 'go', target: rest.length ? [verb, ...rest].join(' ') : directions[verb] ?? verb };
  }
  if (verb === 'go' && Object.hasOwn(directions, target)) target = directions[target];
  if (verb === 'talk') target = target.replace(/^to /, '');
  if (verb === 'look' && target.startsWith('at ')) {
    return { verb: 'examine', target: target.slice(3).replace(/^(the|a|an) /, '') };
  }
  return { verb, target: target.replace(/^(the|a|an) /, '') };
}

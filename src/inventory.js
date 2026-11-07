export function matches(entity, target) {
  return [entity.name.toLowerCase(), ...(entity.aliases ?? [])].includes(target);
}

export function isRevealed(state, object) {
  return !object.hiddenBy || state.flags[object.hiddenBy];
}

export function findObject(state, world, target, location = null) {
  return Object.entries(world.objects).find(([id, object]) => {
    const where = state.locations[id];
    return (location ? where === location : where === 'inventory' || where === state.room)
      && isRevealed(state, object) && matches(object, target);
  });
}

export function inventoryCommand(state, world, verb, target) {
  if (verb === 'inventory') {
    const names = Object.entries(world.objects)
      .filter(([id]) => state.locations[id] === 'inventory')
      .map(([, object]) => object.name);
    return names.length ? `You carry: ${names.join(', ')}.` : 'Your pockets are empty.';
  }
  if (!target) return `What would you like to ${verb}?`;
  const entry = findObject(state, world, target);
  if (!entry) return 'You don’t see anything by that name here.';
  const [id, object] = entry;
  const carried = state.locations[id] === 'inventory';
  if (verb === 'drop' && !carried) return 'You aren’t carrying that.';
  if (verb === 'take') {
    if (carried) return 'You already have that.';
    if (!object.portable) return 'That needs to stay where it is.';
    if (object.takeRequires && !state.flags[object.takeRequires]) return object.takeBlocked;
  }
  state.locations[id] = verb === 'take' ? 'inventory' : state.room;
  return `You ${verb} the ${object.name}.`;
}

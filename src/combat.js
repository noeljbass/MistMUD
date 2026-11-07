export const maxHealth = 10;
export const hitDamage = 2;

export function activeEncounter(state, world) {
  const encounter = world.rooms[state.room].encounter;
  return encounter && !state.flags[encounter.flag] ? encounter : null;
}

export function resolveAttack(state, world, verb) {
  const encounter = activeEncounter(state, world);
  const opponent = world.characters[encounter.opponent].name;
  const room = state.room;
  const previous = state.encounters[room];
  const blocked = previous?.lastVerb === verb;
  const health = (previous?.health ?? encounter.health) - (blocked ? 0 : hitDamage);
  if (health <= 0) {
    delete state.encounters[room];
    state.flags[encounter.flag] = true;
    return { text: `${opponent} takes ${hitDamage} damage and lowers her shield. “You win!” She nods toward the locker.` };
  }
  state.health = Math.max(0, state.health - encounter.counter);
  if (state.health === 0) {
    delete state.encounters[room];
    state.room = encounter.retreat;
    state.health = maxHealth;
    return { text: `${opponent} calls a break and walks you back to the bench. You catch your breath and recover. You can try the bout again.`, blocked, moved: true };
  }
  state.encounters[room] = { health, lastVerb: verb };
  const outcome = blocked
    ? `${opponent} was guarding against that move. Try the other metal and target.`
    : `${opponent} takes ${hitDamage} practice damage (${health}/${encounter.health}). She turns to guard against your last move.`;
  return {
    text: `${outcome} Her padded baton taps your shoulder for ${encounter.counter} damage.`, blocked
  };
}

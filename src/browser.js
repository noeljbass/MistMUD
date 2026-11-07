import { createState, describeRoom, execute, exitsFrom, maxHealth } from './engine.js';
import { capacity, metals } from './allomancy.js';
import { createSaveSlot } from './save.js';

const get = id => document.getElementById(id);
const log = get('log');
const input = get('command');
const directionButtons = [...get('directions').querySelectorAll('button')];
const actionButtons = [...get('actions').querySelectorAll('button')];

function render({ type, text, title }) {
  const entry = document.createElement('div');
  entry.className = `event event-${type}`;
  if (title) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    entry.append(heading);
  }
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  entry.append(paragraph);
  log.append(entry);
}

function startGame(world) {
  let state = createState(world);
  const slot = createSaveSlot({
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value)
  }, world);
  const history = [];
  let historyIndex = 0;
  let draft = '';

  function updateDashboard() {
    get('room').textContent = world.rooms[state.room].name;
    get('health').textContent = `${state.health}/${maxHealth}`;
    for (const metal of metals) {
      const meter = get(metal);
      meter.textContent = `${state.reserves[metal]}/${capacity}${state.burning[metal] ? ' · lit' : ''}`;
      meter.classList.toggle('burning', state.burning[metal]);
    }
    const exits = exitsFrom(state, world);
    for (const button of directionButtons) {
      button.disabled = !Object.hasOwn(exits, button.dataset.command);
    }
  }

  function opening() {
    log.replaceChildren();
    render({ type: 'intro', text: world.intro });
    render(describeRoom(state, world));
    render({ type: 'hint', text: 'Type HELP for commands, or head east to talk to Mara.' });
  }

  function sessionAction(action) {
    if (action === 'restart') {
      if (!window.confirm('Start a new adventure? Your saved game will still be available.')) return;
      state = createState(world);
      opening();
      return;
    }
    try {
      if (action === 'save') {
        slot.save(state);
        render({ type: 'hint', text: 'Adventure saved in this browser.' });
      } else {
        const saved = slot.load();
        if (!saved) {
          render({ type: 'hint', text: 'There’s no saved adventure yet. Use SAVE to make one.' });
          return;
        }
        state = saved;
        render({ type: 'hint', text: 'Saved adventure restored.' });
        render(describeRoom(state, world));
      }
    } catch {
      render({ type: 'hint', text: action === 'save'
        ? 'This browser couldn’t store your adventure.'
        : 'This browser couldn’t restore your saved adventure.' });
    }
  }

  function submit(command) {
    const line = command.trim();
    if (!line) return;
    history.push(line);
    historyIndex = history.length;
    draft = '';
    render({ type: 'command', text: `› ${line}` });
    const result = execute(state, line, world);
    state = result.state;
    for (const event of result.events) {
      if (event.type === 'session') sessionAction(event.action);
      else render(event);
    }
    updateDashboard();
    log.scrollTop = log.scrollHeight;
  }

  get('command-form').addEventListener('submit', event => {
    event.preventDefault();
    submit(input.value);
    input.value = '';
    input.focus({ preventScroll: true });
  });
  input.addEventListener('keydown', event => {
    if (event.isComposing || !['ArrowUp', 'ArrowDown'].includes(event.key) || !history.length) return;
    event.preventDefault();
    if (historyIndex === history.length) draft = input.value;
    historyIndex = event.key === 'ArrowUp'
      ? Math.max(0, historyIndex - 1)
      : Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] ?? draft;
    input.setSelectionRange(input.value.length, input.value.length);
  });
  for (const button of [...directionButtons, ...actionButtons]) {
    button.addEventListener('click', () => submit(button.dataset.command));
  }
  for (const control of [input, get('submit'), ...actionButtons]) control.disabled = false;
  opening();
  updateDashboard();
}

try {
  const response = await fetch(new URL('../world/luthadel.json', import.meta.url));
  if (!response.ok) throw new Error('World unavailable');
  startGame(await response.json());
} catch {
  render({ type: 'hint', text: 'Luthadel couldn’t load. Start the local static server with npm start and open the address it prints.' });
}

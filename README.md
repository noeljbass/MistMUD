# The Skaa’s Secret

A short, single-player text adventure inspired by Zork and set in Mistborn’s Luthadel. You play a young skaa learning to use Allomancy while following the trail of a missing resistance courier.

## Play locally

1. Install Node.js 20 or later.
2. In the project directory, run `npm start`. The project has no packages to install.
3. Open [http://127.0.0.1:8080](http://127.0.0.1:8080) in a modern browser. Keep the terminal running while you play.

The included server only serves static files. You can also serve `index.html`, `style.css`, `src/`, and `world/` from any static host. Serve them over HTTP so the browser can fetch the world JSON.

## How to play

Start with `east`, then `talk Mara`. Use `look` to read the room and `examine` to investigate things you see. Type a command and press Enter, or use the direction buttons. Up and Down recall earlier commands while the input is focused.

| Commands | What they do |
| --- | --- |
| `look` (`l`), `examine slate` (`x slate`) | Read your surroundings or inspect something. |
| `go east`, `east`, `e` | Move. North, south, and west also have one-letter shortcuts. |
| `take moth`, `drop moth`, `inventory` (`i`) | Manage items. |
| `talk Mara`, `talk to Mara` | Speak to someone nearby. |
| `burn iron`, `pull moth`, `extinguish iron` | Draw metal toward you. An anchored target can draw you toward it instead. |
| `burn steel`, `push lever`, `extinguish steel` | Push metal away. |
| `search <thing>`, `take <vial>`, `use <vial>` | Find hidden supplies and drink a vial to top up your reserves. |
| `signal <rhythm>`, `use <item> on <thing>`, `aim <thing> at <target>` | Follow the clues along the canal. |
| `rest` | Recover health on the bench at the canal landing. |
| `reserves`, `refill`, `status`, `help` | Check supplies, replenish them from your pouch, or get help. |
| `save`, `load`, `restart` | Save to a single browser-local slot, restore it, or start fresh. Restart keeps your save. |

Lighting a metal uses one measure. Moving metal spends one or two more depending on the target’s mass. Reading and trying the wrong angle costs nothing. During sparring, Nera guards against your last move, so a repeated attack spends metal even when she blocks it. Talk to Nera for hints and use `status` to check her practice health. If you lose, you recover at the landing and can try again.

Look for details that suggest a hiding place, then try `search`. Vials are single-use and stay in your inventory if the relevant reserves are already full. You can also refill anywhere from the emergency pouch.

## Run tests

```sh
npm test
```

The Node test suite covers parsing, movement, inventory, reserves, anchored and movable targets, hidden supplies, puzzle progression, sparring and recovery, save migration, and the complete route to victory.

This is an unofficial Mistborn fan prototype.

# Architecture conventions

- Use vanilla JavaScript ES modules. Keep runtime dependencies at zero and use Node’s built-in test runner.
- Keep `src/engine.js` deterministic and free of browser APIs. Its entry points are `createState(world)` and `execute(state, input, world)`. Return a new session state and ordered narrative events without mutating the caller’s state or the shared world.
- Keep room, object, and character definitions in `world/luthadel.json`. Treat their keys as stable IDs. Use flags and conditional exits for puzzle progress. Keep mutable item locations, reserves, and flags in each session state.
- Keep syntax and aliases in `src/parser.js`, object lookup and inventory in `src/inventory.js`, and metal rules in `src/allomancy.js`. Make action costs explicit and check prerequisites before spending reserves.
- Keep searchable caches and other puzzle interactions in `src/interactions.js`, and encounter rules in `src/combat.js`. Store encounter progress in the player session and describe attack angles in the world data.
- Keep DOM work and session event handling in `src/browser.js`. Render narrative and player input as text. Keep `src/save.js` storage-agnostic by injecting the slot’s storage adapter.
- Preserve existing save compatibility when changing state or world IDs. Version the save format and handle older saves explicitly when making incompatible changes.
- Make puzzle actions recoverable and leave clues in descriptions and dialogue. Test the playable route with real commands, including prerequisite failures and session isolation.
- Use `npm start` for static local serving and `npm test` before handing off changes.

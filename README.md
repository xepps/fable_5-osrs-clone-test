# OSRS Clone

A small browser-based Old School RuneScape clone: a low-poly 3D world rendered with Three.js,
an authoritative Node game server simulating the world on the classic 600ms game tick, and
OSRS-style mouse-driven interaction (left-click for the primary action, right-click for the
full option menu). Every browser tab is its own character in the same shared world.

![two players in the world](docs/screenshot.png)

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer (which includes npm).

```sh
git clone https://github.com/xepps/fable_5-osrs-clone-test.git
cd fable_5-osrs-clone-test
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser, pick a display name, and you're in.
Open the same address in a second tab (or another browser) with a different name to see
multiplayer working — you'll watch each other walk around and can chat.

`npm run dev` starts both halves of the game: the WebSocket game server on port 8080 and
the Vite dev server for the client on port 5173. Characters live only as long as their
tab — there are no accounts and nothing is saved.

### Playing with friends on your network

```sh
npm run dev:lan
```

This exposes the client on your machine's LAN address (Vite prints it on startup, e.g.
`http://192.168.1.20:5173`). Anyone on your network can open that URL and join the same
world.

## Controls

| Input              | Action                                           |
| ------------------ | ------------------------------------------------ |
| Left click         | Walk / primary action of what's under the cursor |
| Right click        | Open the option menu                             |
| Middle-mouse drag  | Rotate the camera                                |
| Arrow keys         | Rotate / tilt the camera                         |
| Scroll wheel       | Zoom                                             |
| Enter (in chatbox) | Send chat                                        |

## Your first five minutes

You spawn at the crossroads in the middle of the map, where a few items respawn on the
ground:

1. **Grab the gear** — left-click the bronze sword, med helm, axe, and coins near the
   crossroads to pick them up (or right-click → `Take`). Watch them stack up in the
   inventory panel on the right.
2. **Wield it** — left-click the sword in your inventory to wield it, and the helm to wear
   it. Check the **Equipment** tab; both show up on your character model too.
3. **Say hello** — the Lumbridge Guide stands just north-east of the crossroads.
   Right-click him → `Talk-to` for a quick tour of what's possible.
4. **Pick a fight** — goblins wander the camp in the south-west corner. Right-click →
   `Attack Goblin`. You'll trade blows every few ticks (hitsplats and HP bars included),
   and a dead goblin drops bones and coins — pick them up before they despawn. Combat
   trains Attack, Strength, and Hitpoints; check the **Skills** tab.
5. **Chop a tree** — with the axe in your inventory (or wielded), right-click any tree →
   `Chop down`. You'll get logs and Woodcutting XP, and the tree falls to a stump before
   regrowing. Level-ups are announced in the chatbox, just like the real thing.
6. **Talk** — type in the chatbox (bottom-left) and press Enter. Your message appears in
   everyone's chat log and floats above your head for a few seconds.

Right-click anything — items, NPCs, trees, other players, even bare ground — to see every
available option (`Examine` is always there if you're curious). Left-click always performs
the top option in that list.

If a goblin gets the better of you: "Oh dear, you are dead!" — you respawn at the
crossroads with full hitpoints and keep all your items.

## What's simulated

- **One 64×64-tile chunk** — grass plains, dirt paths, a pond, trees, and a goblin camp
- **The 600ms game tick** — all actions are queued as intents and resolved on tick
  boundaries by the server, like the real game
- **Click-to-move** — BFS pathfinding on the tile grid (OSRS wiki neighbour order, no
  corner cutting), walking 1 tile per tick
- **Items & inventory** — 28 slots, stackables (coins) share a slot, ground item stacks,
  item spawns that respawn, Take/Drop/Use/Examine
- **Equipment** — helmet and weapon slots (Wield/Wear), visible on the 3D model
- **Combat** — simplified OSRS melee accuracy/max-hit formulas, 4-tick attacks, NPC
  retaliation, drops, and respawns
- **Skills & XP** — Attack, Strength, Defence, Hitpoints, Woodcutting using the real OSRS
  XP table

## Troubleshooting

- **"Choose a display name" never goes away after clicking Play** — the game server isn't
  reachable. Make sure `npm run dev` is still running and nothing else is using port 8080.
- **Port already in use** — stop whatever holds 5173/8080, or set `PORT` for the game
  server (the client expects 8080, so change both if you stray).
- **Blank page or WebGL errors** — the client needs a browser with WebGL enabled; any
  recent Chrome/Firefox/Edge/Safari works.

## Architecture

npm workspaces monorepo, TypeScript strict everywhere:

- `packages/shared` — Zod protocol schemas, item/NPC/world definitions, XP table and
  combat formulas (pure functions, fully tested)
- `packages/server` — authoritative simulation: a pure `runTick(world, intents, rng)`
  function driven by a 600ms interval, plus a thin `ws` WebSocket shell. Clients only send
  intents; the server broadcasts a personalised snapshot every tick
- `packages/client` — Vite + React for the 2D UI (inventory, equipment, skills, chat,
  context menu, dialogue) and a thin untested Three.js adapter that maps client state to
  meshes. All game logic in the client lives in a tested pure reducer and menu builder

## Tests

```sh
npm test          # shared + server (node) and client UI (Vitest browser mode, chromium)
npm run typecheck
```

The client UI tests run in real chromium via Playwright; if the browser isn't already
installed, run `npx playwright install chromium` once first.

End-to-end verification scripts (need `npm run dev` running in another terminal):

```sh
node scripts/verify.mjs            # two tabs: login, walk, context menu, chat overhead
node scripts/verify-features.mjs   # take/equip items, dialogue, woodcutting, combat
```

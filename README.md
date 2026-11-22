# Ember Sigils — a duel of rune cards

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/Cervus121212/velvet-fox-83/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/Cervus121212/velvet-fox-83/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

A complete, original card duel that runs offline in a desktop browser. You are the Ember Duelist; across the table sits **The Hollow Sigilist**. Both hold **24 HP**. Play rune cards, break the rival's ward, and shatter it before your own sigils gutter out.

## The wheel

Four elements, told apart by colour **and** shape: **▲ Ember** (red), **◆ Frost** (blue), **● Leaf** (green), **★ Storm** (gold).

- Ember beats Leaf · Leaf beats Storm · Storm beats Frost · Frost beats Ember
- Attacking a ward your element beats deals **+3 Edge damage**.
- Your ward is the element of the last card you played — and the rival's the same. Read the intent line: the rival shows exactly which cards it plans to play next turn.

## The cards (10 kinds, 2 copies each — a 20-card deck)

| Card | Element | Cost | Effect |
| --- | --- | --- | --- |
| Ember Strike | ▲ Ember | 1 | 6 damage |
| Frost Shard | ◆ Frost | 1 | 5 damage + 2 block |
| Leaf Mend | ● Leaf | 1 | Heal 4 |
| Storm Jolt | ★ Storm | 2 | 9 damage |
| Stone Ward | ◆ Frost | 1 | +7 block |
| Wildfire | ▲ Ember | 2 | 8 damage |
| Gale Draw | ★ Storm | 1 | Draw 2 |
| Thorn Trap | ● Leaf | 2 | 4 damage + 4 block |
| Mana Bloom | ● Leaf | 0 | +2 mana |
| Rune Surge | ★ Storm | 3 | 12 damage |

Mana grows **3 → 4 → 5** (rounds 1–3, 4–6, 7+). Draw 2 a round, 7 cards at most in hand; the discard pile reshuffles when the deck runs dry. Block fades at the start of its owner's next turn. Score = damage dealt + HP left × 2 + speed bonus (up to 5/round under round 10).

## Controls

- **Click** a card to play it · **End Turn** (or Enter / Space) passes to the rival
- **1–7** play a hand slot · **R** restart · **M** mute (WebAudio synth, no audio files)

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files.

## Tests

```sh
node test-logic.mjs   # 200 seeded duels: win rate, invariants, score
node check-play.mjs   # real mouse clicks in headless Chrome: a win and a loss
node shot-card.mjs    # the 4 screenshots in screenshots/
```

## Test results (verified 23 Nov 2026)

- Logic (`test-logic.mjs`, 200 seeded duels): **102 wins / 98 losses (51%)**, avg 2.85 rounds, avg score 65.5, **0 invariant failures**.
- Interactive play-test (`check-play.mjs`, seed 7, real clicks, 0 console errors): **bold wins** in round 2 (score 75, 29 damage dealt, 3 HP left); **meek loses** in round 2 (score 40, 0 damage dealt).
- Screenshots (`shot-card.mjs`, 1280×720, 0 console errors): 1-play.jpg 85,086 B (round 3, score 80), 2-title.jpg 58,186 B, 3-win.jpg 45,168 B (Victory, score 86, round 4), 4-loss.jpg 44,227 B (Defeat, score 35, round 3).
- Hand-in (`main.ts`): two runs byte-identical, 626,381 bytes, 17 files (dossier.json + game/ + 4 screenshots).

## Layout

- `game/src/cards.js` — card catalogue + element wheel
- `game/src/deck.js` — seeded shuffle + draw/discard piles
- `game/src/ai.js` — rival scoring, 3-card plans, intent
- `game/src/game.js` — the duel engine (pure state machine)
- `game/src/render.js` — DOM table, hand, HP/mana/ward/intent
- `game/src/input.js` — mouse + keyboard controls
- `game/src/audio.js` — WebAudio synth sounds
- `game/src/shots.js` — deterministic `?shot=` fixtures
- `main.ts` — hand-in program (copies `game/` + `screenshots/`, writes `dossier.json`)

Built for the [best card game bounty](https://make.fun/bounty/best-card-game-20261122-1826) on make.fun. Play more agent-built games at https://make.fun/?ref=hb8k835f

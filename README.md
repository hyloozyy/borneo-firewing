# BORNEO FIREWING · FW-218 Enggang

[![make.fun competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/hyloozyy/borneo-firewing/rank.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/hyloozyy/borneo-firewing/reward.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)

An original firefighting flight game made for the make.fun bounty
[Make the best flight game](https://make.fun/competitions/best-flight-game-20261126-0057).

You fly the **FW-218 "Enggang"**, a twin-turboprop amphibious water bomber, against a forest fire
(*karhutla*) in the Kalimantan rainforest. Take off from a jungle airstrip, skim a lake to fill the tank,
drop water through target rings over the fire front, save a stilt village when the wind turns, and land
back on runway 36 before the fuel runs out.

![cover](screenshots/1-cover-water-drop.jpg)

## The mission: five stages

1. **Take-off & Patrol**: start the engines, set flaps, take off and fly three patrol rings along the river.
2. **First Scoop**: touch down on the lake at 60–115 kt and skim until the tank is 80% full (the plane gets heavier).
3. **Fire Attack**: fly through the drop ring over the hottest part of the fire and hold SPACE. The fire spreads with the wind. Scoop again and repeat until the main fire is down.
4. **Save the Village**: the wind shifts and a new front races toward the rumah panggung village. Put the fire out near the village before the timer ends.
5. **Return & Land**: low fuel. Fly the green approach gate, follow the PAPI lights and land smoothly, then stop.

You fail if you crash, run out of fuel, let the village burn or run out of mission time. Each stage gets a score and stars.

## Controls

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | pitch down / up |
| A / D or ← / → | roll |
| Q / E | rudder |
| R / F (or Shift) | throttle up / down |
| V | flaps (UP, 1, FULL) |
| SPACE (hold) | open the belly doors and drop water |
| B | wheel brakes |
| C | chase / cockpit camera |
| Mouse drag / wheel | look around / zoom |
| P or Esc | pause |
| M / H | sound / HUD |

On phones and tablets, touch controls appear (stick, throttle slider, drop, flaps, brake, camera, tilt steering), and a lighter graphics level is chosen automatically.

## How it is built

Plain static files in `game/` with no build step and no network requests. Three.js is vendored as
`game/vendor/three.module.min.js`. Everything else was written for this game: the aircraft is modelled in code
(`game/src/aircraft`), its livery is painted on canvases, and every sound is synthesised with Web Audio.

The rainforest covers the whole island, hills included: every tree grows from a branching skeleton
(trunk, buttress roots, scaffold limbs that fork two or three times, a leaf clump on every twig) in ten
variants (emergent dipterocarps, canopy and sub-canopy trees, light-green pioneers, palms, shrubs and ferns).
Trees near the camera are full models, further out a lighter model of the same tree, and beyond that an
impostor card baked at start-up from that tree in eight directions (colour and normals) and lit in the shader.

```
game/src/aircraft   FW-218 model and livery
game/src/flight     flight physics (lift, stall, drag, water load, ground and water contact)
game/src/world      terrain, water, sky, forest, village, airstrip, clouds and hornbills
game/src/fire       fire spread, flames, smoke, water drop and scoop spray
game/src/mission    the five stages, rings and the mission director
game/src/hud        head-up display
game/src/cockpit    cockpit interior and lit instrument panel
game/src/camera     chase and cockpit cameras
game/src/audio      synthesised sound
game/src/input      keyboard, mouse and touch controls
game/src/ui         title, briefing, pause and result screens, bundled fonts
game/src/shots      staged scenes for the screenshots (?shot=cover|cockpit|scoop|landing)
```

Run it locally with `node serve.ts` (Node 22) and open http://localhost:8080.

## License

MIT, see [LICENSE](LICENSE). The bundled fonts in `game/fonts/` (Saira Condensed, Saira Stencil One,
B612, B612 Mono, Barlow, from the google/fonts repository) are under the SIL Open Font License 1.1;
their licence texts are next to them (`OFL-*.txt`).

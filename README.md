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

## Damage and decisions

* **Engine temperature (ITT)** rises with throttle and with the hot air in the smoke. Above the 800 °C redline an
  engine wears out, can catch fire and flame out: ease the power on a drop run, or lose an engine.
* **Engine fire**: press X to fire that engine's bottle. The fire goes out and the engine stays shut down: fly home
  on one. The live engine yaws the nose toward the dead one, and the aircraft climbs and accelerates worse.
* **Bird strikes** from the hornbills over the canopy crack the windscreen, damage an engine or hole a wing (fuel leak).
* **Structure**: pulling more than 3.2 g or less than -1 g, and firm landings, cost airframe strength (more drag,
  less control authority). A damaged gear lowers the sink rate it survives.
* **Reports**: a crash ends with a crash report (impact speed, sink rate, bank and pitch, surface, g-load, damage
  and the timeline of what went wrong); a finished mission with a landing debrief (touchdown fpm, g, centreline).

## Cockpit and HUD

The cockpit view (C) has a full lit panel: six-pack flight instruments, twin-needle torque, ITT, prop and fuel-flow
gauges for both engines, fuel and water quantity, clock, G-meter, a moving-map display, 16 annunciators, radios,
master warning and caution lights and a mode panel on the glareshield. The needles jitter with engine vibration,
warnings flash, the yokes and overhead power levers follow your inputs, and soot, spray droplets and a bird-strike
crack build up on the windscreen. The HUD has speed and altitude tapes with trend arrows, stall and scoop speed bands,
a heading tape with the objective bug and wind, a radar mini-map with fires, village, rings and objective, engine and
systems panels, a glass instrument cluster in the chase view (airspeed, attitude, altimeter, heading card,
vertical speed, twin-needle engine RPM and a row of STALL / LOW FUEL / ITT / SMOKE / GEAR / FLAPS / DOORS / WATER lights), G-meter, master caution alerts, radio messages with a typing effect, and hit/miss feedback for drops.

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
| X | fire bottle: put out a burning engine (it stays shut down) |
| C | chase / cockpit camera |
| Mouse drag / wheel | look around / zoom |
| P or Esc | pause |
| M / H / I | sound / HUD / chase-view instrument cluster |

Graphics: the title and pause screens have a GRAPHICS setting (Performance, Balanced, Sharp, Ultra) and a render-scale
slider. Speed is won back from scene detail, not resolution: phones render at up to 2x their screen with FXAA and a
light sharpen, computers at up to 2x with 4x MSAA.

Weather: the same screens have a WEATHER setting, applied live and remembered. **Clear** (the default) is a
tropical late afternoon with scattered cumulus and a thin smoke haze from the fires; **Smoke Haze** is the
karhutla haze, a brown-orange sky with a dim red sun and thick haze layers; **Storm** brings a dark low cloud
deck, rain streaks, a wet glossy canopy and ground, lightning inside the clouds with thunder, and rain on the
windscreen.

### On a phone

Open the game in the phone browser and hold it sideways (a full-screen landscape button is offered in portrait).
A short how-to-play card shows before the first flight. The touch controls appear only while flying:

* **Left thumb**: touch anywhere on the left side and a stick appears under the thumb (pull back to climb, sideways to bank).
* **Right edge**: the throttle slider. Under the right thumb: a big **DROP** button (hold; it shows how full the tank is),
  **FLAPS**, **BRAKE** and the **FIRE BOTTLE** (flashes when an engine burns).
* **Swipe the free screen to look around** the aircraft like in a mobile action game (it glides and recentres by
  itself), **pinch to zoom**, double tap to recentre. In the cockpit the swipe turns your head and the pinch zooms.
* Top right: **CAM** (chase / cockpit), **TILT** (steer by tilting the phone), **HUD** and pause.

Every finger is tracked on its own, so you can hold the stick, slide the throttle and look around at the same time.
Phones get a lighter graphics level automatically (fewer trees and particles, no shadows or water reflections,
lower resolution), a loading bar while the forest grows, and a light-mode reload if the browser drops the graphics context.

## How it is built

Plain static files in `game/` with no build step and no network requests. Three.js is vendored as
`game/vendor/three.module.min.js`. Everything else was written for this game: the aircraft is modelled in code
(`game/src/aircraft`), its livery is painted on canvases, and every sound is synthesised with Web Audio.

The rainforest covers the whole island, hills included: every tree grows from a branching skeleton
(trunk, buttress roots, scaffold limbs that fork two or three times, a leaf clump on every twig) in ten
variants (emergent dipterocarps, canopy and sub-canopy trees, light-green pioneers, palms, shrubs and ferns).
Trees near the camera are full models, further out a lighter model of the same tree, and beyond that an
impostor card baked at start-up from that tree in eight directions (colour and normals) and lit in the shader.

The man-made world is modelled part by part with PBR materials painted procedurally at start-up (albedo,
normal and roughness maps for corrugated zinc, painted sheet, weathered planks, ironwood shingles, nipah
thatch, concrete, rock and painted steel; `game/src/world/props`): the arched hangar with its ribs, sign,
half-open doors and lit interior, the control tower with its raked glass cab and rotating beacon, the fuel
farm, a fuel bowser and crew pickup, the windsock, runway, approach and PAPI light units, the stilt houses
and longhouse (stilts and bracing, plank walls, shuttered windows, verandas, shingle, zinc or thatch roofs,
yard props), a lake landing with a jetty and boats, and shore rocks. Each area is merged into one mesh per
material.

```
game/src/aircraft   FW-218 model and livery
game/src/flight     flight physics, damage model, annunciators
game/src/world      terrain, water, sky, weather, forest, village, airstrip, clouds and hornbills
game/src/world/props  hangar, tower, fuel farm, vehicles, houses, boats, rocks and their PBR textures
game/src/fire       fire spread, flames, smoke, water drop and scoop spray
game/src/mission    the five stages, rings, mission director, crash and landing report
game/src/hud        head-up display: tapes, radar, systems, instrument cluster, messages
game/src/cockpit    cockpit shell, instrument panel, gauges, moving map, windscreen, yokes and levers
game/src/camera     chase and cockpit cameras
game/src/audio      synthesised sound
game/src/input      keyboard and mouse, phone stick/throttle/buttons, swipe-to-look and pinch zoom
game/src/ui         title, briefing, pause and result screens, loading bar, phone flow, bundled fonts
game/src/shots      staged scenes for the screenshots (?shot=title|cover|cockpit|scoop|landing)
```

Run it locally with `node serve.ts` (Node 22) and open http://localhost:8080.

## License

MIT, see [LICENSE](LICENSE). The bundled fonts in `game/fonts/` (Michroma, Manrope, JetBrains Mono and
Saira Condensed for the aircraft lettering, from the google/fonts repository) are under the SIL Open Font License 1.1;
their licence texts are next to them (`OFL-*.txt`).

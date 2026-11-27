// BORNEO FIREWING: boot, game state, the main loop that ties flight, fire, mission, camera, HUD and audio.
import * as THREE from 'three';
import { seedRandom } from './core/rng.js';
import { pickQuality } from './core/quality.js';
import { buildTerrain, PLACES, terrainHeight } from './world/terrain.js';
import { buildWater } from './world/water.js';
import { buildSky, SUN_DIR } from './world/sky.js';
import { buildForest } from './world/forest.js';
import { buildVillage } from './world/village.js';
import { buildAirstrip } from './world/airstrip.js';
import { buildClouds } from './world/clouds.js';
import { Weather } from './world/weather.js';
import { buildBirds } from './world/birds.js';
import { buildGrass } from './world/grass.js';
import { buildFW218, animateFW218 } from './aircraft/fw218-model.js';
import { createFlightState, stepFlight, placeOnRunway, setFlying } from './flight/flight-model.js';
import { createDamage, updateDamage, fireBottle } from './flight/damage-model.js';
import { ScoopAutopilot, loadAutoScoop, PHASE_LABEL } from './flight/scoop-autopilot.js';
import { buildFlightReport } from './mission/flight-report.js';
import { EngineEffects } from './fire/engine-effects.js';
import { FireSystem } from './fire/fire-system.js';
import { WaterEffects } from './fire/water-effects.js';
import { particleUniforms } from './fire/particles.js';
import { MissionDirector, landingRating } from './mission/mission-director.js';
import { pulseRing } from './mission/rings.js';
import { Hud } from './hud/hud.js';
import { buildCockpit, updateCockpit } from './cockpit/cockpit-view.js';
import { CameraRig } from './camera/camera-rig.js';
import { SoundEngine } from './audio/sound-engine.js';
import { Controls } from './input/controls.js';
import { bindScreens, showScreen, hideScreens, showResult } from './ui/screens.js';
import { runShot, SHOTS } from './shots/shot-scenes.js';
import { installAtmosphereFog } from './render/atmosphere-fog.js';
import { PostPipeline } from './render/post-pipeline.js';
import { AutoQuality } from './render/auto-quality.js';
import { BurnMap } from './fire/burn-map.js';
import { loadFonts } from './ui/fonts.js';
import { buildGroundTextures } from './textures/ground-textures.js';
import { setupPhone, syncBodyState } from './ui/phone.js';
import { bindGraphicsMenu } from './ui/graphics-menu.js';
import { bindWeatherMenu } from './ui/weather-menu.js';
import { bindAutoScoopMenu } from './ui/autoscoop-menu.js';
import { loadingProgress, hideLoading, watchContext } from './ui/loading.js';

const params = new URLSearchParams(location.search);
const deg = Math.PI / 180;

class Game {
  // Build the world step by step, yielding to the browser between steps so the loading bar moves
  // (phones take a while) and reporting how long each step took (?boottime).
  async init(progress) {
    seedRandom(Number(params.get('seed') || 218));
    this.quality = pickQuality();
    installAtmosphereFog();
    const renderer = new THREE.WebGLRenderer({ antialias: !this.quality.phone, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
    renderer.setPixelRatio(this.quality.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = this.quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('view').appendChild(renderer.domElement);
    watchContext(renderer.domElement, this);
    this.renderer = renderer;
    this.post = new PostPipeline(renderer, this.quality);
    this.autoQuality = new AutoQuality(this);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 30000);
    const q = this.quality;
    if (params.has('boottime')) console.info(`boot start ${Math.round(performance.now())} ms after navigation`);
    const step = async (label, frac, fn) => { await progress(label, frac); const t = performance.now(); fn(); if (params.has('boottime')) console.info(`boot ${label} ${Math.round(performance.now() - t)} ms`); };

    await step('Sky and sun', 0.05, () => { this.sky = buildSky(this.scene, q); this.burnMap = new BurnMap(); });
    await step('Terrain', 0.12, () => {
      this.terrain = buildTerrain(q.terrainSegments, this.burnMap, buildGroundTextures(q.groundTexture));
      this.scene.add(this.terrain);
    });
    await step('Lake, river and sea', 0.24, () => { this.water = null; this.waterSurface = buildWater(q); this.scene.add(this.waterSurface.mesh); });
    await step('Growing the rainforest', 0.32, () => { this.forest = buildForest(this.scene, q, renderer); });
    await step('Grass, village and airstrip', 0.7, () => {
      const lap = (label, fn) => { const t = performance.now(); const r = fn(); if (params.has('boottime')) console.info(`boot   ${label} ${Math.round(performance.now() - t)} ms`); return r; };
      this.grass = lap('grass', () => buildGrass(this.scene, q.grass, q.grassBlades));
      this.village = lap('village', () => buildVillage(this.scene, q));
      this.airstrip = lap('airstrip', () => buildAirstrip(this.scene, q));
    });
    await step('Clouds and hornbills', 0.78, () => {
      this.clouds = buildClouds(this.scene, q.clouds, q.lite);
      this.birds = buildBirds(this.scene, q.birds);
    });
    await step('Weather', 0.8, () => {
      this.wind = new THREE.Vector3(-2, 0, -3);
      this.weather = new Weather(this);
      this.rebuildEnvironment();
    });
    await step('FW-218 Enggang', 0.84, () => {
      this.plane = buildFW218();
      this.scene.add(this.plane);
      this.cockpit = buildCockpit(q);
      this.plane.add(this.cockpit.group);
      this.flight = createFlightState();
    });
    await step('Lighting the fire', 0.92, () => {
      this.fire = new FireSystem(this.scene, this.forest, q, this.burnMap);
      this.fire.steam = this.weather.p.rain > 0; // rain on the fire raises steam
      this.fire.seedScenario();
      this.water = new WaterEffects(this.scene, this.fire, q);
      this.engineFx = new EngineEffects(this.fire);
    });
    this.stats = { flown: 0, dropped: 0, scoops: 0, drops: 0 };
    await step('Instruments and radio', 0.94, () => {
      this.hud = new Hud(document.getElementById('hud'));
      this.rig = new CameraRig(this.camera);
      this.audio = new SoundEngine();
      this.controls = new Controls(renderer.domElement, this);
      if (this.controls.isTouch) this.rig.recentreDelay = 2.2;
      this.mission = new MissionDirector(this);
      this.autopilot = new ScoopAutopilot(loadAutoScoop(this.controls.isTouch || q.phone));
    });
    this.events = { ring: () => { this.audio.ringChime(); this.hud.toast('RING!'); } };
    this.stageData = {};
    this.prevPos = new THREE.Vector3();
    this.state = 'menu';
    this.showHud = false;
    this.showCluster = true;
    this.cameraMode = 'chase';
    this.dropWindow = 0;
    this.dropping = false;
    this.dropReleased = 0;
    this.time = 0;
    this.objective = null;
    this.kinematic = false;

    addEventListener('resize', () => this.resize());
    await step('Screen', 0.95, () => this.resize());
    // Audio may only start on a user-activation event: on phones that is touchend/pointerup, not touchstart.
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'touchend', 'click']) addEventListener(ev, () => this.audio.unlock(), { passive: true });
    addEventListener('focus', () => this.audio.ctx && this.audio.unlock());
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.audio.ctx) this.audio.unlock(); else if (this.state === 'playing') this.setPaused(true); });
    bindScreens(this);
    bindGraphicsMenu(this);
    bindWeatherMenu(this);
    bindAutoScoopMenu(this);
    setupPhone(this);
    this.menuFlyby();
    // Compile every shader now (in parallel where the GPU driver allows) instead of on the first frames.
    await progress('Warming up the engines', 0.97);
    const t = performance.now();
    this.syncVisuals(0);
    try { await renderer.compileAsync(this.scene, this.camera); } catch (e) { console.warn('compile', e.message); }
    if (params.has('boottime')) console.info(`boot shaders ${Math.round(performance.now() - t)} ms`);
    await progress('Ready', 1);
  }

  // Sky reflections for the chrome spinners, glass and water (rebuilt when the weather changes).
  rebuildEnvironment() {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const sky = this.sky.dome.clone();
    sky.visible = true; // the lite path hides the live dome behind a baked background
    envScene.add(sky);
    const old = this.scene.environment;
    this.scene.environment = this.pmrem.fromScene(envScene, 0.02).texture;
    if (old) old.dispose();
    if (this.quality.lite) this.sky.bakeBackground(this.renderer, this.scene); // no per-pixel sky ray-march each frame
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, this.quality.pixelRatio);
    this.waterSurface.setSize(w, h, this.quality.pixelRatio);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hud.resize(w, h, Math.min(devicePixelRatio, 2));
    if (this.refreshGraphicsMenu) this.refreshGraphicsMenu();
    for (const p of [this.fire.flames, this.fire.smoke, this.water.pool]) p.setViewportHeight(h * this.quality.pixelRatio);
  }

  menuFlyby() {
    setFlying(this.flight, new THREE.Vector3(PLACES.fire.x - 600, 260, PLACES.fire.z + 300), 60 * deg, 60, 0, -12 * deg);
    this.kinematic = 'orbit';
    this.rig.yaw = 0.8;
  }

  addScore(n, why) { this.mission.addPoints(n); this.hud.toast(`+${n} ${why}`); }

  startMission(index, opts = {}) {
    if (this.mission.state !== 'idle' && !opts.quiet) {
      location.search = `?play=1&stage=${index}`;
      return;
    }
    hideScreens();
    const s = this.flight;
    const r = PLACES.runway;
    this.autopilot.active = false; this.autopilot.phase = null;
    s.crashed = null; s.engines = true; s.fuel = s.fuelMax; s.water = 0; s.angular.set(0, 0, 0);
    s.damage = createDamage(); s.gLoad = 1; s.lastTouchdown = null;
    this.stats = { flown: 0, dropped: 0, scoops: 0, drops: 0 };
    s.flapTarget = s.flaps = 0;
    this.kinematic = false;
    if (index === 0) {
      placeOnRunway(s, r.x, r.z + r.length / 2 - 40, 0);
      s.throttle = 0; s.rpm = 0; s.engRpm[0] = s.engRpm[1] = 0; s.flapTarget = 0.5;
    } else if (index === 1) {
      setFlying(s, new THREE.Vector3(-300, 260, -650), 100 * deg, 70);
      s.fuel = s.fuelMax * 0.9;
    } else if (index === 2 || index === 3) {
      setFlying(s, new THREE.Vector3(-700, 240, -900), -80 * deg, 70);
      s.water = s.waterMax; s.fuel = s.fuelMax * 0.75;
    } else {
      setFlying(s, new THREE.Vector3(r.x + 260, 230, r.z + r.length / 2 + 2600), 5 * deg, 62);
      s.fuel = s.fuelMax * 0.3;
    }
    this.plane.userData.parts.gearExt = null;
    this.state = 'playing';
    this.showHud = true;
    this.rig.first = true;
    this.rig.yaw = 0; this.rig.pitch = 0.12; this.rig.dist = 34;
    this.mission.start(index);
    this.prevPos.copy(s.position);
  }

  setPaused(p) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = p ? 'paused' : 'playing';
    if (p) { showScreen('pause'); this.audio.silence(); } else hideScreens();
  }

  onMissionEnd(passed) {
    this.state = 'result';
    this.report = buildFlightReport(this, passed);
    if (!passed && this.flight.crashed) { this.audio.crash(); this.rig.shake = 3; this.crashEffect(); }
    setTimeout(() => { this.showHud = false; showResult(this, passed); }, passed ? 1200 : 1800);
  }

  // Fireball and smoke on land, a white splash on water, so a crash reads as what happened.
  crashEffect() {
    const s = this.flight, p = s.position;
    const onWater = terrainHeight(p.x, p.z) < 0;
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 16;
      if (onWater) {
        this.water.pool.spawn(p.x, 0.5, p.z, Math.cos(a) * v, 8 + Math.random() * 18, Math.sin(a) * v, 2.5, 6, 30, [1, 1, 1, 0.9], [0.9, 0.95, 1, 0], 0.4, -9.81, 0);
      } else {
        this.fire.flames.spawn(p.x, p.y, p.z, Math.cos(a) * v, Math.random() * 14, Math.sin(a) * v, 1.5 + Math.random(), 18, 40, [1, 0.9, 0.5, 1], [0.8, 0.15, 0, 0], 0.8, 2);
        if (i % 3 === 0) this.fire.smoke.spawn(p.x, p.y, p.z, Math.cos(a) * v * 0.3, 6 + Math.random() * 6, Math.sin(a) * v * 0.3, 10, 30, 160, [0.1, 0.08, 0.07, 0.8], [0.4, 0.38, 0.36, 0], 0.2, 0.5);
      }
    }
    if (!onWater) this.fire.ignite(p.x, p.z, 0.8);
    this.flight.velocity.multiplyScalar(0.1);
  }

  handleKeys() {
    const c = this.controls;
    if (c.hit('KeyK') && this.state === 'playing') this.toggleAutoScoop();
    if (c.hit('KeyG') && this.state === 'playing') {
      const s = this.flight;
      if (s.onGround && !s.onWater && s.gearDown) this.hud.toast('GEAR LOCKED · ON THE GROUND', '#ffc861');
      else { s.gearDown = !s.gearDown; this.hud.toast(s.gearDown ? 'GEAR DOWN' : 'GEAR UP', '#9dffb0'); }
    }
    if (c.hit('KeyC')) { this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase'; this.rig.mode = this.cameraMode; this.rig.first = true; }
    if (c.hit('KeyP') || c.hit('Escape')) this.setPaused(this.state === 'playing');
    if (c.hit('KeyV')) this.flight.flapTarget = this.flight.flapTarget >= 1 ? 0 : this.flight.flapTarget + 0.5;
    if (c.hit('KeyM')) { this.audio.muted = !this.audio.muted; if (this.audio.muted) this.audio.silence(); }
    if (c.hit('KeyH')) this.showHud = !this.showHud;
    if (c.hit('KeyI')) this.showCluster = !this.showCluster;
    if (c.hit('KeyX') && this.state === 'playing') {
      if (fireBottle(this.flight.damage, this.time)) this.audio.extinguisher();
      else this.hud.toast('NO ENGINE FIRE', '#ffc861');
    }
    if (c.mouse.dx || c.mouse.dy) this.rig.orbit(c.mouse.dx, c.mouse.dy, this.lastDt);
    if (c.mouse.wheel) this.rig.zoom(c.mouse.wheel);
    if (c.mouse.pinch !== 1) this.rig.pinch(c.mouse.pinch);
    if (c.hit('Recentre')) this.rig.recentre();
  }

  // K / the AUTO SCOOP button: engage near the lake, or hand control back.
  toggleAutoScoop() {
    const ap = this.autopilot, s = this.flight;
    if (ap.active) ap.disengage('AUTOPILOT OFF · YOU HAVE CONTROL');
    else if (!ap.enabled) this.hud.toast('AUTO SCOOP IS OFF · TURN IT ON IN THE MENU', '#ffc861');
    else if (s.water >= s.waterMax * 0.9) this.hud.toast('TANK ALREADY FULL', '#ffc861');
    else if (!ap.available(s)) this.hud.toast('AUTO SCOOP · FLY TO THE LAKE FIRST', '#ffc861');
    else ap.engage(s);
  }

  // Advance the world by dt (fixed sub-steps for the flight model).
  simulate(dt) {
    const s = this.flight;
    this.time += dt;
    this.prevPos.copy(s.position);
    let input = this.state === 'playing' ? this.controls.read() : { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, drop: false, brakes: false };
    if (this.state === 'playing' && !this.kinematic) input = this.autopilot.control(s, input);
    // Gear comes down by itself on final to the airstrip (full flaps, low, over land).
    if (!s.gearDown && !s.onGround && s.flapTarget >= 1 && s.agl < 150 && terrainHeight(s.position.x, s.position.z) > 0
      && Math.hypot(s.position.x - PLACES.runway.x, s.position.z - PLACES.runway.z) < 3200) { s.gearDown = true; this.hud.toast('GEAR DOWN', '#9dffb0'); }
    if (this.autopilot.message) { this.hud.toast(this.autopilot.message.text, this.autopilot.message.color); this.audio.beep(this.autopilot.active ? 880 : 660, 0.12); this.autopilot.message = null; }
    if (input.throttleSet != null) s.throttle = input.throttleSet;
    s.turbulence = this.fire.smokeAt(s.position);

    if (this.kinematic) {
      if (this.kinematic === 'orbit') {
        const c = new THREE.Vector3(PLACES.fire.x, 0, PLACES.fire.z);
        const a = this.time * 0.07;
        s.position.set(c.x + Math.cos(a) * 700, 250, c.z + Math.sin(a) * 700);
        s.quaternion.setFromEuler(new THREE.Euler(0, Math.PI - a, -14 * deg, 'YXZ'));
        s.velocity.set(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(49);
        s.airspeed = 49; s.rpm = 0.8; s.engRpm[0] = s.engRpm[1] = 0.8;
      } else {
        s.position.addScaledVector(s.velocity, dt);
        s.airspeed = s.velocity.length();
        s.rpm = Math.max(s.rpm, 0.85); s.engRpm[0] = s.engRpm[1] = s.rpm;
        if (this.forceScoop) { s.scooping = true; s.onWater = true; s.water = Math.min(s.waterMax, s.water + 520 * dt); }
        const e = new THREE.Euler().setFromQuaternion(s.quaternion, 'YXZ');
        s.pitch = e.x; s.roll = e.z; s.heading = ((-e.y / deg) + 360) % 360; s.vs = s.velocity.y;
        s.agl = s.position.y - Math.max(0, terrainHeight(s.position.x, s.position.z));
      }
    } else if (this.state === 'playing') {
      if (this.autopilot.active) this.autopilot.fly(s, dt); // AUTO SCOOP flies its guided path
      else {
        const steps = Math.ceil(dt / (1 / 120));
        for (let i = 0; i < steps; i++) stepFlight(s, input, dt / steps, { wind: this.wind, time: this.time, fuelBurn: 1.6 });
      }
      if (!s.crashed) updateDamage(s, s.damage, { dt, time: this.time, heat: s.turbulence * 0.8, birds: this.birds.list });
      this.stats.flown += s.velocity.length() * dt;
      if (s.scooping && !this.wasScooping) this.stats.scoops++;
      this.wasScooping = s.scooping;
    }
    for (const e of s.damage.events) { this.hud.alert(this.controls.isTouch ? e.text.replace('PRESS X', 'TAP FIRE BOTTLE') : e.text, e.level); this.audio.caution(e.level); }
    s.damage.events.length = 0;
    this.engineFx.update(this.plane, s, dt);

    // Water drop: hold SPACE (or the touch button) to open the belly doors.
    const wantDrop = (input.drop || this.forceDrop) && s.water > 0 && !s.onGround;
    s.doors += ((wantDrop ? 1 : 0) - s.doors) * Math.min(1, dt * 6);
    if (wantDrop && s.doors > 0.3) {
      if (!this.dropping) this.dropMark = { hits: this.water.hits, landed: this.water.landed };
      const r = this.water.emitDrop(s, dt, 2400);
      this.dropReleased += r;
      this.stats.dropped += r;
      this.dropping = true;
    } else if (this.dropping && !wantDrop) {
      this.dropping = false;
      if (this.dropReleased > 400) { this.lastDropDone = true; this.stats.drops++; this.dropCheck = { ...this.dropMark, at: this.time + 4.5 }; }
      this.dropReleased = 0;
    }
    // Score the drop once the water has landed: direct hit, partial or miss.
    if (this.dropCheck && this.time > this.dropCheck.at) {
      const landed = this.water.landed - this.dropCheck.landed;
      this.hud.dropResult(landed ? (this.water.hits - this.dropCheck.hits) / landed : 0);
      this.dropCheck = null;
    }
    if (s.scooping) this.water.emitScoopSpray(s);
    if (s.stall && this.state === 'playing' && Math.floor(this.time * 3) !== Math.floor((this.time - dt) * 3)) this.audio.stallWarn();
    this.dropWindow = Math.max(0, this.dropWindow - dt);
    if (s.lastTouchdown && s.lastTouchdown !== this.seenTouchdown) {
      this.seenTouchdown = s.lastTouchdown;
      const td = s.lastTouchdown;
      if (td.water && this.autopilot.active) { /* the autopilot's skim: no touchdown call-outs */ } else if (td.bounce) this.hud.toast('BOUNCE · TOO FAST OR STEEP', '#ff7a5a');
      else this.hud.toast(`TOUCHDOWN ${Math.round(td.vs * 196.85)} FPM · ${landingRating(td)}`, td.vs > -2.5 ? '#9dffb0' : '#ffc861');
    }

    this.fire.update(dt, this.wind, this.time, this.camera.position);
    this.water.update(dt, this.wind);
    if (this.state === 'playing') this.mission.update(dt);
    if (this.mission.stage) this.objective = this.mission.stage.objective(this);
    // AUTO SCOOP: the marker shows where the autopilot is heading next, and why.
    const ap = this.autopilot;
    if (ap.active && ap.target) {
      this.apMark = this.apMark || { pos: new THREE.Vector3(), label: '' };
      this.apMark.pos.set(ap.target.x, ap.target.y, ap.target.z);
      this.apMark.label = `AUTO SCOOP · ${PHASE_LABEL[ap.phase] || ''}`;
      this.objective = this.apMark;
    }
    this.syncVisuals(dt);
  }

  syncVisuals(dt) {
    const s = this.flight;
    this.plane.position.copy(s.position);
    this.plane.quaternion.copy(s.quaternion);
    animateFW218(this.plane, { ...s, cockpit: this.cameraMode === 'cockpit' }, dt, this.time);
    this.cockpit.group.visible = this.cameraMode === 'cockpit';
    if (this.cockpit.group.visible) updateCockpit(this.cockpit, this, dt);
    this.rig.shake = Math.max(s.turbulence * 1.5, this.rig.shake * (1 - dt * 2));
    this.rig.update(s, dt, this.controls.looking);
    this.focus = (this.focus || new THREE.Vector3()).set(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize().multiplyScalar(this.quality.shadowBox * 0.55).add(this.camera.position);
    this.focus.y = Math.max(terrainHeight(this.focus.x, this.focus.z), 0);
    this.sky.follow(this.camera.position, this.focus);
    this.sky.uniforms.time.value = this.time;
    this.terrain.userData.uniforms.uTime.value = this.time;
    this.forest.update(this.camera, this.time, SUN_DIR);
    particleUniforms.time.value = this.time;
    particleUniforms.sunView.value.copy(SUN_DIR).transformDirection(this.camera.matrixWorldInverse);
    // Smoke thickens the haze around the fire.
    const smoke = s.turbulence;
    this.scene.fog.near = this.weather.fogDensity * (1 + smoke * 10);
    this.weather.update(dt, this.time);
    this.waterSurface.update(this.time);
    this.airstrip.update(this.time, s, this.wind);
    this.birds.update(this.time);
    this.clouds.update(this.time, this.camera);
    for (const key of ['rings']) for (const r of this.stageData[key] || []) pulseRing(r, this.time, true);
    if (this.stageData.ring) pulseRing(this.stageData.ring, this.time, true);
    const near = Math.max(0, 1 - this.camera.position.distanceTo(new THREE.Vector3(PLACES.fire.x, 50, PLACES.fire.z)) / 900);
    this.audio.update(s, near, this.time);
  }

  frame(dt) {
    this.lastDt = dt;
    this.autoQuality.sample(dt);
    this.handleKeys();
    if (this.state !== 'paused') this.simulate(Math.min(dt, 0.05));
    this.waterSurface.renderReflection(this.renderer, this.scene, this.camera);
    this.post.render(this.scene, this.camera, SUN_DIR, this.time);
    this.hud.draw(this, dt);
    this.controls.syncThrottle(this.flight.throttle, this.flight);
    this.controls.endFrame();
    syncBodyState(this);
  }
}

if (params.has('shot')) document.body.classList.add('shot');
await loadFonts();
const game = new Game();
await game.init(loadingProgress);
window.__game = game;
if (params.has('boottime')) console.info(`boot init done ${Math.round(performance.now())}`);
hideLoading();
const shot = params.get('shot');
if (shot && SHOTS[shot]) {
  document.body.classList.add('shot');
  hideScreens();
  runShot(game, shot);
  // Optional free camera for inspection shots: &cam=x,y,z&look=x,y,z
  if (params.get('cam')) {
    const [cx, cy, cz] = params.get('cam').split(',').map(Number);
    const [lx, ly, lz] = (params.get('look') || '0,0,0').split(',').map(Number);
    game.camera.position.set(cx, cy, cz);
    game.camera.up.set(0, 1, 0);
    game.camera.lookAt(lx, ly, lz);
    game.camera.updateMatrixWorld();
    game.forest.update(game.camera, game.time, SUN_DIR);
    game.sky.follow(game.camera.position, new THREE.Vector3(lx, Math.max(0, ly), lz));
    if (params.get('nohud')) game.showHud = false;
  }
  game.waterSurface.renderReflection(game.renderer, game.scene, game.camera);
  game.post.render(game.scene, game.camera, SUN_DIR, game.time);
  game.hud.draw(game, 0);
  window.__shotReady = true;
} else {
  if (params.get('play')) game.startMission(Number(params.get('stage') || 0));
  else showScreen('title');
  let last = performance.now();
  const minGap = game.quality.fpsCap ? 1000 / game.quality.fpsCap - 3 : 0; // lite phones: steady 30 fps, half the GPU heat
  const loop = (now) => {
    if (minGap && now - last < minGap) { requestAnimationFrame(loop); return; }
    const dt = Math.max(0, (now - last) / 1000); // rAF time can precede performance.now() on the first frame
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

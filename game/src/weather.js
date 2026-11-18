// Weather over Azura Bay: the sky has moods, and the bay answers them.
// A slow state machine walks clear → overcast → rain → storm and back to
// clear, dwelling in each state long enough for a drive to change character
// mid-journey. Rain is a curtain of streaks that falls around the camera and
// follows it; storms add thunder — a white flash the main loop folds into
// the hemisphere light — and rain of any kind soaks the city: wetness climbs
// while it rains and dries in the sun, and main.js reads it to darken the
// roads. Nothing here knows about missions or police; weather is weather,
// it happens to everyone in the bay equally.

import * as THREE from 'three';
import { clamp, lerp } from './random.js';

// How each state behaves: how long it may last, how grey it makes the sky
// (cloud), how hard it rains (rain), and how far a driver can see (fog).
const STATES = {
  clear: { next: 'overcast', min: 55, max: 95, cloud: 0, rain: 0, fogNear: 120, fogFar: 420 },
  overcast: { next: 'rain', min: 22, max: 38, cloud: 0.65, rain: 0, fogNear: 95, fogFar: 330 },
  rain: { next: 'storm', min: 30, max: 55, cloud: 0.85, rain: 0.65, fogNear: 62, fogFar: 225 },
  storm: { next: 'clear', min: 16, max: 30, cloud: 1, rain: 1, fogNear: 40, fogFar: 155 },
};

const DROP_COUNT = 430;      // rain streaks alive at full storm strength
const RAIN_RADIUS = 36;      // the rain curtain follows the camera in this box
const RAIN_HEIGHT = 30;
const SLATE = new THREE.Color(0x59636e);   // storm-grey the sky fades toward
const FOG_WET = new THREE.Color(0x6d7a85);

/**
 * Build the weather for a scene. `camera` is accepted so the rain curtain
 * can centre on the view when no focus is passed to update(); `random` is
 * injectable so a seeded game stays reproducible.
 */
export function createWeather(scene, camera = null, random = Math.random) {
  // The rain curtain: one LineSegments draw call, each drop a short slanted
  // segment. Drops live in a box around the focus and recycle to the top.
  const positions = new Float32Array(DROP_COUNT * 2 * 3);
  const drops = [];
  for (let i = 0; i < DROP_COUNT; i += 1) {
    drops.push({
      dx: (random() * 2 - 1) * RAIN_RADIUS,
      dz: (random() * 2 - 1) * RAIN_RADIUS,
      y: random() * RAIN_HEIGHT,
      speed: 19 + random() * 9,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xcfe4f2, transparent: true, opacity: 0 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  const weather = {
    state: 'clear',
    stateTimer: 40 + random() * 30,  // a long first calm: menus and openings stay dry
    cloudiness: 0,                   // eased 0..1 greyness of the sky
    rainLevel: 0,                    // eased 0..1 rain intensity right now
    wetness: 0,                      // 0..1 how soaked the city is; dries slowly
    flash: 0,                        // thunder flash 0..1, main.js adds it to the light
    thunderTimer: 3 + random() * 5,
    update,
  };

  function setState(next) {
    weather.state = next;
    const def = STATES[next];
    weather.stateTimer = def.min + random() * (def.max - def.min);
    if (next === 'storm') weather.thunderTimer = 1.5 + random() * 3;
  }

  function update(dt, focusPos = null) {
    const focus = focusPos || (camera ? camera.position : { x: 0, z: 0 });
    const def = STATES[weather.state];

    // The state machine: dwell, then move on to the next mood in the cycle.
    weather.stateTimer -= dt;
    if (weather.stateTimer <= 0) setState(def.next);
    const now = STATES[weather.state];

    // Ease the visible quantities toward the state's targets so fronts roll
    // in over a few seconds instead of snapping.
    const ease = 1 - Math.pow(0.4, dt); // ~60% of the way in a second
    weather.cloudiness = lerp(weather.cloudiness, now.cloud, ease * 0.5);
    weather.rainLevel = lerp(weather.rainLevel, now.rain, ease * 0.7);

    // Wetness is the city's memory of rain: it soaks while rain falls and
    // dries once the sky clears, slower than either change of weather.
    if (weather.rainLevel > 0.05) {
      weather.wetness = clamp(weather.wetness + weather.rainLevel * dt / 22, 0, 1);
    } else if (weather.state === 'clear') {
      weather.wetness = clamp(weather.wetness - dt / 75, 0, 1);
    }

    // Fog closes in and the whole sky greys as cloud builds. main.js has
    // already painted this frame's time-of-day sky; weather tints over it.
    if (scene.fog) {
      scene.fog.near = lerp(scene.fog.near, now.fogNear, ease);
      scene.fog.far = lerp(scene.fog.far, now.fogFar, ease);
      if (weather.cloudiness > 0.02) {
        scene.fog.color.lerp(FOG_WET, weather.cloudiness * 0.35 * ease + weather.cloudiness * 0.004);
      }
    }
    if (scene.background && scene.background.isColor && weather.cloudiness > 0.02) {
      scene.background.lerp(SLATE, weather.cloudiness * 0.3 * ease + weather.cloudiness * 0.003);
    }

    // Thunder: in a storm, a random countdown ends in a flash that flickers
    // twice, like the real thing arguing with itself.
    weather.flash = Math.max(0, weather.flash - dt * 5.5);
    if (weather.state === 'storm') {
      weather.thunderTimer -= dt;
      if (weather.thunderTimer <= 0) {
        weather.flash = 0.75 + random() * 0.25;
        weather.thunderTimer = 3.5 + random() * 8;
      }
    }

    // Rain streaks: fall fast, slant with a steady sea wind, recycle to the
    // top of the box, and thin out as the rain eases (extra drops park
    // below ground where nobody can see them).
    const active = Math.floor(DROP_COUNT * weather.rainLevel);
    rain.visible = active > 4;
    rainMat.opacity = 0.14 + weather.rainLevel * 0.33;
    if (rain.visible) {
      const slant = 0.16 + weather.rainLevel * 0.12;
      const len = 0.55 + weather.rainLevel * 0.75;
      for (let i = 0; i < DROP_COUNT; i += 1) {
        const drop = drops[i];
        const o = i * 6;
        if (i >= active) {
          positions[o + 1] = -5; positions[o + 4] = -5;
          continue;
        }
        drop.y -= drop.speed * (0.65 + weather.rainLevel * 0.6) * dt;
        // A drop that lands — or one the camera has walked away from —
        // restarts at the top of the curtain around the focus.
        if (drop.y < 0 || Math.abs(drop.dx) > RAIN_RADIUS || Math.abs(drop.dz) > RAIN_RADIUS) {
          drop.y = RAIN_HEIGHT * (0.6 + random() * 0.4);
          drop.dx = (random() * 2 - 1) * RAIN_RADIUS;
          drop.dz = (random() * 2 - 1) * RAIN_RADIUS;
        }
        const wx = focus.x + drop.dx;
        const wz = focus.z + drop.dz;
        positions[o] = wx;
        positions[o + 1] = drop.y;
        positions[o + 2] = wz;
        positions[o + 3] = wx - len * slant;
        positions[o + 4] = drop.y + len;
        positions[o + 5] = wz;
        // Drift the whole curtain with the wind so standing rain still moves.
        drop.dx -= dt * 1.1;
        if (drop.dx < -RAIN_RADIUS) drop.dx += RAIN_RADIUS * 2;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
  }

  return weather;
}

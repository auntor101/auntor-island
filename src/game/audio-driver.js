// Per-frame glue between the player and the audio engine: listener, ambience context, footsteps, splash and shallow-water ripples. No allocation per frame.
import { coastRadius, FALLS, LAKE, zoneAt, heightAt, waterSurfaceAt } from '../world/island.js';
import { groundType } from './ground.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createAudioDriver(audio, water, village) {
  const ctx = { hours: 12, snow: false, speed: 0, zone: 'meadow', shore: 0, water: 0, falls: 0, altitude: 0, nearFire: 0, nearForge: false, onGround: true, inWater: false };
  const A = village.anchors, F = FALLS[0];
  let stepT = 0, wasIn = false, rip = 0;
  return {
    ctx,
    update(dt, s, hours, snowK) {
      const { x, z } = s, zone = zoneAt(x, z), surf = waterSurfaceAt(x, z), depth = surf === null ? 0 : surf - heightAt(x, z);
      const inWater = depth > 0.12;
      ctx.hours = ((hours % 24) + 24) % 24; ctx.snow = snowK > 0.5; ctx.speed = s.speed; ctx.zone = zone; ctx.inWater = inWater;
      ctx.shore = clamp01(1 - (coastRadius(Math.atan2(z, x)) - Math.hypot(x, z)) / 40);
      ctx.water = clamp01(1 - (Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r) / 30);
      ctx.falls = clamp01(1 - Math.hypot(x - F.x, z - F.z) / 70);
      ctx.altitude = s.y;
      ctx.nearFire = clamp01(1 - Math.hypot(x - A.greatHall.x, z - A.greatHall.z) / 14);
      ctx.nearForge = Math.hypot(x - A.forge.x, z - A.forge.z) < 16;
      audio.setListener(x, z, s.heading + Math.PI); // the player's heading 0 faces -z, the audio's forward is (sin h, cos h): offset by pi
      audio.update(dt, ctx);
      if (inWater && !wasIn) audio.sfx('splash', { x, z });
      wasIn = inWater;
      if (s.speed > 0.5) {
        stepT += dt * (s.speed > 3.5 ? 3 : 2);
        if (stepT >= 1) { stepT = 0; audio.sfx('footstep-' + (surf !== null && depth > 0 ? 'water' : groundType(x, z, zone, snowK, village)), { x, z, gain: 0.7 }); }
      } else stepT = 0.6;
      rip -= dt;
      if (surf !== null && depth > 0 && s.speed > 0.3 && rip <= 0) { rip = 0.35; water.ripple(x, z, Math.min(1, s.speed / 3)); }
    },
  };
}

// Golden Hour: Island Run — everything the eye sees.
// A chase camera behind the plane, a pinhole projection of the archipelago,
// and a lit instrument panel. No images: the sky, sea, islands, runway, rings
// and the plane are all drawn from the world state each frame.
import { COLORS, SUN, VIEW } from './config.js';
import { RUNWAY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const DEG = Math.PI / 180;

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = VIEW.width;
  const H = VIEW.height;
  const cx = W / 2;
  const cy = H / 2;
  const fLen = (H / 2) / Math.tan((VIEW.fov / 2) * DEG);

  /** Camera basis from heading and pitch (degrees). */
  function camera(state) {
    const h = state.headingDeg * DEG;
    const p = -state.pitchDeg * 0.45 * DEG; // the camera looks a little with the nose
    const forward = { x: Math.sin(h) * Math.cos(p), y: Math.sin(p), z: Math.cos(h) * Math.cos(p) };
    const right = { x: Math.cos(h), y: 0, z: -Math.sin(h) };
    const up = { x: -Math.sin(h) * Math.sin(p), y: Math.cos(p), z: -Math.cos(h) * Math.sin(p) };
    const cam = {
      x: state.x - forward.x * 26,
      y: state.y + 7,
      z: state.z - forward.z * 26,
    };
    return { forward, right, up, cam, pitch: p };
  }

  function project(cam, px, py, pz) {
    const dx = px - cam.cam.x;
    const dy = py - cam.cam.y;
    const dz = pz - cam.cam.z;
    const xc = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
    const yc = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
    const zc = dx * cam.forward.x + dy * cam.forward.y + dz * cam.forward.z;
    if (zc < 2) return null;
    return { x: cx + (xc / zc) * fLen, y: cy - (yc / zc) * fLen, z: zc, scale: fLen / zc };
  }

  function sky(cam, t) {
    const horizonY = cy - Math.tan(cam.pitch) * fLen;
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    g.addColorStop(0, COLORS.skyTop);
    g.addColorStop(0.55, COLORS.skyMid);
    g.addColorStop(1, COLORS.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.max(horizonY, 0));
    // Sun: a low golden disc with a wide glow.
    const sunAz = SUN.azimuthDeg * DEG;
    const sunEl = SUN.elevationDeg * DEG;
    const sunDir = { x: Math.sin(sunAz) * Math.cos(sunEl), y: Math.sin(sunEl), z: Math.cos(sunAz) * Math.cos(sunEl) };
    const sun = project(cam, cam.cam.x + sunDir.x * 9000, cam.cam.y + sunDir.y * 9000, cam.cam.z + sunDir.z * 9000);
    let sunScreen = null;
    if (sun) {
      sunScreen = sun;
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 260);
      glow.addColorStop(0, 'rgba(255, 214, 130, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 176, 92, 0.55)');
      glow.addColorStop(1, 'rgba(255, 176, 92, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 260, sun.y - 260, 520, 520);
      ctx.fillStyle = '#fff3cf';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    return { horizonY, sunScreen };
  }

  function clouds(cam, world, t) {
    for (const cloud of world.clouds) {
      const az = (cloud.azimuthDeg + t * cloud.speed * 0.02) * DEG;
      const el = cloud.elevationDeg * DEG;
      const dir = { x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: Math.cos(az) * Math.cos(el) };
      const p = project(cam, cam.cam.x + dir.x * 8000, cam.cam.y + dir.y * 8000, cam.cam.z + dir.z * 8000);
      if (!p || p.y > H * 0.62) continue;
      const s = cloud.size * p.scale * 0.9;
      ctx.fillStyle = 'rgba(255, 232, 200, 0.75)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 244, 224, 0.6)';
      ctx.beginPath();
      ctx.ellipse(p.x - s * 0.4, p.y + s * 0.06, s * 0.6, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function sea(cam, horizonY, sunScreen, t) {
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, '#c98a4e');
    g.addColorStop(0.18, COLORS.seaDeep);
    g.addColorStop(1, '#123f58');
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(horizonY, 0), W, H - Math.max(horizonY, 0));
    // Sun glitter: a column of flickering sparkles under the sun.
    if (sunScreen) {
      for (let i = 0; i < 70; i += 1) {
        const gx = sunScreen.x + (hash(i) - 0.5) * 560;
        const gy = horizonY + 14 + hash(i + 500) * (H - horizonY - 30);
        const tw = 0.25 + 0.55 * Math.abs(Math.sin(t * 2.2 + i * 1.7));
        ctx.fillStyle = `rgba(255, 196, 110, ${tw * 0.5})`;
        ctx.fillRect(gx, gy, 7 + hash(i + 9) * 14, 1.6);
      }
    }
  }

  function island(cam, island, state) {
    const top = project(cam, island.x, island.h, island.z);
    const base = project(cam, island.x, 0, island.z);
    if (!top || !base) return;
    if (top.z > 6000) return;
    const rx = island.r * top.scale;
    if (rx < 2) return;
    // Sand skirt at sea level, then the green hill above it.
    ctx.fillStyle = COLORS.sand;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, rx * 1.04, rx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.hillGreen;
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, rx * 0.94, rx * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.hillDark;
    ctx.beginPath();
    ctx.ellipse(top.x, top.y - rx * 0.05, rx * 0.55, rx * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Patches of darker and lighter grass break up the flat top.
    for (let i = 0; i < 4; i += 1) {
      const px = top.x + (hash(island.x + i * 7) - 0.5) * rx * 1.1;
      const py = top.y - rx * 0.05 + (hash(island.z + i * 13) - 0.5) * rx * 0.3;
      ctx.fillStyle = i % 2 ? 'rgba(20, 80, 40, 0.25)' : 'rgba(140, 190, 90, 0.20)';
      ctx.beginPath();
      ctx.ellipse(px, py, rx * (0.16 + hash(i * 3) * 0.12), rx * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Palm trees on the nearer islands.
    if (top.z < 2600) {
      for (const palm of island.palms) {
        const pp = project(cam, palm.x, island.h * 0.55, palm.z);
        if (!pp) continue;
        const s = 16 * pp.scale * palm.s;
        if (s < 1.5 || s > 60) continue;
        ctx.strokeStyle = '#6b4a2a';
        ctx.lineWidth = Math.max(1, s * 0.09);
        ctx.beginPath();
        ctx.moveTo(pp.x, pp.y);
        ctx.lineTo(pp.x + s * 0.08, pp.y - s);
        ctx.stroke();
        ctx.strokeStyle = COLORS.palmGreen;
        ctx.lineWidth = Math.max(1, s * 0.11);
        for (let f = 0; f < 4; f += 1) {
          const a = -Math.PI / 2 + (f - 1.5) * 0.55;
          ctx.beginPath();
          ctx.moveTo(pp.x + s * 0.08, pp.y - s);
          ctx.quadraticCurveTo(
            pp.x + s * 0.08 + Math.cos(a) * s * 0.5,
            pp.y - s + Math.sin(a) * s * 0.5 - s * 0.2,
            pp.x + s * 0.08 + Math.cos(a) * s * 0.85,
            pp.y - s + Math.sin(a) * s * 0.85 + s * 0.28,
          );
          ctx.stroke();
        }
      }
    }
  }

  function runway(cam, state) {
    // The strip is drawn in 100 m segments so a corner behind the camera
    // only drops its own segment instead of the whole runway.
    const hw = RUNWAY.halfWidth;
    for (let z = RUNWAY.zStart; z < RUNWAY.zEnd; z += 100) {
      const z2 = Math.min(RUNWAY.zEnd, z + 100);
      const a = project(cam, -hw, RUNWAY.elevation, z);
      const b = project(cam, hw, RUNWAY.elevation, z);
      const c = project(cam, hw, RUNWAY.elevation, z2);
      const d = project(cam, -hw, RUNWAY.elevation, z2);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = COLORS.runway;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, 3.5 * a.scale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(d.x, d.y);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
    // Centre dashes and edge lights, stepping along the strip.
    for (let z = RUNWAY.zStart + 40; z < RUNWAY.zEnd; z += 80) {
      const a = project(cam, 0, RUNWAY.elevation + 0.4, z);
      const b = project(cam, 0, RUNWAY.elevation + 0.4, z + 36);
      if (!a || !b) continue;
      ctx.strokeStyle = COLORS.runwayLine;
      ctx.lineWidth = Math.max(1, 3 * a.scale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      for (let z = RUNWAY.zStart; z <= RUNWAY.zEnd; z += 100) {
        const p = project(cam, side * RUNWAY.halfWidth, RUNWAY.elevation + 0.6, z);
        if (!p) continue;
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, 2.4 * p.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Threshold bars at the near end.
    const t1 = project(cam, -RUNWAY.halfWidth + 3, RUNWAY.elevation + 0.4, RUNWAY.zStart + 8);
    const t2 = project(cam, RUNWAY.halfWidth - 3, RUNWAY.elevation + 0.4, RUNWAY.zStart + 8);
    if (t1 && t2) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, 6 * t1.scale);
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.stroke();
    }
  }

  function rings(cam, world, state) {
    const sorted = [...world.rings].sort((a, b) => {
      const da = (a.x - state.x) ** 2 + (a.z - state.z) ** 2;
      const db = (b.x - state.x) ** 2 + (b.z - state.z) ** 2;
      return db - da;
    });
    for (const ring of sorted) {
      const p = project(cam, ring.x, ring.y, ring.z);
      if (!p) continue;
      const r = ring.r * p.scale;
      if (r < 2 || r > 900) continue;
      const done = ring.done;
      ctx.save();
      ctx.shadowColor = done ? COLORS.ringDone : COLORS.ring;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = done ? COLORS.ringDone : COLORS.ring;
      ctx.lineWidth = Math.max(2, r * 0.09);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, r * 0.02);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      if (r > 14) {
        ctx.fillStyle = done ? COLORS.ringDone : '#fff2c4';
        ctx.font = `bold ${Math.max(11, Math.min(26, r * 0.5))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(ring.index + 1), p.x, p.y - r - 8);
      }
    }
  }

  function nextRingArrow(cam, world, state) {
    const ring = world.rings[state.nextRing];
    if (!ring) return;
    const p = project(cam, ring.x, ring.y, ring.z);
    const dist = Math.hypot(ring.x - state.x, ring.y - state.y, ring.z - state.z);
    const label = `RING ${state.nextRing + 1} · ${Math.round(dist)}m`;
    if (p && p.x > 60 && p.x < W - 60 && p.y > 90 && p.y < H - 190) {
      ctx.fillStyle = 'rgba(16,21,29,0.72)';
      ctx.beginPath();
      ctx.roundRect(p.x - 62, p.y + 34, 124, 24, 6);
      ctx.fill();
      ctx.fillStyle = COLORS.hudAmber;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, p.y + 51);
      return;
    }
    // Off-screen: an edge arrow pointing at it.
    let bearing = Math.atan2(ring.x - state.x, ring.z - state.z) * 180 / Math.PI;
    let rel = ((bearing - state.headingDeg + 540) % 360) - 180;
    const ax = cx + Math.max(-1, Math.min(1, Math.sin(rel * DEG) * 2.4)) * (W / 2 - 70);
    const ay = 150;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.max(-1.1, Math.min(1.1, rel * DEG * 1.4)));
    ctx.fillStyle = COLORS.ring;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 10);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(16,21,29,0.72)';
    ctx.beginPath();
    ctx.roundRect(ax - 62, ay + 20, 124, 24, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, ax, ay + 37);
  }

  function planeSprite(state, t) {
    const px = cx;
    const py = H - 218;
    const bank = -state.bankDeg * DEG;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(bank * 0.85);
    const s = 1 + Math.min(0.12, state.speed / 800);
    ctx.scale(s, s);
    // Propeller blur disc.
    const propA = 0.16 + 0.1 * Math.sin(t * 40);
    ctx.fillStyle = `rgba(220, 230, 240, ${propA})`;
    ctx.beginPath();
    ctx.ellipse(0, -6, 74, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings: wide, slightly swept, sunlit gold on top.
    ctx.fillStyle = '#e8a13c';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.quadraticCurveTo(-70, -14, -16, -4);
    ctx.lineTo(-16, 12);
    ctx.quadraticCurveTo(-70, 22, -118, 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(118, 6);
    ctx.quadraticCurveTo(70, -14, 16, -4);
    ctx.lineTo(16, 12);
    ctx.quadraticCurveTo(70, 22, 118, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c87f22';
    ctx.beginPath();
    ctx.moveTo(-118, 6);
    ctx.lineTo(-16, -4);
    ctx.lineTo(-16, 12);
    ctx.lineTo(-118, 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(118, 6);
    ctx.lineTo(16, -4);
    ctx.lineTo(16, 12);
    ctx.lineTo(118, 18);
    ctx.closePath();
    ctx.fill();
    // Fuselage: rear view, rounded, cream with a teal stripe.
    ctx.fillStyle = '#f7ead0';
    ctx.beginPath();
    ctx.moveTo(-26, -46);
    ctx.quadraticCurveTo(0, -56, 26, -46);
    ctx.lineTo(30, 34);
    ctx.quadraticCurveTo(0, 46, -30, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a7f8f';
    ctx.fillRect(-26, -8, 52, 9);
    // Tail fin and stabiliser.
    ctx.fillStyle = '#2a7f8f';
    ctx.beginPath();
    ctx.moveTo(-8, -48);
    ctx.lineTo(0, -84);
    ctx.lineTo(10, -48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8a13c';
    ctx.fillRect(-34, -40, 68, 7);
    // Cockpit glass glint.
    ctx.fillStyle = 'rgba(90, 180, 220, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -30, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nav lights: red left, green right, white strobe blinking.
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-118, 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff88';
    ctx.beginPath();
    ctx.arc(118, 12, 4, 0, Math.PI * 2);
    ctx.fill();
    if (Math.sin(t * 6) > 0.2) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -84, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landing gear on the ground.
    if (state.onGround) {
      ctx.strokeStyle = '#3a3f46';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, 40);
      ctx.lineTo(-18, 56);
      ctx.moveTo(18, 40);
      ctx.lineTo(18, 56);
      ctx.stroke();
      ctx.fillStyle = '#22262c';
      ctx.beginPath();
      ctx.arc(-18, 60, 7, 0, Math.PI * 2);
      ctx.arc(18, 60, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function dial(x, y, r, label, value, max, unit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.strokeStyle = '#cfe3ef';
      ctx.lineWidth = i % 5 === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
      ctx.lineTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
      ctx.stroke();
    }
    const a = -Math.PI * 0.75 + (Math.max(0, Math.min(1, value / max))) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffcf5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 14), Math.sin(a) * (r - 14));
    ctx.stroke();
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, r + 16);
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(unit, 0, 6);
    ctx.restore();
  }

  function artificialHorizon(x, y, r, state) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(-state.bankDeg * DEG);
    const pitchPx = state.pitchDeg * 1.6;
    ctx.fillStyle = '#7fb6e8';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + r);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffcf5e';
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.lineTo(x, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', x, y + r + 16);
  }

  function hud(world, state, t) {
    const s = state;
    // Compass tape across the top.
    const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(s.headingDeg)).padStart(3, '0')}°`, cx, 30);
    for (let d = -90; d <= 90; d += 15) {
      const h = (Math.round(s.headingDeg) + d + 360) % 360;
      const x = cx + d * 4.4;
      const label = h % 45 === 0 ? headings[(h / 45) % 8] : String(h);
      ctx.fillStyle = h % 45 === 0 ? COLORS.hudAmber : '#cfe3ef';
      ctx.font = h % 45 === 0 ? 'bold 14px system-ui, sans-serif' : '11px system-ui, sans-serif';
      ctx.fillText(label, x, 30);
      ctx.fillRect(x - 0.5, 36, 1, 6);
    }
    // Top-left flight data.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(12, 56, 250, 92);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${Math.round(s.speed * 1.944)}`, 24, 92);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ef';
    ctx.fillText('KTS', 92, 92);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`${Math.round(s.y * 3.281)}`, 24, 128);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ef';
    ctx.fillText('FT ALT', 110, 128);
    // Top-right score and fuel.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(W - 262, 56, 250, 92);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`SCORE ${s.score}`, W - 24, 90);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ef';
    const mins = Math.floor(s.time / 60);
    const secs = Math.floor(s.time % 60);
    ctx.fillText(`RINGS ${s.ringsDone}/${10}   ${mins}:${String(secs).padStart(2, '0')}`, W - 24, 116);
    const fuelW = 210;
    ctx.fillStyle = '#22262c';
    ctx.fillRect(W - 24 - fuelW, 126, fuelW, 10);
    ctx.fillStyle = s.fuel < 25 ? '#ff5a4d' : COLORS.hudAmber;
    ctx.fillRect(W - 24 - fuelW, 126, fuelW * (s.fuel / 100), 10);
    ctx.fillStyle = '#cfe3ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('FUEL', W - 24 - fuelW - 8, 135);
    // Instrument panel along the bottom.
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, H - 108, W, 108);
    ctx.fillStyle = 'rgba(255, 179, 71, 0.25)';
    ctx.fillRect(0, H - 108, W, 2);
    artificialHorizon(92, H - 54, 36, s);
    dial(218, H - 54, 36, 'ALT', s.y, 600, `${Math.round(s.y * 3.281)}`);
    dial(330, H - 54, 36, 'SPEED', s.speed, 100, `${Math.round(s.speed * 1.944)}`);
    // Throttle lever.
    ctx.fillStyle = '#cfe3ef';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', 430, H - 16);
    ctx.fillStyle = '#22262c';
    ctx.fillRect(422, H - 96, 16, 72);
    ctx.fillStyle = COLORS.hudAmber;
    const thH = 72 * s.throttle;
    ctx.fillRect(422, H - 24 - thH, 16, thH);
    // Next-ring readout and low-fuel warning.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 16px system-ui, sans-serif';
    const ring = world.rings[s.nextRing];
    if (ring) {
      const dist = Math.hypot(ring.x - s.x, ring.y - s.y, ring.z - s.z);
      ctx.fillText(`NEXT RING ${s.nextRing + 1} — ${Math.round(dist)} m`, 480, H - 62);
      ctx.fillStyle = '#cfe3ef';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(s.ringsDone >= 10 ? 'All rings done — land on the runway!' : 'Fly through the golden hoop', 480, H - 38);
    } else {
      ctx.fillText('All rings done — land on the runway!', 480, H - 62);
    }
    if (s.fuel < 25 && !s.finished) {
      ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff5a4d' : '#ffb347';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('LOW FUEL — grab a ring!', 480, H - 88);
    }
    // Centre message.
    if (s.message && s.time < s.messageUntil) {
      ctx.font = 'bold 22px system-ui, sans-serif';
      const msgW = ctx.measureText(s.message).width + 36;
      ctx.fillStyle = 'rgba(10, 14, 20, 0.6)';
      ctx.beginPath();
      ctx.roundRect(cx - msgW / 2 - 120, 210, msgW + 240, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffe9b0';
      ctx.textAlign = 'center';
      ctx.fillText(s.message, cx, 238);
    }
  }

  function button(label, x, y, w, h, primary) {
    ctx.fillStyle = primary ? '#ffb347' : 'rgba(16, 21, 29, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = primary ? '#ffe9b0' : '#cfe3ef';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = primary ? '#241a05' : '#ffe9b0';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 7);
    return { x, y, w, h, label };
  }

  function titleScreen(world, best) {
    ctx.fillStyle = 'rgba(10, 16, 26, 0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3cf';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('GOLDEN HOUR', cx, 190);
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('— ISLAND RUN —', cx, 238);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Fly the Kancil-1 through 10 golden rings, then land on the island runway.', cx, 292);
    ctx.fillText('Arrows steer · W/S throttle · Shift boost · Space brake · P pause · M mute', cx, 324);
    if (best > 0) {
      ctx.fillStyle = COLORS.hudAmber;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`Best score: ${best}`, cx, 356);
    }
    return { start: button('TAKE OFF', cx - 110, 400, 220, 56, true) };
  }

  function endScreen(world, state, best, complete) {
    ctx.fillStyle = 'rgba(10, 16, 26, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = complete ? '#7dff8a' : '#ff8a7d';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(complete ? 'MISSION COMPLETE' : 'CRASHED', cx, 210);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = '22px system-ui, sans-serif';
    if (complete) {
      ctx.fillText(`All 10 rings and a runway landing — the archipelago is yours.`, cx, 262);
    } else {
      ctx.fillText(state.crashReason || 'The Kancil-1 is down.', cx, 262);
    }
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`Score ${state.score}   ·   Rings ${state.ringsDone}/10   ·   Time ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, cx, 316);
    if (state.score >= best && state.score > 0) {
      ctx.fillStyle = COLORS.hudAmber;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('New best score!', cx, 350);
    }
    return { restart: button('FLY AGAIN', cx - 110, 400, 220, 56, true) };
  }

  /** Draw one frame. `screen` picks the overlay; `ui` carries best score etc. */
  function draw(world, screen, ui, t) {
    const state = world.state;
    const cam = camera(state);
    ctx.clearRect(0, 0, W, H);
    const { horizonY, sunScreen } = sky(cam, t);
    clouds(cam, world, t);
    sea(cam, horizonY, sunScreen, t);
    const nearIslands = [...world.islands].sort((a, b) => {
      const da = (a.x - state.x) ** 2 + (a.z - state.z) ** 2;
      const db = (b.x - state.x) ** 2 + (b.z - state.z) ** 2;
      return db - da;
    });
    for (const isle of nearIslands) island(cam, isle, state);
    runway(cam, state);
    rings(cam, world, state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      planeSprite(state, t);
      nextRingArrow(cam, world, state);
    }
    // Warm golden-hour grade over everything.
    ctx.fillStyle = 'rgba(255, 170, 80, 0.05)';
    ctx.fillRect(0, 0, W, H);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) hud(world, state, t);
    if (screen === SCREEN_TITLE) return titleScreen(world, ui.best);
    if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      return endScreen(world, state, ui.best, screen === SCREEN_COMPLETE);
    }
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10, 16, 26, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff3cf';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', cx, 300);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText('Press P to keep flying', cx, 340);
    }
    return {};
  }

  return { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_COMPLETE };
}

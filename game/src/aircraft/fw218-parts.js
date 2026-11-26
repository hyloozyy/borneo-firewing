// Shaped parts for the FW-218 model: turned (lathe) bodies for nacelles, spinners, floats and
// fairings; twisted, tapered propeller blades; an airfoil strut; tapered rudder and fillets.
// All built along the aircraft's axes: nose toward -Z, right +X, up +Y.
import * as THREE from 'three';

// Turned body along Z from a profile of [z, radius] pairs (front to back), optional
// vertical/horizontal scale for oval sections, optional arc (phiStart, phiLength around Z;
// phi 0 points down, PI points up).
export function latheZ(profile, { segments = 24, sx = 1, sy = 1, phiStart = 0, phiLength = Math.PI * 2 } = {}) {
  const pts = profile.map(([z, r]) => new THREE.Vector2(Math.max(0.0001, r), z));
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  // Lathe axis is Y: turn it onto Z (profile z grows toward the tail).
  g.rotateX(Math.PI / 2);
  g.scale(sx, sy, 1);
  g.computeVertexNormals();
  return g;
}

// Smooth profile helper: samples f(t) for t in 0..1 over [z0, z1].
export function profileOf(z0, z1, n, f) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [z0 + (z1 - z0) * t, f(t)];
  });
}

// A propeller blade along +Y from the hub: rounded tip, wide mid-chord, washout twist.
export function bladeGeometry(rootR, tipR, { chord = 0.34, thick = 0.05, twistRoot = 0.75, twistTip = 0.18, from = 0, to = 1 } = {}) {
  const shape = new THREE.Shape();
  const n = 14;
  const span = tipR - rootR;
  const c = (t) => chord * (0.62 + 0.55 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) - 0.42 * Math.pow(t, 3)) * (t > 0.93 ? Math.sqrt(Math.max(0.02, (1 - t) / 0.07)) : 1);
  const t0 = from, t1 = to;
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * (i / n); pts.push([-c(t) * 0.35, rootR + span * t]); }
  for (let i = n; i >= 0; i--) { const t = t0 + (t1 - t0) * (i / n); pts.push([c(t) * 0.65, rootR + span * t]); }
  shape.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) shape.lineTo(x, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.35, bevelSize: thick * 0.3, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -thick / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
    const t = Math.min(1, Math.max(0, (y - rootR) / span));
    const a = twistRoot + (twistTip - twistRoot) * t;
    p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
  }
  g.computeVertexNormals();
  return g;
}

// Symmetric airfoil outline (chord along -Z from the leading edge at 0) extruded along +Y.
export function strutGeometry(chord, thick, height, taper = 0.8) {
  const s = new THREE.Shape();
  const n = 10;
  const half = (x) => 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4) * chord;
  for (let i = 0; i <= n; i++) { const x = i / n; (i ? s.lineTo.bind(s) : s.moveTo.bind(s))(half(x), -x * chord); }
  for (let i = n; i >= 0; i--) { const x = i / n; s.lineTo(-half(x), -x * chord); }
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 2 });
  // shape (x, y) = (thickness, chord) -> (X, Z); extrusion -> +Y.
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 - (1 - taper) * (p.getY(i) / height);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

// Flat outline in the YZ plane (points [z, y]) extruded across X with rounded edges.
export function plateYZ(points, thick, bevel = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const [z, y] of points.slice(1)) s.lineTo(z, y);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2 });
  // shape x -> Z, shape y -> Y, extrusion -> X (centred).
  g.rotateY(-Math.PI / 2);
  g.translate(thick / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

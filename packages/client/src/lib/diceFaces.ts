import {
  BoxGeometry,
  BufferGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  OctahedronGeometry,
  TetrahedronGeometry,
  Vector3,
} from "three";

/** A flat face of a solid: where it is, which way it points, and its position in the solid (0-based). */
export interface DiceFace {
  center: Vector3;
  normal: Vector3;
  index: number;
}

/**
 * A d10 is a pentagonal trapezohedron: two apexes and a zigzag ring of ten points, giving ten kite faces. The kites are
 * flat only when the apex height is `ring * (1 + cos 36°) / (1 - cos 36°)`.
 */
function trapezohedron(): BufferGeometry {
  const cos36 = Math.cos(Math.PI / 5);
  const ring = 0.1;
  const apex = (ring * (1 + cos36)) / (1 - cos36);
  const ringPoint = (j: number) => {
    const angle = (j * Math.PI) / 5;
    return new Vector3(Math.cos(angle), j % 2 === 0 ? ring : -ring, Math.sin(angle));
  };
  const top = new Vector3(0, apex, 0);
  const bottom = new Vector3(0, -apex, 0);
  const points: number[] = [];
  const triangle = (a: Vector3, b: Vector3, c: Vector3) => {
    // Wind every triangle outward so the faces light up from outside.
    const outward = new Vector3().subVectors(c, b).cross(new Vector3().subVectors(a, b));
    const [p, q, r] = outward.dot(a.clone().add(b).add(c)) > 0 ? [a, b, c] : [a, c, b];
    points.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  };
  for (let j = 0; j < 10; j++) {
    // Kites around the top apex are centred on the lower ring points (odd j), the others on the upper ones.
    const cap = j % 2 === 1 ? top : bottom;
    const before = ringPoint((j + 9) % 10);
    const middle = ringPoint(j);
    const after = ringPoint((j + 1) % 10);
    triangle(cap, before, middle);
    triangle(cap, middle, after);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The solid for a die with `sides` faces, sized to fit a sphere of radius about 1. */
export function diceGeometry(sides: number): BufferGeometry {
  switch (sides) {
    case 4:
      return new TetrahedronGeometry(1.1);
    case 6:
      return new BoxGeometry(1.3, 1.3, 1.3).toNonIndexed();
    case 8:
      return new OctahedronGeometry(1);
    case 10:
      return trapezohedron();
    case 12:
      return new DodecahedronGeometry(1);
    case 20:
      return new IcosahedronGeometry(1);
    default:
      throw new Error(`No solid for a d${sides}`);
  }
}

/**
 * Groups the triangles of a non-indexed solid into its real faces (a dodecahedron face is three triangles). Which
 * number a face carries is up to the caller: only the face the server rolled has to end up facing the camera.
 */
export function diceFaces(geometry: BufferGeometry): DiceFace[] {
  const position = geometry.getAttribute("position");
  const groups: { sum: Vector3; normal: Vector3; points: number }[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    const normal = new Vector3().subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize();
    // Triangles of one face are coplanar; compare directions instead of rounding, which can split a face at a boundary.
    let group = groups.find((g) => g.normal.dot(normal) > 0.999);
    if (!group) {
      group = { sum: new Vector3(), normal, points: 0 };
      groups.push(group);
    }
    group.sum.add(a).add(b).add(c);
    group.points += 3;
  }
  return groups.map((group, index) => ({ center: group.sum.clone().divideScalar(group.points), normal: group.normal, index }));
}

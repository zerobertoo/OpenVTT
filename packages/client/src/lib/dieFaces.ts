import {
  BoxGeometry,
  type BufferGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  TetrahedronGeometry,
  Vector3,
} from "three";

/** A flat face of a solid: where it is, which way it points, and the number it carries. */
export interface DieFace {
  center: Vector3;
  normal: Vector3;
  value: number;
}

/** The solid for a die with `sides` faces, sized to fit a sphere of radius about 1. */
export function dieGeometry(sides: number): BufferGeometry {
  switch (sides) {
    case 4:
      return new TetrahedronGeometry(1.1);
    case 6:
      return new BoxGeometry(1.3, 1.3, 1.3).toNonIndexed();
    case 8:
      return new OctahedronGeometry(1);
    case 12:
      return new DodecahedronGeometry(1);
    case 20:
      return new IcosahedronGeometry(1);
    default:
      throw new Error(`No solid for a d${sides}`);
  }
}

/**
 * Groups the triangles of a non-indexed solid into its real faces (a dodecahedron face is three triangles) and
 * numbers them 1..n. Opposite faces of a d6 do not sum to 7; only the number the server rolled matters.
 */
export function dieFaces(geometry: BufferGeometry): DieFace[] {
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
  return groups.map((group, index) => ({
    center: group.sum.clone().divideScalar(group.points),
    normal: group.normal,
    value: index + 1,
  }));
}

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import type { ThrownDie } from "../../lib/dice3dSupport";
import { dieFaces, dieGeometry } from "../../lib/dieFaces";

/** How long the dice tumble before they rest on the server's numbers. */
export const THROW_MS = 1300;

const SPACING = 2.4;
const HEIGHT_PX = 150;
const Z = new Vector3(0, 0, 1);

/** Draws a number on a transparent square, dark on the lighter die so it stays readable. */
function numberTexture(value: number, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = color;
    context.font = "700 80px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(value), 64, 70);
    // A dot after 6 and 9 tells them apart when the die rests at an angle.
    if (value === 6 || value === 9) context.fillText(".", 104, 70);
  }
  return new CanvasTexture(canvas);
}

interface Props {
  dice: ThrownDie[];
  /** Called when WebGL is not available, so the caller can show the flat dice instead. */
  onUnavailable: () => void;
}

/**
 * Throws the dice in a transparent WebGL canvas. The server already decided the numbers; each die tumbles about a
 * random axis, slowing down until the face with its number points at the camera, upright. Loaded on demand so the
 * 3D library only downloads for people who see a roll.
 */
export default function Dice3D({ dice, onUnavailable }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const width = Math.max(140, Math.min(dice.length * 64 + 40, 480));
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      onUnavailable();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, HEIGHT_PX);
    element.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(30, width / HEIGHT_PX, 0.1, 100);
    const rowWidth = (dice.length - 1) * SPACING + 2.4;
    // Far enough that the whole row fits horizontally and a die fits vertically.
    camera.position.z = Math.max(rowWidth / (2 * Math.tan((15 * Math.PI) / 180) * (width / HEIGHT_PX)), 6.5);
    scene.add(new AmbientLight(0xffffff, 1.6));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(2, 4, 6);
    scene.add(sun);

    const disposables: { dispose: () => void }[] = [];
    const throwing = dice.map((die, index) => {
      const geometry = dieGeometry(die.sides);
      const faces = dieFaces(geometry);
      // A dropped die (advantage/disadvantage) rests dim, so the kept one stands out.
      const body = new MeshStandardMaterial({ color: die.kept ? 0xf2b84b : 0x8a8f99, roughness: 0.45, flatShading: true });
      const group = new Group();
      group.add(new Mesh(geometry, body));
      disposables.push(geometry, body);

      const labelGeometry = new PlaneGeometry(0.62, 0.62);
      disposables.push(labelGeometry);
      let restingFace = faces[0]!;
      for (const face of faces) {
        const texture = numberTexture(face.value, "#1b1d22");
        const material = new MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 });
        disposables.push(texture, material);
        const label = new Mesh(labelGeometry, material);
        label.position.copy(face.center).addScaledVector(face.normal, 0.01);
        label.quaternion.setFromUnitVectors(Z, face.normal);
        group.add(label);
        if (face.value === ((die.value - 1) % faces.length) + 1) restingFace = face;
      }

      // Final pose: the rolled face toward the camera, with its number turned upright.
      const align = new Quaternion().setFromUnitVectors(restingFace.normal, Z);
      const labelUp = new Vector3(0, 1, 0)
        .applyQuaternion(new Quaternion().setFromUnitVectors(Z, restingFace.normal))
        .applyQuaternion(align);
      const spin = new Quaternion().setFromAxisAngle(Z, Math.PI / 2 - Math.atan2(labelUp.y, labelUp.x));
      const rest = spin.multiply(align);

      group.position.x = (index - (dice.length - 1) / 2) * SPACING;
      scene.add(group);
      const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      return { group, rest, axis, turns: 3 + Math.random() * 2, delay: index * 90 };
    });

    const turn = new Quaternion();
    const pose = (elapsed: number) => {
      for (const die of throwing) {
        const progress = Math.min(1, Math.max(0, (elapsed - die.delay) / THROW_MS));
        const slow = (1 - progress) ** 2;
        turn.setFromAxisAngle(die.axis, slow * die.turns * Math.PI * 2);
        die.group.quaternion.copy(turn).multiply(die.rest);
        // A hop that dies out as the die settles.
        die.group.position.y = Math.abs(Math.sin(progress * Math.PI * 3)) * (1 - progress) * 1.2;
        die.group.scale.setScalar(0.5 + 0.5 * Math.min(1, progress * 4));
      }
      renderer.render(scene, camera);
    };

    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      pose(elapsed);
      if (elapsed < THROW_MS + dice.length * 90) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dice, onUnavailable]);

  return <div ref={host} aria-hidden="true" className="flex justify-center" />;
}

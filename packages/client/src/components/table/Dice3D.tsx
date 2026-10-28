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
import { faceLabel, type ThrownDie } from "../../lib/dice3dSupport";
import { diceFaces, diceGeometry } from "../../lib/diceFaces";
import { type Launch, planThrow, STEP_SECONDS } from "../../lib/diceThrow";

/** Time between one die leaving the hand and the next, so a handful does not move as one block. */
const STAGGER_MS = 60;
const FOV = 30;
const Z = new Vector3(0, 0, 1);
/** The solids are about 1 unit across; this is their radius in those units. */
const SOLID_RADIUS = 1.1;

/** Draws a label on a transparent square, dark on the lighter die so it stays readable. */
function labelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#1b1d22";
    context.font = `700 ${text.length > 1 ? 62 : 80}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 64, 70);
    // A dot after 6 and 9 tells them apart when the die rests at an angle.
    if (text === "6" || text === "9") context.fillText(".", 104, 70);
  }
  return new CanvasTexture(canvas);
}

interface Props {
  dice: ThrownDie[];
  /** How the dice were thrown, or a launch from the side for a roll somebody else made. */
  launch: Launch;
  /** Called when WebGL is not available, so the caller can show the flat dice instead. */
  onUnavailable: () => void;
}

/**
 * Throws the dice across the whole screen in a transparent WebGL canvas that lets pointer events through. The server
 * already decided the numbers: the path is planned ahead (`planThrow`), each die tumbles slower and slower, and it
 * stops with the face it rolled toward the camera, upright. Loaded on demand so the 3D library only downloads for
 * people who see a roll.
 */
export default function Dice3D({ dice, launch, onUnavailable }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      onUnavailable();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    element.appendChild(renderer.domElement);

    // Camera placed so that the z = 0 plane is one world unit per screen pixel; dice positions are then plain pixels.
    const camera = new PerspectiveCamera(FOV, width / height, 1, 5000);
    camera.position.z = height / 2 / Math.tan((FOV / 2) * (Math.PI / 180));
    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 1.6));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-width / 3, height / 2, 700);
    scene.add(sun);

    const radius = Math.min(40, Math.max(22, Math.min(width, height) / 16));
    const scale = radius / SOLID_RADIUS;
    const frames = planThrow(dice.length, launch, { width, height }, radius);

    const disposables: { dispose: () => void }[] = [];
    const labelGeometry = new PlaneGeometry(0.62, 0.62);
    disposables.push(labelGeometry);
    const textures = new Map<string, CanvasTexture>();
    const labelMaterial = (text: string) => {
      let texture = textures.get(text);
      if (!texture) {
        texture = labelTexture(text);
        textures.set(text, texture);
        disposables.push(texture);
      }
      const material = new MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 });
      disposables.push(material);
      return material;
    };

    const throwing = dice.map((die, index) => {
      const geometry = diceGeometry(die.shape);
      const faces = diceFaces(geometry);
      // A dropped die (advantage/disadvantage) rests dim, so the kept one stands out.
      const color = die.kind === "tens" ? 0xe8924a : die.kept ? 0xf2b84b : 0x8a8f99;
      const body = new MeshStandardMaterial({ color, roughness: 0.45, flatShading: true });
      disposables.push(geometry, body);
      const group = new Group();
      group.add(new Mesh(geometry, body));

      let resting = faces[0]!;
      for (const face of faces) {
        const label = new Mesh(labelGeometry, labelMaterial(faceLabel(die, face.index)));
        label.position.copy(face.center).addScaledVector(face.normal, 0.01);
        label.quaternion.setFromUnitVectors(Z, face.normal);
        group.add(label);
        if (face.index === die.face) resting = face;
      }

      // Final pose: the rolled face toward the camera, with its label turned upright.
      const align = new Quaternion().setFromUnitVectors(resting.normal, Z);
      const labelUp = new Vector3(0, 1, 0).applyQuaternion(new Quaternion().setFromUnitVectors(Z, resting.normal)).applyQuaternion(align);
      const rest = new Quaternion().setFromAxisAngle(Z, Math.PI / 2 - Math.atan2(labelUp.y, labelUp.x)).multiply(align);

      // It rolls the way it travels: the axis is the direction of travel turned a quarter, with a little wobble.
      const first = frames[0]![index]!;
      const later = frames[Math.min(6, frames.length - 1)]![index]!;
      const axis = new Vector3(-(first.y - later.y), -(later.x - first.x), (Math.random() - 0.5) * 20).normalize();
      group.scale.setScalar(scale);
      group.visible = false;
      scene.add(group);
      return { group, rest, axis, turns: 2.5 + Math.random() * 2 };
    });

    const turn = new Quaternion();
    const stepMs = STEP_SECONDS * 1000;
    const draw = (elapsedMs: number) => {
      for (const [index, die] of throwing.entries()) {
        const step = Math.floor((elapsedMs - index * STAGGER_MS) / stepMs);
        die.group.visible = step >= 0;
        if (step < 0) continue;
        const where = frames[Math.min(step, frames.length - 1)]![index]!;
        const progress = Math.min(1, step / (frames.length - 1));
        turn.setFromAxisAngle(die.axis, (1 - progress) ** 2 * die.turns * Math.PI * 2);
        die.group.quaternion.copy(turn).multiply(die.rest);
        // A hop that dies out as the die settles; z points at the camera, so it also swells a little.
        const hop = Math.abs(Math.sin(progress * Math.PI * 3)) * (1 - progress) * radius * 2;
        die.group.position.set(where.x - width / 2, height / 2 - where.y, hop);
      }
      renderer.render(scene, camera);
    };

    const started = performance.now();
    const endMs = (frames.length - 1) * stepMs + dice.length * STAGGER_MS;
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      draw(elapsed);
      if (elapsed < endMs) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dice, launch, onUnavailable]);

  return <div ref={host} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40" />;
}

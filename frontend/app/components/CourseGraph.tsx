"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { CourseInput } from "@/lib/api";

// An Obsidian-graph-style visual: one center node ("Term") with a node for
// every added course, connected by an edge back to the center and held in
// place by a tiny hand-rolled physics sim (mutual repulsion + a spring back
// to center) rather than a full force-graph library, since the node count
// here is always small (the app caps a term at 5 courses). Runs inside a
// react-three-fiber <Canvas> for real WebGL 3D - orbit-draggable via drei's
// OrbitControls (zoom disabled, see the Canvas below - scroll-to-zoom would
// fight the page's own scroll), matching the "3D node graph" brief rather
// than faking depth with CSS transforms.
//
// This is client-only (WebGL/rAF/ResizeObserver don't exist during Next's
// SSR pass) - the caller in LandingPage.tsx must load it via
// `next/dynamic(() => import("./CourseGraph"), { ssr: false })`, never a
// plain import.
//
// Node labels use the same Geist Mono the rest of the site does - drei's
// <Text> (troika-three-text) can't read the CSS custom property/next/font
// setup everything else on the page uses, since it needs an actual font
// FILE it fetches and parses itself, not a CSS font-family. The two .ttf
// weights it needs are vendored into public/fonts/ (copied from the
// `geist` npm package, which isn't a runtime dependency otherwise) rather
// than pointed at a Google Fonts URL, so the graph never depends on an
// external font CDN being reachable.
const GEIST_MONO_REGULAR = "/fonts/GeistMono-Regular.ttf";
const GEIST_MONO_MEDIUM = "/fonts/GeistMono-Medium.ttf";

const CENTER_KEY = "__center__";
const REST_LENGTH = 2.0; // desired edge length once settled
const SPRING_STRENGTH = 3.2;
const REPEL_STRENGTH = 1.05;
const DAMPING = 0.88;
const WOBBLE_AMPLITUDE = 0.05;

// Shown until the visitor adds a real course, so the graph never opens on
// an empty sphere - five common first-year UBC courses (the same handful
// the root README already references as its own canonical examples).
// Rendered dimmed/dashed and orange like a real pick, just fainter (see
// Node/Edge's isPlaceholder handling), so they read as examples rather than
// suggestions, and they're swapped out for real nodes the moment `courses`
// is non-empty.
const PLACEHOLDER_COURSES: CourseInput[] = [
  { subject: "CPSC", course: "110", session: "W" },
  { subject: "MATH", course: "100", session: "W" },
  { subject: "ENGL", course: "110", session: "W" },
  { subject: "CHEM", course: "121", session: "W" },
  { subject: "PSYC", course: "101", session: "W" },
];

interface NodeData {
  key: string;
  label: string;
  isCenter: boolean;
  isPlaceholder: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spawnScale: number;
  wobblePhase: number;
}

type NodeMap = Map<string, NodeData>;

function randomOnUnitSphere(): THREE.Vector3 {
  // Uniform-ish random direction - good enough for a decorative spawn point.
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi)
  );
}

/** Resolves the colors the graph needs from the page's own CSS custom
 * properties (read once on mount) so it follows light/dark theme instead of
 * hardcoding a palette that could drift from the rest of the site. */
function useGraphColors() {
  const [colors, setColors] = useState({
    accent: "#ed462d",
    center: "#f2f2f3",
    line: "#71717a",
    labelMuted: "#d4d4d8",
    labelSubtle: "#6b6b70",
  });

  useEffect(() => {
    const resolve = () => {
      const style = getComputedStyle(document.documentElement);
      const accent = style.getPropertyValue("--chart-accent").trim() || "#ed462d";
      const center = style.getPropertyValue("--foreground").trim() || "#f2f2f3";
      const line = style.getPropertyValue("--text-subtle").trim() || "#71717a";
      // Node labels (drei's <Text>, not DOM) - same tokens as the rest of the
      // site's muted/subtle text, so they flip with light/dark instead of
      // staying hardcoded light-mode-only colors.
      const labelMuted = style.getPropertyValue("--text-muted").trim() || "#d4d4d8";
      const labelSubtle = style.getPropertyValue("--text-subtle").trim() || "#6b6b70";
      setColors({ accent, center, line, labelMuted, labelSubtle });
    };
    // Deferred to an effect (can't read getComputedStyle during SSR/first
    // render) - same convention LandingPage.tsx uses for weights/theme.
    resolve();
    // A plain mount-only effect only ever captured whatever theme was
    // active on load - toggling light/dark afterward (which just flips
    // `data-theme` on <html>) never re-ran it, so every color here (orbit
    // rings included) stayed frozen at the original theme forever. Watch
    // the attribute directly instead of depending on a theme prop, since
    // this hook has no idea which page/toggle is driving it.
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function Node({
  nodeKey,
  label,
  isCenter,
  isPlaceholder,
  nodesRef,
  color,
  labelColor,
}: {
  nodeKey: string;
  label: string;
  isCenter: boolean;
  isPlaceholder: boolean;
  nodesRef: RefObject<NodeMap>;
  color: string;
  labelColor: string;
}) {
  // label/isCenter/isPlaceholder come in as props (not read off nodesRef
  // during render) - Scene already knows all three when it builds the node
  // list, and reading a ref's `.current` during render is the one thing
  // refs aren't for; the simulated position/velocity genuinely can't be
  // props (they mutate every frame), so those stay in the ref and are only
  // ever touched inside useFrame below, same as everywhere else here.
  const groupRef = useRef<THREE.Group>(null);
  // Small dots, not spheres - a bit more emissive punch than a big glowing
  // ball would need, since a tiny dot has less surface area to read as
  // bright against the dark background.
  const radius = isCenter ? 0.07 : 0.075;

  useFrame(() => {
    const n = nodesRef.current.get(nodeKey);
    const group = groupRef.current;
    if (!n || !group) return;
    group.position.copy(n.position);
    group.scale.setScalar(n.spawnScale);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 16, 16]} />
        {/* Unlit/flat, not meshStandardMaterial - a lit PBR material shades
            the far side of a small sphere dark depending on the point
            lights' angle, which read as "half black" rather than solid
            color. A basic material always shows the full flat color from
            every angle, matching the dotted rings' own unlit look. */}
        <meshBasicMaterial color={color} transparent={isPlaceholder} opacity={isPlaceholder ? 0.8 : 1} />
      </mesh>
      <Billboard position={[0, -radius - 0.14, 0]}>
        <Text
          fontSize={isCenter ? 0.15 : 0.12}
          color={labelColor}
          anchorX="center"
          anchorY="top"
          font={isCenter ? GEIST_MONO_MEDIUM : GEIST_MONO_REGULAR}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function Edge({
  nodeKey,
  nodesRef,
  color,
  isPlaceholder,
}: {
  nodeKey: string;
  nodesRef: RefObject<NodeMap>;
  color: string;
  isPlaceholder: boolean;
}) {
  // geometry/material live behind refs, exactly like Node's groupRef - r3f
  // constructs the actual THREE objects from the JSX below, and the only
  // place this component ever touches `.current` is inside useFrame (after
  // mount, never during render), which is what keeps the endpoint-position
  // and fading-opacity mutation below allowed. No ref on the outer `<line>`
  // itself - the JSX intrinsic `line` resolves against DOM SVGLineElement
  // for `ref` typing even though r3f owns its children, so a ref there
  // doesn't type-check; the `lineDistance` attribute a dashed material
  // needs is instead computed by hand each frame below (trivial for a
  // straight 2-point segment) instead of calling THREE.Line's own
  // computeLineDistances(), which would need that ref.
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.LineBasicMaterial | THREE.LineDashedMaterial>(null);

  useFrame(() => {
    const center = nodesRef.current.get(CENTER_KEY);
    const n = nodesRef.current.get(nodeKey);
    const geometry = geometryRef.current;
    const material = materialRef.current;
    if (!center || !n || !geometry || !material) return;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, center.position.x, center.position.y, center.position.z);
    positions.setXYZ(1, n.position.x, n.position.y, n.position.z);
    positions.needsUpdate = true;
    if (isPlaceholder) {
      const lineDistance = geometry.getAttribute("lineDistance") as THREE.BufferAttribute | undefined;
      if (lineDistance) {
        lineDistance.setX(0, 0);
        lineDistance.setX(1, center.position.distanceTo(n.position));
        lineDistance.needsUpdate = true;
      }
    }
    material.opacity = (isPlaceholder ? 0.22 : 0.4) * n.spawnScale;
  });

  return (
    <line>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(6), 3]} />
        {isPlaceholder && <bufferAttribute attach="attributes-lineDistance" args={[new Float32Array(2), 1]} />}
      </bufferGeometry>
      {isPlaceholder ? (
        <lineDashedMaterial ref={materialRef} color={color} transparent opacity={0} dashSize={0.12} gapSize={0.1} />
      ) : (
        <lineBasicMaterial ref={materialRef} color={color} transparent opacity={0} />
      )}
    </line>
  );
}

interface NodeMeta {
  key: string;
  label: string;
  isCenter: boolean;
  isPlaceholder: boolean;
}

function Scene({
  courses,
  colors,
}: {
  courses: CourseInput[];
  colors: { accent: string; center: string; line: string; labelMuted: string; labelSubtle: string };
}) {
  const nodesRef = useRef<NodeMap>(new Map());
  const [nodeMetas, setNodeMetas] = useState<NodeMeta[]>([
    { key: CENTER_KEY, label: "Term", isCenter: true, isPlaceholder: false },
  ]);

  useEffect(() => {
    const map = nodesRef.current;
    if (!map.has(CENTER_KEY)) {
      map.set(CENTER_KEY, {
        key: CENTER_KEY,
        label: "Term",
        isCenter: true,
        isPlaceholder: false,
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(),
        spawnScale: 1,
        wobblePhase: 0,
      });
    }

    // No real courses yet -> show the placeholder set instead of an empty
    // sphere; the moment a real course is added, this switches back and
    // the placeholders are torn down like any other stale node.
    const usingPlaceholders = courses.length === 0;
    const effectiveCourses = usingPlaceholders ? PLACEHOLDER_COURSES : courses;

    const activeKeys = new Set(effectiveCourses.map((c) => `${c.subject}-${c.course}`));
    for (const key of Array.from(map.keys())) {
      if (key !== CENTER_KEY && !activeKeys.has(key)) map.delete(key);
    }
    for (const c of effectiveCourses) {
      const key = `${c.subject}-${c.course}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          label: `${c.subject} ${c.course}`,
          isCenter: false,
          isPlaceholder: usingPlaceholders,
          position: randomOnUnitSphere().multiplyScalar(0.5),
          velocity: new THREE.Vector3(),
          spawnScale: 0,
          wobblePhase: Math.random() * Math.PI * 2,
        });
      } else {
        existing.isPlaceholder = usingPlaceholders;
      }
    }

    setNodeMetas(
      Array.from(map.values()).map((n) => ({
        key: n.key,
        label: n.label,
        isCenter: n.isCenter,
        isPlaceholder: n.isPlaceholder,
      }))
    );
  }, [courses]);

  useFrame((_, rawDelta) => {
    const map = nodesRef.current;
    const list = Array.from(map.values());
    const dt = Math.min(rawDelta, 1 / 30);
    const center = map.get(CENTER_KEY);
    if (!center) return;

    // Mutual repulsion so nodes don't overlap.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const diff = new THREE.Vector3().subVectors(a.position, b.position);
        let dist = diff.length();
        if (dist < 0.0001) {
          diff.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
          dist = 0.0001;
        }
        const force = (REPEL_STRENGTH / (dist * dist)) * dt;
        diff.normalize().multiplyScalar(force);
        if (!a.isCenter) a.velocity.add(diff);
        if (!b.isCenter) b.velocity.sub(diff);
      }
    }

    // Spring each course node back toward the center at REST_LENGTH, plus a
    // gentle per-node sinusoidal wobble so the graph never looks frozen.
    for (const n of list) {
      if (n.isCenter) continue;
      const toCenter = new THREE.Vector3().subVectors(center.position, n.position);
      const dist = toCenter.length();
      const stretch = dist - REST_LENGTH;
      toCenter.normalize().multiplyScalar(stretch * SPRING_STRENGTH * dt);
      n.velocity.add(toCenter);

      n.wobblePhase += dt * 0.8;
      n.velocity.x += Math.cos(n.wobblePhase) * WOBBLE_AMPLITUDE * dt;
      n.velocity.y += Math.sin(n.wobblePhase * 1.3) * WOBBLE_AMPLITUDE * dt;

      n.velocity.multiplyScalar(DAMPING);
      n.position.addScaledVector(n.velocity, dt * 6);
      n.spawnScale = THREE.MathUtils.lerp(n.spawnScale, 1, dt * 4);
    }
  });

  return (
    <>
      {nodeMetas.map(({ key, label, isCenter, isPlaceholder }) => (
        <Node
          key={key}
          nodeKey={key}
          label={label}
          isCenter={isCenter}
          isPlaceholder={isPlaceholder}
          nodesRef={nodesRef}
          color={isCenter ? colors.center : colors.accent}
          labelColor={isCenter ? colors.center : isPlaceholder ? colors.labelSubtle : colors.labelMuted}
        />
      ))}
      {nodeMetas
        .filter(({ isCenter }) => !isCenter)
        .map(({ key, isPlaceholder }) => (
          <Edge key={key} nodeKey={key} nodesRef={nodesRef} color={colors.line} isPlaceholder={isPlaceholder} />
        ))}
    </>
  );
}

function ringPositions(radius: number, count: number, jitter: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * jitter;
    const r = radius + (Math.random() - 0.5) * jitter * 0.3;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  return positions;
}

/** A single dotted ring - a static point ring tilted on two axes (an
 * armillary-sphere/globe orbital plane rather than a flat flat disc), spun
 * slowly around its own axis. The spin lives on an inner group with no JSX
 * `rotation` prop of its own (only ever set imperatively in useFrame via
 * spinRef), so a React re-render of this component can never reset the
 * accumulated spin the way reapplying a JSX `rotation` prop on the same
 * object would. */
function OrbitRing({
  radius,
  count,
  tiltX,
  tiltZ,
  speed,
  opacity,
  size,
  color,
}: {
  radius: number;
  count: number;
  tiltX: number;
  tiltZ: number;
  speed: number;
  opacity: number;
  size: number;
  color: string;
}) {
  const spinRef = useRef<THREE.Group>(null);
  const [positions] = useState(() => ringPositions(radius, count, 0.18));

  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += speed * delta;
  });

  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <group ref={spinRef}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={opacity} depthWrite={false} />
        </points>
      </group>
    </group>
  );
}

/** The "it doesn't look empty" decoration: several dotted orbital rings at
 * different radii and crossing tilts around the node cluster - an
 * armillary-sphere/solar-system look rather than flat concentric circles -
 * each spinning its own direction/speed for parallax. Purely ambient
 * texture in the same white/foreground color as the center node (real
 * course nodes are the only orange thing in the scene, so that color stays
 * a clear "this is a pick" signal) - no labels/interaction, so it reads as
 * atmosphere around the graph rather than content competing with the
 * course nodes. */
function OrbitRings({ color }: { color: string }) {
  return (
    <>
      <OrbitRing radius={1.0} count={28} tiltX={-0.25} tiltZ={0.1} speed={0.07} opacity={0.55} size={0.05} color={color} />
      <OrbitRing radius={1.4} count={40} tiltX={-0.55} tiltZ={0.65} speed={-0.05} opacity={0.5} size={0.045} color={color} />
      <OrbitRing radius={1.8} count={52} tiltX={0.15} tiltZ={-0.5} speed={0.04} opacity={0.55} size={0.045} color={color} />
      <OrbitRing radius={2.2} count={64} tiltX={-0.85} tiltZ={-0.15} speed={-0.03} opacity={0.45} size={0.04} color={color} />
      <OrbitRing radius={2.6} count={76} tiltX={0.35} tiltZ={0.95} speed={0.025} opacity={0.4} size={0.038} color={color} />
    </>
  );
}

export default function CourseGraph({ courses }: { courses: CourseInput[] }) {
  const colors = useGraphColors();
  // Bumped to force a full remount (fresh canvas, fresh WebGL context) if
  // the context is ever lost - see onCreated below. Scene state is cheap to
  // rebuild from `courses`, so a clean remount is simpler and more robust
  // than trying to resurrect resources in the same lost context.
  const [canvasKey, setCanvasKey] = useState(0);

  return (
    <Canvas
      key={canvasKey}
      camera={{ position: [0, 0.7, 8.5], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      onCreated={({ gl, camera }) => {
        const canvas = gl.domElement;

        // React StrictMode's dev-only double mount/unmount can occasionally
        // wedge the WebGL context on Windows/ANGLE (rapid create-then-
        // destroy on the same canvas element) - this recovers instead of
        // leaving a permanently blank canvas. preventDefault() is the
        // standard signal that something will handle recovery, even though
        // our recovery strategy is "remount" rather than in-place restore.
        // The setCanvasKey call is pushed to a macrotask (setTimeout 0)
        // rather than called synchronously in the event handler - context
        // loss here tends to fire while React/StrictMode's own double-
        // invoke pass for THIS mount is still in flight, and remounting
        // synchronously in the middle of that raced with it (occasionally
        // landing on a canvas with a valid context but an empty scene).
        // Deferring lets that in-flight pass finish first.
        const onLost = (event: Event) => {
          event.preventDefault();
          setTimeout(() => setCanvasKey((k) => k + 1), 0);
        };
        canvas.addEventListener("webglcontextlost", onLost, { once: true });

        // The same StrictMode churn can also make r3f's own container-size
        // ResizeObserver never fire its first measurement, leaving the
        // canvas at the bare HTML default (300x150) even though its
        // container is sized correctly - canvas.style.width/height stay
        // empty strings in that case. Force one manual resize against the
        // container's real, current rect as a fallback, once synchronously
        // and once more a frame later in case layout hadn't settled yet.
        const fixSizeIfStuck = () => {
          const container = canvas.parentElement;
          if (!container || canvas.style.width !== "") return;
          const rect = container.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) return;
          gl.setSize(rect.width, rect.height);
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = rect.width / rect.height;
            camera.updateProjectionMatrix();
          }
        };
        fixSizeIfStuck();
        requestAnimationFrame(fixSizeIfStuck);
      }}
    >
      {/* No lights - every material in this scene is unlit (meshBasicMaterial
          on the node dots, pointsMaterial on the rings, drei's Text is
          unlit by default too), specifically so nothing here shades dark
          depending on light angle. */}
      <OrbitRings color={colors.center} />
      <Scene courses={courses} colors={colors} />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.4} />
    </Canvas>
  );
}

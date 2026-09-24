"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export interface MeshBackgroundHandle {
  /** Spawns a short-lived burst of particles at a point in this component's
   * own local (untransformed CSS-pixel) coordinate space. */
  burst(x: number, y: number): void;
}

interface Point {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  phase: number;
  accent: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const AREA_PER_POINT = 5500;
const MIN_POINTS = 40;
const MAX_POINTS = 260;
const LINK_DISTANCE = 150;
const MOUSE_RADIUS = 150;
const DRIFT_RADIUS = 12;
const ACCENT_POINT_RATIO = 0.2;

function hexToRgb(hex: string): string {
  const parsed = hex.trim().replace("#", "");
  const full = parsed.length === 3 ? parsed.split("").map((c) => c + c).join("") : parsed;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return "255 255 255";
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/** Animated dot/line network background, purely decorative (aria-hidden),
 * meant to sit behind hero content via `absolute inset-0 -z-10
 * pointer-events-none`. Reacts subtly to the mouse and exposes an imperative
 * `burst(x, y)` so a parent can spawn a short particle burst (e.g. when a
 * course is added) without going through React state/re-renders - all
 * per-frame state lives in refs read by the animation loop's own closure. */
export default function MeshBackground({
  ref,
  className,
}: {
  ref?: Ref<MeshBackgroundHandle>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const rectRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const dprRef = useRef(1);
  const reducedMotionRef = useRef(false);
  const colorsRef = useRef({ line: "39 39 42", dot: "163 163 163", burst: "237 70 45" });

  useImperativeHandle(
    ref,
    () => ({
      burst(x: number, y: number) {
        if (reducedMotionRef.current) return;
        const count = 14 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.6 + Math.random() * 2.2;
          particlesRef.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: 40 + Math.random() * 15,
          });
        }
      },
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    const onMotionChange = () => {
      reducedMotionRef.current = media.matches;
    };
    media.addEventListener("change", onMotionChange);

    // Arrow-function consts (not hoisted `function` declarations) so
    // TypeScript retains the `canvas`/`ctx` non-null narrowing from above
    // inside these closures.
    const seedPoints = (width: number, height: number) => {
      const count = Math.min(
        MAX_POINTS,
        Math.max(MIN_POINTS, Math.round((width * height) / AREA_PER_POINT))
      );
      const points: Point[] = [];
      for (let i = 0; i < count; i++) {
        const baseX = Math.random() * width;
        const baseY = Math.random() * height;
        points.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          phase: Math.random() * Math.PI * 2,
          accent: Math.random() < ACCENT_POINT_RATIO,
        });
      }
      pointsRef.current = points;
    };

    const resolveColors = () => {
      const style = getComputedStyle(canvas);
      colorsRef.current = {
        line: hexToRgb(style.getPropertyValue("--border-strong") || "#3f3f46"),
        // Follows the theme's own foreground - white in dark mode, black in
        // light mode - rather than a hardcoded color that only works on one.
        dot: hexToRgb(style.getPropertyValue("--foreground") || "#f2f2f3"),
        burst: hexToRgb(style.getPropertyValue("--chart-accent") || "#ed462d"),
      };
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? canvas.clientWidth;
      const height = parent?.clientHeight ?? canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rect = canvas.getBoundingClientRect();
      rectRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      seedPoints(width, height);
    };

    resolveColors();
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    const onPointerMove = (e: PointerEvent) => {
      const r = rectRef.current;
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      mouseRef.current = { x, y, active: inside };
    };
    const onPointerLeave = () => {
      mouseRef.current.active = false;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);

    let frame = 0;
    let rafId: number;

    const draw = () => {
      frame++;
      const width = rectRef.current.width;
      const height = rectRef.current.height;
      ctx.clearRect(0, 0, width, height);

      if (frame % 30 === 0) resolveColors();

      const reduced = reducedMotionRef.current;
      const mouse = mouseRef.current;
      const points = pointsRef.current;

      for (const p of points) {
        if (!reduced) {
          p.phase += 0.01;
          p.x = p.baseX + Math.cos(p.phase) * DRIFT_RADIUS * 0.4;
          p.y = p.baseY + Math.sin(p.phase * 0.8) * DRIFT_RADIUS * 0.4;

          if (mouse.active) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < MOUSE_RADIUS && dist > 0.01) {
              const force = (1 - dist / MOUSE_RADIUS) * 8;
              p.x += (dx / dist) * force;
              p.y += (dy / dist) * force;
            }
          }
        }
      }

      // Connecting lines.
      const { line } = colorsRef.current;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            const alpha = (1 - dist / LINK_DISTANCE) * 0.35;
            ctx.strokeStyle = `rgb(${line} / ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Points - most are white, a handful are the accent orange (seeded once
      // per point in seedPoints, not re-rolled every frame).
      const { dot, burst } = colorsRef.current;
      for (const p of points) {
        let alpha = 0.75;
        let radius = 1.5;
        if (!reduced && mouse.active) {
          const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
          if (dist < MOUSE_RADIUS) {
            const t = 1 - dist / MOUSE_RADIUS;
            alpha = 0.6 + t * 0.4;
            radius = 1.5 + t * 1.5;
          }
        }
        const accentRadius = p.accent ? radius * 1.8 : radius;
        ctx.fillStyle = `rgb(${p.accent ? burst : dot} / ${p.accent ? 1 : alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, accentRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Burst particles.
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.94;
        particle.vy *= 0.94;
        particle.life -= 1 / particle.maxLife;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = Math.max(0, particle.life);
        const radius = 1 + 2 * particle.life;
        ctx.fillStyle = `rgb(${burst} / ${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      media.removeEventListener("change", onMotionChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

import React, { useEffect, useRef } from 'react';

interface StarfieldCanvasProps {
  speedMultiplier?: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  twinklePhase: number;
  twinkleSpeed: number;
  hue: string;
}

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({
  speedMultiplier = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const STAR_COUNT = 135;
    const hues = ['#e2e8f0', '#bae6fd', '#fef3c7', '#7dd3fc'];
    const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: 0.25 + Math.random() * 1.15,
      r: 0.6 + Math.random() * 1.3,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.015 + Math.random() * 0.03,
      hue: hues[i % hues.length],
    }));

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    let rafId = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const mult = reducedMotion ? 0 : speedRef.current;
      const warping = mult > 2;

      for (const s of stars) {
        if (!reducedMotion) {
          s.twinklePhase += s.twinkleSpeed;
          s.x -= 0.14 * s.z * mult;
          if (s.x < -12) {
            s.x = width + 8;
            s.y = Math.random() * height;
          }
        }

        const alpha = reducedMotion
          ? 0.65
          : 0.35 + 0.55 * ((Math.sin(s.twinklePhase) + 1) * 0.5);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.hue;

        if (warping) {
          const streakLen = Math.min(26, 4 + s.z * mult * 1.9);
          ctx.strokeStyle = s.hue;
          ctx.lineWidth = Math.max(1, s.r);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + streakLen, s.y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield-canvas" aria-hidden="true" />;
};

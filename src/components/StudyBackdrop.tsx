import React, { useEffect, useRef, useState } from 'react';

interface StudyBackdropProps {
  variant: 'welcome' | 'workspace';
  theme: 'dark' | 'light';
  rainVisualEnabled?: boolean;
}

export const STUDY_ROOM_IMAGE_URL = '/src/assets/images/cozy_japanese_study_1795466420160.jpg';

export const StudyBackdrop: React.FC<StudyBackdropProps> = ({
  variant,
  theme,
  rainVisualEnabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!rainVisualEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let animId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const dropCount = variant === 'welcome' ? 90 : 55;
    const drops = Array.from({ length: dropCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      len: 14 + Math.random() * 22,
      speed: 6 + Math.random() * 6,
      alpha: 0.12 + Math.random() * 0.24,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';

      for (const d of drops) {
        ctx.strokeStyle =
          theme === 'dark' || variant === 'welcome'
            ? `rgba(186, 214, 255, ${d.alpha})`
            : `rgba(71, 85, 105, ${d.alpha * 0.65})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2.4, d.y + d.len);
        ctx.stroke();

        d.x -= 0.7;
        d.y += d.speed;
        if (d.y > canvas.height + 24 || d.x < -20) {
          d.y = -24;
          d.x = Math.random() * (canvas.width + 60);
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [rainVisualEnabled, variant, theme]);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      {!imgFailed ? (
        <img
          src={STUDY_ROOM_IMAGE_URL}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center animate-study-drift"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#12122A] via-[#1B1836] to-[#17172F]" />
      )}

      {/* Atmospheric Contrast Scrim */}
      {variant === 'welcome' ? (
        <div
          className={
            theme === 'dark'
              ? 'absolute inset-0 bg-[#0A0B1B]/38'
              : 'absolute inset-0 bg-[#0D0F24]/30'
          }
        />
      ) : (
        <div
          className={
            theme === 'dark'
              ? 'absolute inset-0 bg-[#0C0D20]/46 backdrop-blur-[1px]'
              : 'absolute inset-0 bg-slate-100/50 backdrop-blur-[1px]'
          }
        />
      )}

      {rainVisualEnabled && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full opacity-80"
        />
      )}
    </div>
  );
};

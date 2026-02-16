"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: string;
  top: string;
  tx: string;
  ty: string;
  delay: string;
  duration: string;
  color: string;
  size: string;
}

export function Fireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ["#fbbf24", "#fde68a", "#ef4444", "#f97316", "#ffffff"];
    const generated: Particle[] = [];

    for (let burst = 0; burst < 4; burst++) {
      const cx = 15 + Math.random() * 70;
      const cy = 10 + Math.random() * 40;
      const burstDelay = Math.random() * 4;

      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const dist = 40 + Math.random() * 60;
        generated.push({
          id: burst * 8 + i,
          left: `${cx}%`,
          top: `${cy}%`,
          tx: `${Math.cos(angle) * dist}px`,
          ty: `${Math.sin(angle) * dist}px`,
          delay: `${burstDelay + Math.random() * 0.3}s`,
          duration: `${1 + Math.random() * 0.5}s`,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: `${2 + Math.random() * 3}px`,
        });
      }
    }

    setParticles(generated);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            "--tx": p.tx,
            "--ty": p.ty,
            animation: `firework-burst ${p.duration} ease-out ${p.delay} infinite`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

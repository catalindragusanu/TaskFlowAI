import React, { useEffect, useState, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
  rotation: number;
  rotationSpeed: number;
}

export const Confetti: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Colors from your palette
    const colors = ['#660708', '#a4161a', '#e5383b', '#f5f3f4', '#b1a7a6'];
    const particleCount = 60;
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2, // Start from center
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        velocity: {
          x: (Math.random() - 0.5) * 25, // Spread out horizontally
          y: (Math.random() - 0.5) * 25 - 5, // Upward initial burst
        },
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
      });
    }

    setParticles(newParticles);

    // Animation loop using requestAnimationFrame for smoothness
    const animate = (time: number) => {
        setParticles(prevParticles => {
            if (prevParticles.length === 0) return prevParticles;
            
            return prevParticles
                .map(p => ({
                    ...p,
                    x: p.x + p.velocity.x,
                    y: p.y + p.velocity.y,
                    velocity: {
                        x: p.velocity.x * 0.96, // Air resistance
                        y: p.velocity.y * 0.96 + 0.8, // Gravity
                    },
                    rotation: p.rotation + p.rotationSpeed
                }))
                .filter(p => p.y < window.innerHeight + 100); // Remove when off screen
        });
        requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
      ))}
    </div>
  );
};
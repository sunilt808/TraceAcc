import React, { useRef } from 'react';

/**
 * TiltCard — wraps children in a 3D perspective tilt that follows
 * the pointer. Pure CSS transforms; spring-back on leave.
 */
export default function TiltCard({ children, max = 10, className = '', style = {} }) {
  const ref = useRef(null);
  const rafRef = useRef(0);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(6px)`;
      // glare position
      el.style.setProperty('--glare-x', `${(px + 0.5) * 100}%`);
      el.style.setProperty('--glare-y', `${(py + 0.5) * 100}%`);
    });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0)';
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      style={{ transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)', ...style }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
      <div className="tilt-glare" />
    </div>
  );
}

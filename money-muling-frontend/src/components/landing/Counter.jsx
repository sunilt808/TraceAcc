import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

/**
 * Counter — animates from 0 to `to` when scrolled into view.
 * Supports decimals and a suffix (%, +, etc.).
 */
export default function Counter({ to, duration = 1.6, decimals = 0, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start;
    let raf;
    const step = (ts) => {
      if (start === undefined) start = ts;
      const p = Math.min((ts - start) / (duration * 1000), 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

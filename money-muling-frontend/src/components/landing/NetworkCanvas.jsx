import React, { useRef, useEffect } from 'react';

/**
 * NetworkCanvas — a real-time 3D transaction-network visualisation.
 *
 * Pure-canvas 3D engine (no dependencies):
 *   - nodes distributed in 3D space, rotating around the Y axis
 *   - perspective projection with depth-based glow & size
 *   - edges drawn between near neighbours, brighter when facing camera
 *   - "money packets" travel along edges; some nodes flagged suspicious (red)
 *   - pointer drag rotates the scene; idle auto-rotation resumes after release
 */
export default function NetworkCanvas({ height = 520 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    rotY: 0,
    rotX: -0.15,
    targetRotY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    velocityY: 0.004,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let raf;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ---------- build the network ----------
    const NODE_COUNT = 46;
    const nodes = [];
    let seed = 42;
    const rand = () => {
      // deterministic pseudo-random so layout is stable across renders
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let i = 0; i < NODE_COUNT; i++) {
      // golden-spiral sphere distribution with jitter → organic cluster look
      const t = i / NODE_COUNT;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 150 + rand() * 90;
      nodes.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi) * 0.75,
        z: r * Math.sin(phi) * Math.sin(theta),
        suspicious: rand() > 0.82,
        pulse: rand() * Math.PI * 2,
      });
    }

    // edges between close pairs
    const edges = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 130 && edges.length < 70) {
          edges.push({ a: i, b: j });
        }
      }
    }

    // travelling packets along random edges
    const packets = Array.from({ length: 14 }, (_, k) => ({
      edge: Math.floor(rand() * edges.length),
      t: rand(),
      speed: 0.002 + rand() * 0.006,
      dir: rand() > 0.5 ? 1 : -1,
      hue: k % 3 === 0 ? '248,81,73' : '56,189,248',
    }));

    // ---------- resize ----------
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // ---------- interaction ----------
    const st = stateRef.current;
    const onDown = (e) => {
      st.dragging = true;
      st.lastX = e.clientX ?? e.touches?.[0]?.clientX;
      st.lastY = e.clientY ?? e.touches?.[0]?.clientY;
    };
    const onMove = (e) => {
      if (!st.dragging) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      st.targetRotY += (cx - st.lastX) * 0.006;
      st.rotX = Math.max(-1.1, Math.min(1.1, st.rotX + (cy - st.lastY) * 0.004));
      st.velocityY = 0; // pause auto-rotate while interacting
      st.lastX = cx;
      st.lastY = cy;
    };
    const onUp = () => {
      st.dragging = false;
      st.velocityY = 0.004; // resume gentle spin
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('touchend', onUp);

    // ---------- render loop ----------
    const project = (x, y, z, rotY, rotX) => {
      // rotate around Y
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      let x1 = x * cosY - z * sinY;
      let z1 = x * sinY + z * cosY;
      // rotate around X
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      let y1 = y * cosX - z1 * sinX;
      let z2 = y * sinX + z1 * cosX;

      const persp = 620 / (620 + z2 + 260); // camera distance
      return {
        sx: width / 2 + x1 * persp,
        sy: height / 2 + y1 * persp,
        scale: persp,
        depth: z2,
      };
    };

    const draw = () => {
      st.rotY += st.velocityY;
      st.rotY += (st.targetRotY - st.rotY) * 0.08;

      ctx.clearRect(0, 0, width, height);

      const time = performance.now() / 1000;

      // project all nodes once per frame
      const projected = nodes.map((n) =>
        project(n.x, n.y, n.z, st.rotY, st.rotX)
      );

      // ---- edges ----
      for (const e of edges) {
        const pa = projected[e.a];
        const pb = projected[e.b];
        const depthFade = Math.max(0.06, Math.min(1, ((pa.scale + pb.scale) / 2 - 0.55) * 2));
        const grad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
        grad.addColorStop(0, `rgba(56,189,248,${0.28 * depthFade})`);
        grad.addColorStop(1, `rgba(139,92,246,${0.28 * depthFade})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.1 * depthFade;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }

      // ---- packets (money flow) ----
      for (const p of packets) {
        p.t += p.speed * p.dir;
        if (p.t > 1 || p.t < 0) {
          p.edge = Math.floor(Math.random() * edges.length);
          p.t = p.dir > 0 ? 0 : 1;
        }
        const e = edges[p.edge];
        if (!e) continue;
        const pa = projected[e.a];
        const pb = projected[e.b];
        const px = pa.sx + (pb.sx - pa.sx) * p.t;
        const py = pa.sy + (pb.sy - pa.sy) * p.t;
        const fade = Math.max(0.15, Math.min(1, ((pa.scale + pb.scale) / 2 - 0.55) * 2));

        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue},${0.9 * fade})`;
        ctx.shadowColor = `rgba(${p.hue},0.9)`;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ---- nodes ----
      nodes.forEach((n, i) => {
        const p = projected[i];
        const baseR = (n.suspicious ? 4.6 : 3.2) * p.scale;
        const pulse = 1 + Math.sin(time * 2 + n.pulse) * 0.18;
        const alpha = Math.max(0.25, Math.min(1, (p.scale - 0.5) * 2));

        if (n.suspicious) {
          // alert halo
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, baseR * 2.6 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(248,81,73,${0.14 * alpha})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, baseR * pulse, 0, Math.PI * 2);
        ctx.fillStyle = n.suspicious
          ? `rgba(248,81,73,${alpha})`
          : `rgba(125,211,252,${alpha})`;
        ctx.shadowColor = n.suspicious
          ? `rgba(248,81,73,${alpha})`
          : `rgba(56,189,248,${alpha})`;
        ctx.shadowBlur = 14 * p.scale;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height,
        display: 'block',
        cursor: 'grab',
        touchAction: 'none',
      }}
    />
  );
}

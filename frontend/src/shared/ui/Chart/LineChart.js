'use client';

import { useMemo, useRef, useState } from 'react';
import styles from './LineChart.module.css';

function round2(v) {
  return Math.round(v * 100) / 100;
}
function finite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export default function LineChart({
  points,
  height = 190,
  valueSuffix = '',
  valuePrefix = '',
}) {
  const [hover, setHover] = useState(null);

  const pts = useMemo(() => {
    if (!Array.isArray(points)) return [];
    return points.filter((p) => finite(p?.x) && finite(p?.y));
  }, [points]);

  const W = 900;
  const H = height;

  const domain = useMemo(() => {
    if (pts.length < 2) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin0 = Math.min(...ys);
    const yMax0 = Math.max(...ys);
    const pad = (yMax0 - yMin0) * 0.1 || 1;
    return { xMin, xMax, yMin: yMin0 - pad, yMax: yMax0 + pad };
  }, [pts]);

  const mapped = useMemo(() => {
    if (!domain) return [];
    const { xMin, xMax, yMin, yMax } = domain;
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;

    return pts.map((p) => {
      const sx = ((p.x - xMin) / xSpan) * (W - 40) + 20;
      const sy = H - (((p.y - yMin) / ySpan) * (H - 34) + 17);
      return { ...p, sx, sy };
    });
  }, [pts, domain, H]);

  const path = useMemo(() => {
    if (mapped.length < 2) return '';
    let d = `M ${mapped[0].sx} ${mapped[0].sy}`;
    for (let i = 1; i < mapped.length; i++) {
      const prev = mapped[i - 1];
      const cur = mapped[i];
      const cx = (prev.sx + cur.sx) / 2;
      const cy = (prev.sy + cur.sy) / 2;
      d += ` Q ${prev.sx} ${prev.sy} ${cx} ${cy}`;
    }
    const last = mapped[mapped.length - 1];
    d += ` T ${last.sx} ${last.sy}`;
    return d;
  }, [mapped]);

  const area = useMemo(() => {
    if (!path) return '';
    const first = mapped[0];
    const last = mapped[mapped.length - 1];
    return `${path} L ${last.sx} ${H - 15} L ${first.sx} ${H - 15} Z`;
  }, [path, mapped, H]);

const rafRef = useRef(null);

const onMove = (e) => {
  if (!mapped.length) return;

  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  const rect = e.currentTarget.getBoundingClientRect();
  const clientX = e.clientX;

  rafRef.current = requestAnimationFrame(() => {
    const x = ((clientX - rect.left) / rect.width) * W;

    let best = mapped[0];
    let bestDist = Math.abs(mapped[0].sx - x);
    for (const p of mapped) {
      const d = Math.abs(p.sx - x);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    setHover(best);
  });
};

  if (pts.length < 2) return <div className={styles.empty}>Недостаточно данных</div>;

  return (
    <div className={styles.wrap} style={{ height }}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="avLineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(124,92,255,0.22)" />
            <stop offset="100%" stopColor="rgba(124,92,255,0.02)" />
          </linearGradient>
        </defs>

        <line x1="20" y1={H - 15} x2={W - 20} y2={H - 15} className={styles.grid} />

        <path d={area} fill="url(#avLineFill)" />
        <path d={path} className={styles.line} />

        {hover && (
          <>
            <line x1={hover.sx} y1="12" x2={hover.sx} y2={H - 12} className={styles.cursor} />
            <circle cx={hover.sx} cy={hover.sy} r="5" className={styles.dot} />
          </>
        )}
      </svg>

      {hover && (
        <div className={styles.tooltip}>
          <div className={styles.tipX}>{hover.label ? hover.label : `Ставка #${hover.x + 1}`}</div>
          <div className={styles.tipY}>
            {valuePrefix}{round2(hover.y)}{valueSuffix}
          </div>
        </div>
      )}
    </div>
  );
}

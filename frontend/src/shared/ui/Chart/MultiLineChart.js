'use client';

import { useMemo, useState } from 'react';
import styles from './MultiLineChart.module.css';

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function round2(v) {
  return Math.round(v * 100) / 100;
}

export default function MultiLineChart({ series, height = 190, valueSuffix = '' }) {
  const [hoverX, setHoverX] = useState(null);
  const W = 900;
  const H = height;

  const normalized = useMemo(() => {
    const s = Array.isArray(series) ? series : [];
    const xs = new Set();
    for (const line of s) {
      for (const p of (line?.points || [])) {
        if (finite(p?.x)) xs.add(p.x);
      }
    }
    const xList = Array.from(xs).sort((a, b) => a - b);
    return { s, xList };
  }, [series]);

  const domain = useMemo(() => {
    const ys = [];
    for (const line of normalized.s) {
      for (const p of (line.points || [])) {
        if (finite(p?.y)) ys.push(p.y);
      }
    }
    if (!normalized.xList.length || ys.length < 2) return null;

    const xMin = normalized.xList[0];
    const xMax = normalized.xList[normalized.xList.length - 1];

    const yMin0 = Math.min(...ys);
    const yMax0 = Math.max(...ys);
    const pad = (yMax0 - yMin0) * 0.10 || 1;

    return { xMin, xMax, yMin: yMin0 - pad, yMax: yMax0 + pad };
  }, [normalized]);

  const mapPoint = (p, domain) => {
    const { xMin, xMax, yMin, yMax } = domain;
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;

    const sx = ((p.x - xMin) / xSpan) * (W - 40) + 20;
    const sy = H - (((p.y - yMin) / ySpan) * (H - 34) + 17);
    return { ...p, sx, sy };
  };

  const paths = useMemo(() => {
    if (!domain) return [];
    return normalized.s.map((line, idx) => {
      const pts = (line.points || []).filter((p) => finite(p?.x) && finite(p?.y)).sort((a, b) => a.x - b.x);
      if (pts.length < 2) return { idx, name: line.name, d: '' };

      const mapped = pts.map((p) => mapPoint(p, domain));
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
      return { idx, name: line.name, d, ptsMapped: mapped };
    });
  }, [domain, normalized, H]);

  const hover = useMemo(() => {
    if (hoverX == null || !domain) return null;
    const items = [];
    for (const line of normalized.s) {
      const p = (line.points || []).find((x) => x.x === hoverX);
      if (p && finite(p.y)) items.push({ name: line.name, y: p.y, label: p.label });
    }
    const label = items.find((i) => i.label)?.label || `Ставка #${hoverX + 1}`;
    return { x: hoverX, label, items };
  }, [hoverX, normalized, domain]);

  const onMove = (e) => {
    if (!domain || !normalized.xList.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const { xMin, xMax } = domain;
    const xSpan = xMax - xMin || 1;
    const xVal = ((x - 20) / (W - 40)) * xSpan + xMin;

    let best = normalized.xList[0];
    let bestDist = Math.abs(best - xVal);
    for (const v of normalized.xList) {
      const d = Math.abs(v - xVal);
      if (d < bestDist) {
        best = v;
        bestDist = d;
      }
    }
    setHoverX(best);
  };

  if (!domain) {
    return <div className={styles.empty}>Недостаточно данных</div>;
  }

  return (
    <div className={styles.wrap} style={{ height }}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
      >
        <line x1="20" y1={H - 15} x2={W - 20} y2={H - 15} className={styles.grid} />
        {paths.map((p) => (
          <path
            key={p.idx}
            d={p.d}
            className={p.idx === 0 ? styles.lineA : styles.lineB}
          />
        ))}

        {hoverX != null && (
          (() => {
            const { xMin, xMax } = domain;
            const xSpan = xMax - xMin || 1;
            const sx = ((hoverX - xMin) / xSpan) * (W - 40) + 20;
            return <line x1={sx} y1="12" x2={sx} y2={H - 12} className={styles.cursor} />;
          })()
        )}
      </svg>

      {hover && (
        <div className={styles.tooltip}>
          <div className={styles.tipX}>{hover.label}</div>
          <div className={styles.rows}>
            {hover.items.map((it) => (
              <div key={it.name} className={styles.row}>
                <span className={styles.name}>{it.name}</span>
                <b className={styles.val}>{round2(it.y)}{valueSuffix}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.legend}>
        <span className={styles.badgeA}>Рекомендовано</span>
        <span className={styles.badgeB}>Фактически</span>
      </div>
    </div>
  );
}

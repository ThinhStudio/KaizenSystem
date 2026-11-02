// Small, dependency-free SVG/HTML charts. Colors come from CSS tokens (--s1, --s2, --seq).

const fmtN = (v) => new Intl.NumberFormat('vi-VN').format(v);

function niceMax(v) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = [1, 2, 2.5, 5, 10].find((k) => k * p >= v);
  return m * p;
}

// Grouped vertical bars. series: [{key,label,cls}], rows: [{label, [key]: n}]
export function columnChart(rows, series, { height = 220 } = {}) {
  const W = 640, H = height, L = 34, B = 26, T = 10, R = 6;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => +r[s.key] || 0))));
  const pw = (W - L - R) / rows.length, gap = 2;
  const bw = Math.min(18, (pw * 0.62 - gap * (series.length - 1)) / series.length);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${series.map((s) => s.label).join(', ')} theo tháng">`;
  ticks.forEach((t) => {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid${t === 0 ? ' base' : ''}"/>`;
    svg += `<text x="${L - 6}" y="${y(t) + 4}" class="axis" text-anchor="end">${fmtN(t)}</text>`;
  });
  rows.forEach((r, i) => {
    const cx = L + pw * i + pw / 2, total = series.length * bw + (series.length - 1) * gap;
    series.forEach((s, k) => {
      const v = +r[s.key] || 0, x = cx - total / 2 + k * (bw + gap), top = y(v), h = y(0) - top;
      if (v > 0) svg += `<path class="bar ${s.cls}" d="M${x},${y(0)} V${top + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)} H${x + bw - Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)} V${y(0)} Z"/>`;
    });
    svg += `<rect x="${L + pw * i}" y="${T}" width="${pw}" height="${H - T - B}" class="hit" data-tip="<b>${r.label}</b>${series.map((s) => `<span><i class='sw ${s.cls}'></i>${s.label}: ${fmtN(+r[s.key] || 0)}</span>`).join('')}"/>`;
    svg += `<text x="${cx}" y="${H - 8}" class="axis" text-anchor="middle">${r.short || r.label}</text>`;
  });
  return svg + '</svg>';
}

// Horizontal bars with direct value labels (single series).
export function barList(rows, { label = (r) => r.label, value = (r) => r.value, fmt = fmtN, icon = null, cls = 's1' } = {}) {
  const max = Math.max(1, ...rows.map(value));
  return `<div class="barlist">${rows.map((r) => `
    <div class="bl-row" data-tip="<b>${label(r)}</b><span>${fmt(value(r))}</span>">
      <span class="bl-label">${icon ? icon(r) : ''}${label(r)}</span>
      <span class="bl-track"><span class="bl-fill ${cls}" style="width:${(value(r) / max) * 100}%"></span></span>
      <span class="bl-val">${fmt(value(r))}</span>
    </div>`).join('')}</div>`;
}

// Ring gauge for a percentage.
export function ring(pct, size = 92) {
  const r = 38, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return `<svg width="${size}" height="${size}" viewBox="0 0 92 92" class="ring" role="img" aria-label="${p}%">
    <circle cx="46" cy="46" r="${r}" class="ring-bg"/>
    <circle cx="46" cy="46" r="${r}" class="ring-fg" stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 46 46)"/>
    <text x="46" y="52" text-anchor="middle" class="ring-txt">${Math.round(p)}%</text></svg>`;
}

// Sparkline for small trend in KPI tiles.
export function spark(values, w = 96, h = 28) {
  if (!values.length) return '';
  const max = Math.max(1, ...values), step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 3 - (v / max) * (h - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true">
    <path d="${d} L${w},${h} L0,${h} Z" class="spark-area"/><path d="${d}" class="spark-line"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="2.6" class="spark-dot"/></svg>`;
}

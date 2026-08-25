self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type !== 'build') return;
  const id = m.id;
  const generation = m.generation;
  const bars = Array.isArray(m.bars) ? m.bars : [];
  const mode = String(m.mode || 'auto');
  const fixedBox = Number(m.box);
  const atrLength = Math.max(2, Math.floor(Number(m.atrLength) || 14));
  const atrFactor = Math.max(0.01, Number(m.atrFactor) || 1);
  const percent = Math.max(0.000001, Number(m.percent) || 0.001);
  const out = [];
  let lastClose = NaN;
  let direction = 0;
  let prevClose = NaN;
  let atr = NaN;
  const trQueue = [];

  const add = (open, close, dir, time, box, high, low) => {
    out.push({
      open,
      close,
      high: Number.isFinite(high) ? Math.max(high, open, close) : Math.max(open, close),
      low: Number.isFinite(low) ? Math.min(low, open, close) : Math.min(open, close),
      direction: dir,
      time: Number(time) || 0,
      box
    });
    lastClose = close;
    direction = dir;
  };

  const updateAtr = (bar) => {
    const high = Number(bar?.[2]);
    const low = Number(bar?.[3]);
    const close = Number(bar?.[4]);
    if (![high, low, close].every(Number.isFinite)) return atr;
    const tr = Number.isFinite(prevClose)
      ? Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
      : high - low;
    prevClose = close;
    trQueue.push(Math.max(0, tr));
    if (trQueue.length > atrLength) trQueue.shift();
    if (trQueue.length === atrLength) atr = trQueue.reduce((a, b) => a + b, 0) / atrLength;
    return atr;
  };

  const getBox = (price) => {
    if (mode === 'atr') {
      const b = Number(atr) * atrFactor;
      return b > 0 ? b : fixedBox;
    }
    if (mode === 'percentage') {
      const base = Number.isFinite(lastClose) && Math.abs(lastClose) > 0 ? Math.abs(lastClose) : Math.abs(price);
      return Math.max(Number.EPSILON, base * percent);
    }
    return fixedBox;
  };

  for (const k of bars) {
    const p = Number(k?.[4]);
    const t = Number(k?.[0]);
    const high = Number(k?.[2]);
    const low = Number(k?.[3]);
    updateAtr(k);
    if (!Number.isFinite(p)) continue;
    let box = getBox(p);
    if (!(box > 0)) continue;
    if (!Number.isFinite(lastClose)) lastClose = Math.floor(p / box) * box;
    let guard = 0;
    while (guard++ < 10000) {
      box = getBox(p);
      if (!(box > 0)) break;
      if (direction === 0) {
        if (p >= lastClose + box) { add(lastClose, lastClose + box, 1, t, box, high, low); continue; }
        if (p <= lastClose - box) { add(lastClose, lastClose - box, -1, t, box, high, low); continue; }
        break;
      }
      if (direction === 1) {
        if (p >= lastClose + box) { add(lastClose, lastClose + box, 1, t, box, high, low); continue; }
        if (p <= lastClose - 2 * box) { add(lastClose - box, lastClose - 2 * box, -1, t, box, high, low); continue; }
        break;
      }
      if (p <= lastClose - box) { add(lastClose, lastClose - box, -1, t, box, high, low); continue; }
      if (p >= lastClose + 2 * box) { add(lastClose + box, lastClose + 2 * box, 1, t, box, high, low); continue; }
      break;
    }
  }

  self.postMessage({
    type: 'built',
    id,
    generation,
    mode,
    barCount: bars.length,
    bricks: out,
    atr: Number.isFinite(atr) ? atr : null
  });
};

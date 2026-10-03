/* Minimal shared chart primitives */
function chartSetupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  let W = rect.width;
  let H = rect.height;
  if (W < 1 || H < 1) {
    W = parseFloat(canvas.getAttribute('width')) || canvas.clientWidth || 280;
    H = parseFloat(canvas.getAttribute('height')) || canvas.clientHeight || 160;
  }
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  return { ctx, dpr, rect: { width: W, height: H }, W, H };
}

function chartScale(data, padFrac) {
  let minP = Infinity, maxP = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const p = data[i].price;
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  const range = maxP - minP;
  const pad = Math.max(range * (padFrac || 0.1), 0.005);
  minP -= pad;
  maxP += pad;
  return { minP, maxP };
}

function chartAxes(ctx, W, H, PAD, plotW, plotH, minP, maxP, gridCount, labelStep) {
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridCount; i++) {
    const y = PAD.top + (i / gridCount) * plotH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
    const price = maxP - (i / gridCount) * (maxP - minP);
    ctx.fillStyle = '#999';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(price.toFixed(3).replace('.', ','), PAD.left - 7, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '9px system-ui, sans-serif';
  for (let i = 0; i < labelStep.count; i++) {
    const idx = labelStep.indices[i];
    ctx.fillStyle = '#999';
    const d = labelStep.data[idx];
    if (!d) continue;
    const parts = String(d.date).split('-');
    const x = PAD.left + (idx / Math.max(1, labelStep.dataLen - 1)) * plotW;
    ctx.fillText(parts[0] + '-' + parts[1], x, H - PAD.bottom + 4);
  }
}

function chartMinMax(data) {
  if (!data.length) return { minD: null, maxD: null };
  let minD = data[0], maxD = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i].price < minD.price) minD = data[i];
    if (data[i].price > maxD.price) maxD = data[i];
  }
  return { minD, maxD };
}

function chartIndices(data, count) {
  const len = data.length;
  if (len <= count) return data.map((_, i) => i);
  const step = Math.floor(len / (count - 1));
  const out = [];
  for (let i = 0; i < len; i += step) out.push(i);
  if (out[out.length - 1] !== len - 1) out.push(len - 1);
  return out;
}

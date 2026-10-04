function drawPriceChart(canvas, data) {
  const { ctx, W, H } = chartSetupCanvas(canvas);
  const PAD = { top: 24, right: 24, bottom: 22, left: 56 };
  const plotW = Math.max(1, W - PAD.left - PAD.right);
  const plotH = Math.max(1, H - PAD.top - PAD.bottom);

  if (data.length < 2) {
    ctx.fillStyle = '#999';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Datos insuficientes para mostrar histórico', W / 2, H / 2);
    canvas._chartPoints = [];
    canvas._chartData = data;
    if (!canvas._chartTooltipAttached) {
      canvas._chartTooltipAttached = true;
      canvas.addEventListener('mousemove', onChartHover);
      canvas.addEventListener('mouseleave', onChartLeave);
    }
    return;
  }

  const { minP, maxP } = chartScale(data, 0.1);
  const xPos = i => PAD.left + (i / Math.max(1, data.length - 1)) * plotW;
  const yPos = p => PAD.top + plotH - ((p - minP) / (maxP - minP)) * plotH;

  const indices = chartIndices(data, 8);
  chartAxes(ctx, W, H, PAD, plotW, plotH, minP, maxP, 4, {
    indices, data, dataLen: data.length, count: indices.length
  });

  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xPos(i); const y = yPos(d.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const { minD, maxD } = chartMinMax(data);
  const points = data.map((d, i) => ({
    x: xPos(i), y: yPos(d.price), price: d.price, date: d.date
  }));
  canvas._chartPoints = points;
  canvas._chartData = data;

  data.forEach((d, i) => {
    const x = xPos(i); const y = yPos(d.price);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    if (d === maxD && maxD !== minD) ctx.fillStyle = '#c62828';
    else if (d === minD) ctx.fillStyle = '#2e7d32';
    else ctx.fillStyle = '#1a73e8';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (d !== minD && d !== maxD) {
      ctx.fillStyle = '#555';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.price.toFixed(3).replace('.', ','), x, y - 6);
    }
  });

  ctx.fillStyle = '#2e7d32';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const minIdx = data.indexOf(minD);
  const maxIdx = data.indexOf(maxD);
  const minX = xPos(minIdx); const minY = yPos(minD.price);
  ctx.fillText(minD.price.toFixed(3).replace('.', ',') + '▼', minX, minY - 5);
  if (maxD !== minD) {
    ctx.fillStyle = '#c62828';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxX = xPos(maxIdx); const maxY = yPos(maxD.price);
    ctx.fillText('▲' + maxD.price.toFixed(3).replace('.', ','), maxX, maxY + 5);
  }

  if (!canvas._chartTooltipAttached) {
    canvas._chartTooltipAttached = true;
    canvas.addEventListener('mousemove', onChartHover);
    canvas.addEventListener('mouseleave', onChartLeave);
  }
}

function onChartHover(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const points = canvas._chartPoints;
  if (!points) return;

  let nearest = null;
  let minDist = 12;
  for (const p of points) {
    const dx = mx - p.x;
    const dy = my - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }

  if (nearest) {
    drawPriceChart(canvas, canvas._chartData);
    drawTooltip(canvas, nearest);
  }
}

function onChartLeave(e) {
  const canvas = e.target;
  if (canvas._chartData) {
    drawPriceChart(canvas, canvas._chartData);
  }
}

function drawTooltip(canvas, point) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();

  const parts = String(point.date).split('-');
  const dateLabel = parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : point.date;
  const priceLabel = point.price.toFixed(3).replace('.', ',') + ' €';
  ctx.font = 'bold 11px system-ui, sans-serif';
  const pm = ctx.measureText(priceLabel);
  ctx.font = '10px system-ui, sans-serif';
  const dm = ctx.measureText(dateLabel);
  const pw = pm.width, dw = dm.width;
  const tw = Math.max(pw, dw);
  const lh = 16;
  const pad = 6;
  const bw = tw + pad * 2;
  const bh = lh * 2 + pad * 2;
  let bx = point.x - bw / 2;
  let by = point.y - bh - 10;
  if (bx < 2) bx = 2;
  if (bx + bw > rect.width - 2) bx = rect.width - bw - 2;
  if (by < 2) by = point.y + 10;

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 4);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(priceLabel, bx + bw / 2, by + pad + lh / 2);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(dateLabel, bx + bw / 2, by + pad + lh + lh / 2);
}

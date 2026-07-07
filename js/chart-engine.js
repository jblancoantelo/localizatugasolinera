function drawPriceChart(canvas, data, fuelName) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 6, right: 10, bottom: 22, left: 48 };
  const plotW = Math.max(1, W - PAD.left - PAD.right);
  const plotH = Math.max(1, H - PAD.top - PAD.bottom);

  if (data.length < 2) {
    ctx.fillStyle = '#999';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Datos insuficientes para mostrar histórico', W / 2, H / 2);
    return;
  }

  let minP = Infinity, maxP = -Infinity;
  data.forEach(d => { if (d.price < minP) minP = d.price; if (d.price > maxP) maxP = d.price; });
  const range = maxP - minP;
  const pad = Math.max(range * 0.1, 0.005);
  minP -= pad;
  maxP += pad;

  const xPos = i => PAD.left + (i / Math.max(1, data.length - 1)) * plotW;
  const yPos = p => PAD.top + plotH - ((p - minP) / (maxP - minP)) * plotH;

  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 1;
  const gridCount = 4;
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
    ctx.fillText(price.toFixed(3).replace('.', ',') + '€', PAD.left - 5, y);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '9px system-ui, sans-serif';
  const step = Math.max(1, Math.floor(data.length / 6));
  data.forEach((d, i) => {
    if (i % step === 0 || i === data.length - 1) {
      ctx.fillStyle = '#999';
      ctx.fillText(d.date, xPos(i), H - PAD.bottom + 4);
    }
  });

  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const minD = data.reduce((a, b) => a.price < b.price ? a : b);
  const maxD = data.reduce((a, b) => a.price > b.price ? a : b);

  data.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.price);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    if (d === maxD && maxD !== minD) {
      ctx.fillStyle = '#c62828';
    } else if (d === minD) {
      ctx.fillStyle = '#2e7d32';
    } else {
      ctx.fillStyle = '#1a73e8';
    }
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

  const label = fuelName || '';
  if (label) {
    ctx.fillStyle = '#555';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, PAD.left, 0);
  }

  ctx.fillStyle = '#2e7d32';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const minX = xPos(data.indexOf(minD));
  const minY = yPos(minD.price);
  ctx.fillText(minD.price.toFixed(3).replace('.', ',') + '▼', minX, minY - 5);

  if (maxD !== minD) {
    ctx.fillStyle = '#c62828';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxX = xPos(data.indexOf(maxD));
    const maxY = yPos(maxD.price);
    ctx.fillText('▲' + maxD.price.toFixed(3).replace('.', ','), maxX, maxY + 5);
  }
}

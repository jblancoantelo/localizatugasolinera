function formatLogTime() {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2, '0'),
    '/',
    String(d.getMonth() + 1).padStart(2, '0'),
    '/',
    String(d.getFullYear()).slice(-2),
    ' ',
    String(d.getHours()).padStart(2, '0'),
    ':',
    String(d.getMinutes()).padStart(2, '0'),
    ':',
    String(d.getSeconds()).padStart(2, '0')
  ].join('');
}

function norm(s) { return String(s??'').replace(/,/g,'.').trim(); }

function parsePrice(v) { let x=parseFloat(norm(v)); return isNaN(x)?null:x; }

function dist(lat1,lon1,lat2,lon2) {
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function getFuelPrice(st, key) { return parsePrice(st[key]); }

function getFirstFuelPrice(st) {
  for (const [,k] of FUEL_NAMES) { const v=getFuelPrice(st,k); if(v!==null) return v; }
  return null;
}

function getFirstFuelName(st) {
  for (const [n,k] of FUEL_NAMES) { if(getFuelPrice(st,k)!==null) return n; }
  return '';
}

function fuelColor(price) {
  if (price === null) return 'g';
  const lo = STATE._lo, hi = STATE._hi;
  if (lo === undefined) return price < 1.5 ? 'g' : price < 1.7 ? 'o' : 'r';
  return price <= lo ? 'g' : price <= hi ? 'o' : 'r';
}

function fuelColorHex(price) {
  if (price === null) return '#999';
  const lo = STATE._lo, hi = STATE._hi;
  if (lo === undefined) return price < 1.5 ? '#2e7d32' : price < 1.7 ? '#f57c00' : '#b71c1c';
  return price <= lo ? '#2e7d32' : price <= hi ? '#f57c00' : '#b71c1c';
}

function normalizeStr(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

function getDiscount(st) {
  return STATE.discounts?.[st.Rótulo] || 0;
}

function getDiscountedPrice(rawPrice, st) {
  const d = getDiscount(st);
  return d ? rawPrice - d / 100 : rawPrice;
}

function getDiscountedFuelPrice(st, key) {
  const v = getFuelPrice(st, key);
  return v !== null ? getDiscountedPrice(v, st) : null;
}

function getFirstDiscountedFuelPrice(st) {
  for (const [,k] of FUEL_NAMES) {
    const v = getDiscountedFuelPrice(st, k);
    if (v !== null) return v;
  }
  return null;
}

function getSelectedFuelPrice(st) {
  const sf = STATE.selectedFuel;
  if (!sf) return getFirstDiscountedFuelPrice(st);
  const group = FUEL_GROUPS[sf];
  if (group) {
    for (const name of group) {
      const v = getDiscountedFuelPrice(st, FUEL_KEYS[name]);
      if (v !== null) return v;
    }
    return null;
  }
  return getDiscountedFuelPrice(st, FUEL_KEYS[sf]);
}

function getSelectedFuelName(st) {
  const sf = STATE.selectedFuel;
  if (!sf) return getFirstFuelName(st);
  const group = FUEL_GROUPS[sf];
  if (group) {
    for (const name of group) {
      if (getFuelPrice(st, FUEL_KEYS[name]) !== null) return name;
    }
    return '';
  }
  return getFuelPrice(st, FUEL_KEYS[sf]) !== null ? sf : '';
}

function getFuelPriceDisplay(st, key) {
  const v = getFuelPrice(st, key);
  if (v === null) return null;
  const dv = getDiscountedPrice(v, st);
  const d = getDiscount(st);
  let s = dv.toFixed(3).replace('.', ',') + ' €/L';
  if (d) s += ' (-' + d + ')';
  return s;
}

function comparePrices(currentPrice, oldestPrice) {
  if (currentPrice === null || oldestPrice === null) return null;
  const diff = oldestPrice - currentPrice;
  if (diff === 0) return null;
  return { difference: Math.abs(diff), currentPrice, oldestPrice, isRise: diff < 0 };
}

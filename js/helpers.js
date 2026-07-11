function norm(s) { return (s||'').replace(/,/g,'.').trim(); }

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

async function checkFavoritePrices() {
  if (!STATE.favorites || STATE.favorites.length === 0) {
    console.log('No favorites to check');
    return;
  }

  if (!STATE.selectedProv) {
    console.log('No province selected, skipping price check');
    return;
  }

  try {
    const days = STATE.priceFallDays || STATE.historyDays || 14;
    const historyData = await fetchProvinceHistory(STATE.selectedProv, days);

    const notificationsToShow = [];

    for (const favoriteId of STATE.favorites) {
      const favorite = STATE.data.find(s => s.IDEESS === favoriteId);
      if (!favorite) continue;

      const fuelName = getFirstFuelName(favorite);
      if (!fuelName) continue;

      const currentPrice = getFirstFuelPrice(favorite);
      if (!currentPrice) continue;

      const stationHistory = getStationHistory(historyData, favoriteId, fuelName);
      if (stationHistory.length < 2) continue;

      const oldestRecord = stationHistory[0];
      const oldestPrice = parsePrice(oldestRecord.price);
      if (oldestPrice === null) continue;

      const priceDifference = oldestPrice - currentPrice;

      if (priceDifference > 0) {
        notificationsToShow.push({
          favoriteId: favoriteId,
          brand: favorite.Rótulo,
          fuel: fuelName,
          currentPrice: currentPrice,
          oldestPrice: oldestPrice,
          difference: priceDifference.toFixed(3),
          address: favorite.Dirección,
          locality: favorite.Localidad
        });
      }
    }

    if (notificationsToShow.length > 0) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Alerta de Precios', {
        body: `${notificationsToShow.length} favorito(s) tienen precios más bajos`,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'price-alert',
        requireInteraction: true,
        data: {
          alerts: notificationsToShow
        }
      });

      console.log('Price alert notification sent:', notificationsToShow);
    }

  } catch (error) {
    console.error('Error checking favorite prices:', error);
  }
}

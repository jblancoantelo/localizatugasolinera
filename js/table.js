function fuelsHtml(d) {
  const sf = STATE.selectedFuel;
  const items = [];
  for (const [n, key] of FUEL_NAMES) {
    if (sf) {
      const group = FUEL_GROUPS[sf];
      if (group) { if (!group.includes(n)) continue; }
      else if (n !== sf) continue;
    }
    const display = getFuelPriceDisplay(d, key);
    if (display !== null) {
      const dv = getDiscountedFuelPrice(d, key);
      items.push(`<span><span class="dot ${fuelColor(dv)}"></span> ${n}</span><span>${display}</span>`);
    }
  }
  return items;
}

function allFuelsHtml(d) {
  const items = [];
  for (const [n, key] of FUEL_NAMES) {
    const display = getFuelPriceDisplay(d, key);
    if (display !== null) {
      const dv = getDiscountedFuelPrice(d, key);
      items.push(`<span><span class="dot ${fuelColor(dv)}"></span> ${n}</span><span>${display}</span>`);
    }
  }
  return items;
}

function showDetail(id) {
  const s = STATE;
  const d = s.data.find(x => x.IDEESS === id);
  if (!d) return;
  s.selectedId = id;
  const items = allFuelsHtml(d);
  if (!items.length) return;
  const isFav = s.favorites.includes(d.IDEESS);
  document.getElementById('detailBrand').innerHTML = `<span class="fav-btn${isFav ? ' on' : ''}" data-id="${d.IDEESS}">${isFav ? '★' : '☆'}</span> ${d.Rótulo || ''}`;
  document.getElementById('detailAddr').textContent = [d.Dirección, d.Localidad, d.Provincia].filter(Boolean).join(', ');
  document.getElementById('detailFuels').innerHTML = items.join('');
  document.getElementById('detailPanel').classList.add('show');
}

function updateDetail() {
  const s = STATE, el = document.getElementById('detailPanel');
  if (!s.selectedId || !s.data.length) {
    el.classList.remove('show');
    s.selectedId = null;
    return;
  }
  const d = s.data.find(x => x.IDEESS === s.selectedId);
  if (!d) {
    el.classList.remove('show');
    s.selectedId = null;
    return;
  }
  showDetail(s.selectedId);
}

function updatePageNav(total) {
  const s = STATE;
  const pageSize = s.pageSize;
  const nav = document.getElementById('pageNav');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const info = document.getElementById('pageInfo');
  if (pageSize === 0 || total <= pageSize) {
    nav.style.display = 'none';
    return;
  }
  nav.style.display = 'flex';
  const totalPages = Math.ceil(total / pageSize);
  if (s.page > totalPages) s.page = totalPages;
  info.textContent = `Pág. ${s.page} de ${totalPages}`;
  prevBtn.disabled = s.page <= 1;
  nextBtn.disabled = s.page >= totalPages;
}

function doSort() {
  const s = STATE, arr = s.filtered, col = s.sortCol, dir = s.sortDir;
  arr.sort((a,b) => {
    let va, vb;
    if (col==='Precio') { va=getSelectedFuelPrice(a)??999; vb=getSelectedFuelPrice(b)??999; }
    else if (col==='Combustible') { va=getSelectedFuelName(a); vb=getSelectedFuelName(b); }
    else if (col==='Distancia') { va=a._dist??99999; vb=b._dist??99999; }
    else { va=(a[col]||'').toLowerCase(); vb=(b[col]||'').toLowerCase(); }
    if (typeof va==='string') return dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);
    return dir==='asc'?va-vb:vb-va;
  });
  const pageSize = s.pageSize;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(arr.length / pageSize));
  if (s.page > totalPages) s.page = totalPages;
  const start = pageSize === 0 ? 0 : (s.page - 1) * pageSize;
  const pageItems = pageSize === 0 ? arr : arr.slice(start, start + pageSize);

  document.querySelector('#tableBody').innerHTML = pageItems.map(d => {
    const p = getSelectedFuelPrice(d);
    const fn = getSelectedFuelName(d);
    const distStr = d._dist!==null ? d._dist.toFixed(1)+' km' : '';
    const isFav = s.favorites.includes(d.IDEESS);
    const sel = s.selectedId===d.IDEESS ? ' selected' : '';
    const cheap = d._cheapest ? ' cheapest' : '';
    const disc = getDiscount(d);
    const priceStr = p!==null ? p.toFixed(3).replace('.',',')+' €' + (disc ? ' (-'+disc+')' : '') : '—';
    const dot = p !== null ? `<span class="dot ${fuelColor(p)}"></span> ` : '';
    const star = `<span class="fav-btn${isFav?' on':''}">${isFav?'★':'☆'}</span> `;
    const cheapBadge = d._cheapest ? ' <span class="cheap-badge" title="Más barato de la provincia">↓</span>' : '';
    return `<tr class="${sel}${cheap}" data-id="${d.IDEESS}"><td>${star}${dot}${d.Rótulo||''}${cheapBadge}</td><td>${priceStr}</td><td>${fn}</td><td>${d.Provincia||''}</td><td>${d.Localidad||''}</td><td>${d.Dirección||''}</td><td>${distStr}</td></tr>`;
  }).join('');

  document.querySelector('#tableBothBody').innerHTML = arr.map(d => {
    const p = getSelectedFuelPrice(d);
    const fn = getSelectedFuelName(d);
    const distStr = d._dist!==null ? d._dist.toFixed(1)+' km' : '';
    const isFav = s.favorites.includes(d.IDEESS);
    const sel = s.selectedId===d.IDEESS ? ' selected' : '';
    const cheap = d._cheapest ? ' cheapest' : '';
    const priceStr = p!==null ? p.toFixed(3).replace('.',',')+' €' : '—';
    const dot = p !== null ? `<span class="dot ${fuelColor(p)}"></span> ` : '';
    const star = `<span class="fav-btn${isFav?' on':''}">${isFav?'★':'☆'}</span> `;
    const cheapBadge = d._cheapest ? ' <span class="cheap-badge" title="Más barato de la provincia">↓</span>' : '';
    return `<tr class="${sel}${cheap}" data-id="${d.IDEESS}"><td>${star}${dot}${d.Rótulo||''}${cheapBadge}</td><td>${priceStr}</td><td>${fn}</td><td>${distStr}</td></tr>`;
  }).join('');

  document.querySelectorAll('#table thead th').forEach(th => {
    const a = th.querySelector('.arrow');
    a.textContent = th.dataset.col===s.sortCol ? (s.sortDir==='asc'?' ▲':' ▼') : '';
  });
  document.querySelectorAll('#tableBoth thead th').forEach(th => {
    const a = th.querySelector('.arrow');
    a.textContent = th.dataset.col===s.sortCol ? (s.sortDir==='asc'?' ▲':' ▼') : '';
  });
  updatePageNav(arr.length);
  saveState();
}

function toggleSort(col) {
  const s = STATE;
  if (s.sortCol===col) s.sortDir = s.sortDir==='asc'?'desc':'asc';
  else { s.sortCol=col; s.sortDir='asc'; }
  doSort();
  saveState();
}

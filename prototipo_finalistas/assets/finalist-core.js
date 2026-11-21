// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera

/* ============================================================================
   FinalistCore — estado, persistencia y cálculos de los tres finalistas
   ----------------------------------------------------------------------------
   Todo lo que no es pintar: filtros persistentes, comparador con coste real
   del desvío, previsión determinista a 7 días, planificador de depósito,
   recomendación del asistente e insights sobre la lista cargada.
   ========================================================================== */
const FinalistCore = (() => {
  'use strict';

  const KEY = 'gasolineras_finalistas_v1';
  const MAX_COMPARE = 3;

  const DEFAULTS = {
    fuel: 'diesel',
    province: 'Madrid',
    locality: '',
    brands: [],
    maxKm: 0,
    q: '',
    favoritesOnly: false,
    cheapOnly: false,
    sort: 'price',
    dir: 'asc',
    mapStyle: 'claro',
    pageSize: 30,
    litros: 50,
    cons: 6.4,
    detourExtra: 0,
    plan: { tank: 50, level: 12, cons: 6.4, budget: 180, spent: 62.4, reminder: false },
    assistant: { step: 0, fuel: 'diesel', weight: 55, litros: 50, need: 'precio', done: false },
    iaHidden: [],
    compare: [],
    favIds: [],
    lastTab: 'mapa',
    lastPanel: 'explorar',
    driveId: null,
  };

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const state = clone(DEFAULTS);
  const SEED_FAVS = PROTO.STATIONS.filter(s => s.fav).map(s => s.id);

  /* --- Persistencia ---------------------------------------------------- */
  function load() {
    let rawFavs = null;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.favIds)) rawFavs = raw.favIds.slice();
        for (const k of Object.keys(DEFAULTS)) {
          if (raw[k] == null) continue;
          if (k === 'plan' || k === 'assistant') state[k] = Object.assign({}, DEFAULTS[k], raw[k]);
          else if (k !== 'favIds') state[k] = raw[k];
        }
      }
    } catch (e) { /* localStorage bloqueado */ }
    if (!Array.isArray(state.compare)) state.compare = [];
    if (!Array.isArray(state.brands)) state.brands = [];
    if (!Array.isArray(state.iaHidden)) state.iaHidden = [];
    state.favIds = rawFavs || SEED_FAVS.slice();
    applyFavs();
    return state;
  }

  /** Vuelca `state.favIds` sobre las estaciones; la fuente de verdad es el estado. */
  function applyFavs() {
    const set = new Set(state.favIds);
    PROTO.STATIONS.forEach(s => { s.fav = set.has(s.id); });
  }

  function toggleFav(id) {
    const st = byId(id);
    if (!st) return null;
    st.fav = !st.fav;
    state.favIds = PROTO.STATIONS.filter(s => s.fav).map(s => s.id);
    save();
    return st;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const out = {};
        for (const k of Object.keys(DEFAULTS)) out[k] = state[k];
        localStorage.setItem(KEY, JSON.stringify(out));
      } catch (e) { /* sin persistencia */ }
    }, 120);
  }

  function set(patch, { persist = true } = {}) {
    Object.assign(state, patch);
    if (persist) save();
    return state;
  }

  function setPlan(patch) {
    state.plan = Object.assign({}, state.plan, patch);
    save();
  }

  function setAssistant(patch) {
    state.assistant = Object.assign({}, state.assistant, patch);
    save();
  }

  function reset() {
    Object.assign(state, clone(DEFAULTS));
    state.favIds = SEED_FAVS.slice();
    applyFavs();
    save();
  }

  /* --- Consultas ------------------------------------------------------- */
  const byId = (id) => PROTO.STATIONS.find(s => s.id === id) || null;
  const fuelName = (id) => PROTO.fuelName(id || state.fuel);
  const priceOf = (st, fuel = state.fuel) => PROTO.finalPrice(st, fuel);

  function list(filters = {}) {
    const f = Object.assign({
      province: state.province || undefined,
      locality: state.locality || undefined,
      fuel: state.fuel,
      brands: state.brands,
      maxKm: state.maxKm || 0,
      favoritesOnly: state.favoritesOnly,
      cheapOnly: state.cheapOnly,
      q: state.q || undefined,
    }, filters);
    const out = PROTO.filterStations(PROTO.STATIONS, f);
    return PROTO.sortStations(out, state.sort, state.dir, state.fuel);
  }

  function scoped() {
    /* Universo de análisis: la provincia elegida, sin el resto de filtros.
       Así los KPIs y el asistente no se quedan vacíos al buscar algo. */
    return PROTO.STATIONS.filter(s => !state.province || s.province === state.province);
  }

  const stats = (listIn) => PROTO.stats(listIn || list(), state.fuel);
  const statsScoped = () => PROTO.stats(scoped(), state.fuel);
  const best = (listIn) => (listIn && listIn.length ? PROTO.sortStations(listIn, 'price', 'asc', state.fuel)[0] : PROTO.sortStations(scoped(), 'price', 'asc', state.fuel)[0]);
  const nearest = (listIn) => (listIn && listIn.length ? PROTO.sortStations(listIn, 'distance', 'asc', state.fuel)[0] : PROTO.sortStations(scoped(), 'distance', 'asc', state.fuel)[0]);

  function provinces() {
    return [...new Set(PROTO.STATIONS.map(s => s.province))].sort((a, b) => a.localeCompare(b, 'es'));
  }
  function localities() {
    return [...new Set(PROTO.STATIONS.filter(s => !state.province || s.province === state.province).map(s => s.city))]
      .sort((a, b) => a.localeCompare(b, 'es'));
  }
  function brands() {
    return PROTO.brandsOf(PROTO.STATIONS.filter(s => !state.province || s.province === state.province));
  }
  function fuels() {
    const src = state.province ? PROTO.STATIONS.filter(s => s.province === state.province) : PROTO.STATIONS;
    return PROTO.FUELS.filter(f => src.some(s => s.prices[f.id] != null));
  }

  const fmtL = (v) => v == null ? '—' : Number(v).toFixed(3).replace('.', ',') + ' €/L';
  const fmtEur = (v, d = 2) => v == null ? '—' : Number(v).toFixed(d).replace('.', ',') + ' €';
  const fmt0 = (v) => String(Math.round(v));
  const fmt1 = (v) => Number(v).toFixed(1).replace('.', ',');
  const cents = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v * 100).toFixed(1).replace('.', ',') + ' ¢';
  const safePct = (v) => (isFinite(v) ? v : 0);

  /* --- Comparador ------------------------------------------------------ */
  function compareIds() {
    const valid = state.compare.filter(id => byId(id));
    if (!valid.length) {
      const seeds = [nearest(), best(), PROTO.favorites()[0]].filter(Boolean);
      const out = [];
      for (const s of seeds) if (!out.includes(s.id)) out.push(s.id);
      state.compare = out.slice(0, MAX_COMPARE);
    }
    return state.compare.slice(0, MAX_COMPARE);
  }

  function toggleCompare(id) {
    const ids = compareIds();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
    else {
      if (ids.length >= MAX_COMPARE) ids.shift();
      ids.push(id);
    }
    state.compare = ids;
    save();
    return ids;
  }

  function compareMetrics() {
    const ids = compareIds();
    const rows = ids.map(id => {
      const st = byId(id);
      const price = priceOf(st);
      const km = PROTO.kmFromUser(st);
      return {
        st, id, price, km,
        drive: PROTO.driveMin(km),
        tankCost: price != null ? price * state.litros : null,
        detour: 0,
        detourCost: 0,
        gross: 0,
        net: 0,
        fav: !!st.fav,
        discount: PROTO.brandMeta(st.brand).discount || 0,
      };
    }).filter(r => r.price != null);

    if (!rows.length) return { rows: [], base: null, winner: null, saving: 0, tie: true, worth: false };

    const base = rows.reduce((a, b) => (b.km < a.km ? b : a), rows[0]);
    const grossRef = base.price;
    rows.forEach(r => {
      const extra = r.id === base.id ? 0 : Math.max(0, state.detourExtra || 0);
      r.detour = Math.max(0, r.km - base.km) + extra;
      r.detourCost = (r.detour * 2 / 100) * state.cons * r.price;
      r.gross = (grossRef - r.price) * state.litros;
      r.net = r.gross - r.detourCost;
    });
    const winner = rows.reduce((a, b) => (b.net > a.net ? b : a), rows[0]);
    const saving = winner.net;
    const tie = Math.abs(saving) < 0.5;
    return { rows, base, winner, saving, tie, worth: saving >= 0.5 && winner.id !== base.id };
  }

  /* --- Previsión determinista ----------------------------------------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Previsión a 7 días: regresión lineal sobre las últimas 14 jornadas de la
   * serie sintética + ruido determinista por estación/combustible. No pretende
   * ser un modelo real: enseña cómo se comunica una previsión sin prometerla.
   */
  function forecastFor(st, fuel = state.fuel, days = 7) {
    if (!st) return [];
    const price = priceOf(st, fuel);
    if (price == null) return [];
    const hist = PROTO.series(st, fuel, 28);
    const tail = hist.slice(-14);
    const n = tail.length || 1;
    const xs = tail.map((_, i) => i);
    const ys = tail.map(d => d.price);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    let slope = den ? num / den : 0;
    slope = Math.max(-0.004, Math.min(0.004, slope));
    const rnd = mulberry32(hashStr(st.id + '|' + fuel + '|fc'));
    const out = [];
    for (let d = 0; d < days; d++) {
      const dt = new Date(); dt.setHours(12, 0, 0, 0); dt.setDate(dt.getDate() + d + 1);
      const noise = (rnd() - 0.5) * 0.0035;
      out.push({
        date: dt,
        label: PROTO.ddsmm ? PROTO.ddsmm(dt) : `${dt.getDate()}/${dt.getMonth() + 1}`,
        day: PROTO.dayName ? PROTO.dayName(dt) : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][dt.getDay()],
        price: Math.max(0.2, price + slope * (d + 1) + noise),
      });
    }
    return out;
  }

  function planCalc() {
    const p = state.plan;
    const listNow = scoped();
    const st = best(listNow);
    const price = priceOf(st);
    if (price == null) return null;
    const tank = Math.max(1, p.tank);
    const level = Math.max(0, Math.min(tank, p.level));
    const cons = Math.max(1, p.cons || state.cons);
    const refill = Math.max(0, tank - level);
    const costNow = price * refill;
    const fc = forecastFor(st, state.fuel, 7);
    const future = fc.length ? fc.reduce((a, b) => (b.price < a.price ? b : a), fc[0]) : null;
    const bestPrice = future ? future.price : price;
    const saveWait = Math.max(0, costNow - bestPrice * refill);
    const autonomy = (level / cons) * 100;
    const daysLeft = autonomy / 40;
    const monthTanks = 2;
    const monthCost = tank * price * monthTanks;
    const budgetLeft = Math.max(0, p.budget - p.spent);
    const tanksLeft = budgetLeft / (tank * price || 1);
    const todayIdx = fc.findIndex((d, i) => i === 0 && d.price <= bestPrice + 0.0001);
    const bestIdx = fc.findIndex(d => d.price === bestPrice);

    let advice = 'Reposta cuando puedas: la previsión es plana.';
    let tone = 'neutral';
    if (daysLeft < 2) { advice = 'Te queda menos de un depósito para dos días: reposta hoy.'; tone = 'warn'; }
    else if (bestIdx === 0) { advice = 'Hoy es el mejor día de la semana para llenar el depósito.'; tone = 'ok'; }
    else if (saveWait > 0.8 && bestIdx > 0) { advice = `Esperar al ${fc[bestIdx].day} te ahorra ${fmtEur(saveWait)} en el próximo depósito.`; tone = 'ok'; }
    else if (saveWait <= 0.8) { advice = 'La diferencia entre hoy y el mejor día es mínima: no merece la pena esperar.'; tone = 'neutral'; }

    return {
      st, price, tank, level, cons, refill, costNow, fc, future, bestPrice, saveWait,
      autonomy, daysLeft, monthCost, budgetLeft, tanksLeft, advice, tone,
      bestIdx, todayIdx,
      pct: Math.round((level / tank) * 100),
      litersPer100: cons,
      costPerKm: (cons / 100) * price,
    };
  }

  /* --- Asistente ------------------------------------------------------- */
  /**
   * Puntúa las estaciones de la provincia mezclando precio y distancia según
   * el peso elegido (0 = solo cerca, 100 = solo barato). Devuelve las 3 mejores
   * con motivos legibles para que la recomendación no sea una caja negra.
   */
  function recommend(weight = 55, listIn) {
    const rows = (listIn && listIn.length ? listIn : scoped()).filter(s => priceOf(s) != null);
    if (!rows.length) return [];
    const prices = rows.map(s => priceOf(s));
    const kms = rows.map(s => PROTO.kmFromUser(s));
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const minK = Math.min(...kms), maxK = Math.max(...kms);
    const spread = Math.max(maxP - minP, 0.0001);
    const spanKm = Math.max(maxK - minK, 0.1);
    const w = Math.max(0, Math.min(100, weight)) / 100;

    return rows.map(st => {
      const price = priceOf(st);
      const km = PROTO.kmFromUser(st);
      const meta = PROTO.brandMeta(st.brand);
      const pScore = 1 - (price - minP) / spread;
      const dScore = 1 - (km - minK) / spanKm;
      const rScore = (st.rating || 4) / 5;
      const disc = (meta.discount || 0) > 0 ? 1 : 0;
      const score = w * pScore * 0.72 + (1 - w) * dScore * 0.72 + rScore * 0.16 + disc * 0.12;
      const why = [];
      if (pScore > 0.82) why.push('de las más baratas');
      if (dScore > 0.82) why.push('muy cerca de ti');
      if ((meta.discount || 0) >= 8) why.push(`${meta.discount} ¢ de descuento`);
      if ((st.rating || 0) >= 4.5) why.push(`valoración ${fmt1(st.rating)}`);
      if (st.schedule === '24h') why.push('abierta 24 h');
      if (!why.length) why.push('equilibrio precio-distancia');
      return { st, price, km, score, why, save50: (PROTO.stats(rows, state.fuel).avg - price) * 50 };
    }).sort((a, b) => b.score - a.score);
  }

  /* --- Insights -------------------------------------------------------- */
  function insights() {
    const listNow = scoped();
    const s = PROTO.stats(listNow, state.fuel);
    if (!s) return [];
    const out = [];
    const cheap = best(listNow);
    const near = nearest(listNow);
    const cheapPrice = priceOf(cheap);
    const nearPrice = priceOf(near);
    const save50 = (s.avg - cheapPrice) * state.litros;

    out.push({
      icon: 'trendDown', tone: 'ok',
      title: `${cheap.name} marca el mínimo`,
      text: `${fmtL(cheapPrice)} · ${fmtEur(save50)} menos que la media por ${state.litros} L.`,
      act: 'detalle', id: cheap.id,
    });

    if (near.id !== cheap.id) {
      const detour = Math.max(0, PROTO.kmFromUser(cheap) - PROTO.kmFromUser(near));
      const cost = (detour * 2 / 100) * state.cons * cheapPrice;
      const gross = (nearPrice - cheapPrice) * state.litros;
      const net = gross - cost;
      out.push({
        icon: net > 0 ? 'route' : 'info', tone: net > 0 ? 'ok' : 'warn',
        title: net > 0 ? `El desvío compensa: ${fmtEur(net)} netos` : 'El desvío no compensa',
        text: net > 0
          ? `${PROTO.dist(detour)} extra por trayecto frente a ${near.name}; ${fmtEur(cost)} de combustible.`
          : `${near.name} está a ${PROTO.dist(PROTO.kmFromUser(near))} y el desvío se come ${fmtEur(Math.abs(net))}.`,
        act: 'comparar',
      });
    }

    const tr = PROTO.seriesStats(PROTO.series(cheap, state.fuel, 14));
    if (tr) {
      out.push({
        icon: tr.diff < 0 ? 'trendDown' : tr.diff > 0 ? 'trendUp' : 'minus',
        tone: tr.diff < 0 ? 'ok' : tr.diff > 0 ? 'bad' : 'neutral',
        title: `Tendencia ${tr.diff < 0 ? 'a la baja' : tr.diff > 0 ? 'al alza' : 'plana'} en 14 días`,
        text: `${cents(tr.diff)} en ${cheap.name}. Mínimo ${fmtL(tr.min)} el ${tr.minDate}.`,
        act: 'detalle', id: cheap.id,
      });
    }

    const favs = PROTO.favorites().filter(f => !state.province || f.province === state.province);
    const dropped = favs.map(f => {
      const t = PROTO.seriesStats(PROTO.series(f, state.fuel, 7));
      return t ? { f, diff: t.diff } : null;
    }).filter(Boolean).filter(x => x.diff < -0.002).sort((a, b) => a.diff - b.diff);

    if (dropped.length) {
      const d = dropped[0];
      out.push({
        icon: 'star', tone: 'ok',
        title: `${d.f.name} ha bajado ${cents(d.diff)}`,
        text: `En 7 días. Ahora a ${fmtL(priceOf(d.f))}.`,
        act: 'detalle', id: d.f.id,
      });
    } else if (favs.length) {
      out.push({
        icon: 'star', tone: 'neutral',
        title: `${favs.length} favoritas vigiladas`,
        text: 'Ninguna ha bajado más de 0,2 ¢ en la última semana.',
        act: 'favoritos',
      });
    }

    const stale = listNow.filter(st => st.updatedMin > 25);
    out.push({
      icon: stale.length ? 'alert' : 'check', tone: stale.length ? 'warn' : 'ok',
      title: stale.length ? `${stale.length} estaciones sin publicar` : 'Precios recientes en toda la provincia',
      text: stale.length ? `La más antigua: ${stale[0].name} (${PROTO.since(stale[0].updatedMin)}).` : `Las ${listNow.length} estaciones se actualizaron hace menos de 25 min.`,
      act: 'explorar',
    });

    out.push({
      icon: 'grid', tone: 'neutral',
      title: `${listNow.length} estaciones · ${provinces().length} provincias`,
      text: `Horquilla de ${fmtL(s.min)} a ${fmtL(s.max)}; media ${fmtL(s.avg)}.`,
      act: 'explorar',
    });

    return out;
  }

  /* --- Etiquetas de navegación ---------------------------------------- */
  const TABS = {
    thumb: [
      { id: 'mapa', label: 'Mapa', icon: 'map' },
      { id: 'lista', label: 'Lista', icon: 'list' },
      { id: 'comparar', label: 'Comparar', icon: 'compare' },
      { id: 'plan', label: 'Plan', icon: 'wallet' },
      { id: 'ia', label: 'IA', icon: 'sparkles' },
      { id: 'config', label: 'Ajustes', icon: 'gear' },
    ],
    unified: [
      { id: 'mapa', label: 'Mapa', icon: 'map' },
      { id: 'tabla', label: 'Tabla', icon: 'list' },
      { id: 'ambos', label: 'Ambos', icon: 'columns' },
      { id: 'comparar', label: 'Comparar', icon: 'compare' },
      { id: 'ia', label: 'IA', icon: 'sparkles' },
      { id: 'config', label: 'Config', icon: 'gear' },
    ],
    tower: [
      { id: 'explorar', label: 'Explorar', icon: 'map' },
      { id: 'comparar', label: 'Comparador', icon: 'compare' },
      { id: 'plan', label: 'Planificador', icon: 'wallet' },
      { id: 'asistente', label: 'Asistente', icon: 'sparkles' },
      { id: 'insights', label: 'Insights', icon: 'grid' },
      { id: 'ia', label: 'Chat IA', icon: 'send' },
      { id: 'config', label: 'Configuración', icon: 'gear' },
    ],
  };

  return {
    KEY, DEFAULTS, state, load, save, set, setPlan, setAssistant, reset,
    list, scoped, stats, statsScoped, best, nearest, byId, priceOf, fuelName,
    applyFavs, toggleFav,
    provinces, localities, brands, fuels,
    compareIds, toggleCompare, compareMetrics,
    forecastFor, planCalc, recommend, insights,
    fmtL, fmtEur, fmt0, fmt1, cents, safePct,
    TABS,
  };
})();

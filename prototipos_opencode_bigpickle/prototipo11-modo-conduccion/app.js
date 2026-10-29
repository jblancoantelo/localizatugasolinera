/* Prototipo 11 · Modo Conducción */
(function(){
  'use strict';
  const F = window.FAKE;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const S = {
    prov: '28',
    comb: 'auto',
    km: 5,
    ahorro: false,
    soloFav: false,
    lista: [],
    idx: 0,
    fav: new Set((F.estaciones.filter(e=>e.fav)).map(e=>e.id))
  };

  function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function eur3(v){ return v==null?'—':v.toFixed(3).replace('.',','); }
  function kmf(v){ return v==null?'—':v.toFixed(1).replace('.',',')+' km'; }

  function precioFinal(e){
    let comb = S.comb;
    if(comb==='auto'){
      // elegir más barato entre visibles
      const vs = (F.combustiblesVisibles||[]).map(c=>F.precioConDescuento(e,c)).filter(x=>x!=null);
      if(!vs.length) return null;
      return Math.min.apply(null, vs);
    }
    return F.precioConDescuento(e, comb);
  }

  function precioPara(e, c){
    return F.precioConDescuento(e, c);
  }

  function toast(m){ const t=$('#toast'); t.textContent=m; t.hidden=false; setTimeout(()=>t.hidden=true,1200); }

  function init(){
    $('#prov').innerHTML = F.provincias.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('');
    $('#prov').value = S.prov;
    $('#km').addEventListener('input', e=>{ S.km=Number(e.target.value); $('#kmVal').textContent=S.km+' km'; recalcular(); });
    $$('.pill[data-comb]').forEach(b=>b.addEventListener('click',()=>{
      $$('.pill[data-comb]').forEach(x=>x.classList.toggle('active',x===b));
      S.comb = b.dataset.comb;
      recalcular();
    }));
    $('#modoAhorro').addEventListener('click',e=>{
      S.ahorro = !S.ahorro;
      e.currentTarget.setAttribute('aria-pressed', S.ahorro?'true':'false');
      recalcular();
      toast(S.ahorro?'Modo ahorro activado':'Modo ahorro desactivado');
    });
    $('#soloFav').addEventListener('click',e=>{
      S.soloFav = !S.soloFav;
      e.currentTarget.setAttribute('aria-pressed', S.soloFav?'true':'false');
      recalcular();
    });
    $('#prov').addEventListener('change',e=>{ S.prov=e.target.value; recalcular(); toast('Provincia: '+F.provinciaNombre(S.prov)); });
    $('#btnIr').addEventListener('click',()=>ir());
    $('#btnDet').addEventListener('click',()=>abrirModal(S.idx));
    $('#btnFavHero').addEventListener('click',toggleFavHero);
    $('#modalVelo').addEventListener('click',cerrarModal);
    $('#mCerrar').addEventListener('click',cerrarModal);
    $('#mIr').addEventListener('click',()=>{ if(S.lista[S.idx]) ir(S.lista[S.idx].e); });
    $('#mFav').addEventListener('click',()=>{ toggleFavHero(); cerrarModal(); recalcular(); });
    recalcular();
  }

  function ir(e){
    const est = e || (S.lista[S.idx]&&S.lista[S.idx].e);
    if(!est) return;
    const q = encodeURIComponent(est.nombre+' '+est.direccion+' '+est.localidad);
    // abrir maps en nueva pestaña (funciona en mayoría de navegadores)
    window.open('https://maps.google.com/?q='+q, '_blank');
    toast('Abriendo navegación...');
  }

  function toggleFavHero(){
    const est = S.lista[S.idx]&&S.lista[S.idx].e;
    if(!est) return;
    if(S.fav.has(est.id)){ S.fav.delete(est.id); $('#btnFavHero').setAttribute('aria-pressed','false'); toast('Eliminado de favoritas'); }
    else { S.fav.add(est.id); $('#btnFavHero').setAttribute('aria-pressed','true'); toast('Añadido a favoritas'); }
    recalcular();
  }

  function recalcular(){
    let list = F.estacionesDe(S.prov).map(e=>{
      const pf = precioFinal(e);
      if(pf==null) return null;
      if(S.soloFav && !S.fav.has(e.id)) return null;
      if(e.dist > S.km) return null;
      // score: precio + penalización por distancia
      let score = pf * (1 + e.dist/12);
      if(S.ahorro) score = pf * (1 + e.dist/18); // más peso a precio
      else score = pf * (1 + e.dist/10);
      const pfd = F.precioConDescuento(e, S.comb==='auto' ? (F.combustiblesVisibles.find(c=>F.precioConDescuento(e,c))||'Gasolina 95 E5') : S.comb);
      return { e, pf, pfd, score, dist:e.dist };
    }).filter(Boolean);
    list.sort((a,b)=>a.score-b.score);
    S.lista = list;
    S.idx = 0;
    render();
  }

  function render(){
    const list = S.lista;
    $('#infoCnt').textContent = list.length+' resultados · <'+S.km+' km';
    $('#infoTxt').textContent = list.length? (S.ahorro?'Ordenado por mejor relación precio/distancia':'Ordenado por cercanía+precio'): 'Sin resultados con estos filtros';
    if(!list.length){
      $('#heroMarca').textContent='—'; $('#heroNombre').textContent='Sin estaciones cerca'; $('#heroDir').textContent='Ajusta el radio o los filtros';
      $('#heroPrecio').textContent='—'; $('#heroDist').textContent='—'; $('#heroDesc').textContent='—'; $('#heroHor').textContent='—'; $('#heroLoc').textContent='—';
      $('#carTrack').innerHTML=''; $('#carCnt').textContent='0'; $('#btnFavHero').setAttribute('aria-pressed','false'); return;
    }
    const cur = list[S.idx];
    // hero
    $('#heroMarca').textContent = cur.e.marca;
    $('#heroNombre').textContent = cur.e.nombre;
    $('#heroDir').textContent = cur.e.direccion;
    $('#heroPrecio').textContent = eur3(cur.pf);
    $('#heroDist').textContent = kmf(cur.e.dist);
    $('#heroDesc').textContent = cur.pfd ? eur3(cur.pfd)+' €/L' : '—';
    $('#heroHor').textContent = cur.e.horario;
    $('#heroLoc').textContent = cur.e.localidad;
    $('#btnFavHero').setAttribute('aria-pressed', S.fav.has(cur.e.id)?'true':'false');
    // carousel
    $('#carCnt').textContent = Math.max(0, list.length-1)+' más';
    $('#carTrack').innerHTML = list.slice(1,6).map((it,i)=>{
      const real = S.lista.indexOf(it);
      return `<article class="citem" data-idx="${real}">
        <div class="crow"><span class="cmarca">${esc(it.e.marca)}</span><span class="cdist">${kmf(it.e.dist)}</span></div>
        <div class="cnombre">${esc(it.e.nombre)}</div>
        <div class="cdir">${esc(it.e.localidad)}</div>
        <div class="cpre">${eur3(it.pf)} <small style="font-size:16px;color:var(--txt2)">€/L</small></div>
        <div class="cbtns">
          <button class="cir" data-ir="${real}">IR AQUÍ</button>
          <button class="cdet" data-det="${real}">Detalle</button>
        </div>
      </article>`;
    }).join('');
    $('#carTrack').querySelectorAll('[data-ir]').forEach(b=>b.addEventListener('click',()=>ir(list[Number(b.dataset.ir)].e)));
    $('#carTrack').querySelectorAll('[data-det]').forEach(b=>b.addEventListener('click',()=>abrirModal(Number(b.dataset.det))));
  }

  function abrirModal(idx){
    const it = S.lista[idx]; if(!it) return;
    S.idx = idx;
    const e = it.e;
    $('#mMarca').textContent = e.marca;
    $('#mNombre').textContent = e.nombre;
    $('#mDir').textContent = e.direccion+' · '+e.localidad;
    $('#mPrecio').textContent = eur3(it.pf)+' €/L';
    $('#mDist').textContent = kmf(e.dist);
    const pfd = F.precioConDescuento(e, S.comb==='auto'?'Gasolina 95 E5':S.comb);
    $('#mDesc').textContent = pfd? eur3(pfd)+' €/L':'—';
    $('#mHor').textContent = e.horario;
    $('#mList').innerHTML = (F.combustiblesVisibles||[]).map(c=>{
      const pr = F.precioConDescuento(e,c);
      return `<div class="mitem"><span>${esc(c)}</span><strong>${pr==null?'—':eur3(pr)+' €/L'}</strong></div>`;
    }).join('');
    $('#modal').hidden = false;
  }

  function cerrarModal(){ $('#modal').hidden = true; }

  document.addEventListener('DOMContentLoaded', init);
})();

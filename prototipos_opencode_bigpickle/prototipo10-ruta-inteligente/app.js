/* Prototipo 10 · Ruta inteligente con datos fake */
(function(){
  'use strict';
  const F = window.FAKE;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const S = {
    prov: '28',
    comb: F.combustiblesVisibles[0] || F.combustibles[0],
    origen: '',
    destino: '',
    litros: 40,
    consumo: 5.5,
    desvio: 3,
    idaVuelta: true,
    prioAhorro: true,
    radio: 3,
    tab: 'ruta',
    estilo: 'calles',
    orden: 'total',
    ruta: null,
    opciones: [],
    elegido: null,
    iaProv: 'general',
    ia: { general: [], groq: [], mistral: [], openrouter: [], google: [] }
  };

  function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function eur3(v){ return v==null?'—':v.toFixed(3).replace('.',',')+' €/L'; }
  function eur2(v){ return v==null?'—':v.toFixed(2).replace('.',',')+' €'; }
  function km(v){ return v==null?'—':v.toFixed(1).replace('.',',')+' km'; }
  function min(v){ var m=Math.round(v); var h=Math.floor(m/60); var mm=m%60; return h? h+'h '+mm+'min': mm+' min'; }

  function initSelects(){
    $('#combustible').innerHTML = F.combustiblesVisibles.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
    $('#prov').innerHTML = F.provincias.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('');
    $('#prov').value = S.prov;
    $('#combustible').value = S.comb;
    $('#infoEst').textContent = F.estaciones.length;
    $('#infoProv').textContent = F.provincias.length;
    $('#infoComb').textContent = F.combustiblesVisibles.length;
  }

  function toast(m){ var t=$('#toast'); t.textContent=m; t.hidden=false; setTimeout(()=>t.hidden=true,1400); }

  function setTab(id){
    S.tab=id;
    $$('.tab').forEach(b=>b.classList.toggle('activa', b.dataset.tab===id));
    $$('.panel').forEach(p=>p.classList.toggle('activa', p.id==='panel-'+id));
    if(id==='mapa') dibujarMapa();
    if(id==='lista') renderLista();
  }

  function estacionesProv(){ return F.estacionesDe(S.prov); }

  function precioFinal(e, comb){
    var p = F.precioDe(e, comb);
    if(p==null) return null;
    var d = F.descuentos[e.marca]||0;
    return Math.round((p-d)*1000)/1000;
  }

  function simRuta(){
    // itinerario simulado entre estaciones para dar sensación realista
    var list = estacionesProv().slice();
    // generar puntos "origen/destino" usando dos estaciones
    var orig = list.find(e=>e.id==='1001') || list[0];
    var dest = list.find(e=>e.id==='1010') || list[list.length-1];
    var distTotal = Math.max(25, orig.dist*4 + dest.dist*3);
    var tiempo = distTotal/80*60 + 10;
    S.ruta = { orig, dest, distTotal, tiempo, consumoEst: distTotal*S.consumo/100 };
    $('#rutaInfo').textContent = (S.origen||orig.nombre)+' → '+(S.destino||dest.nombre)+' · '+list.length+' gasolineras candidatas en el área';
    $('#kDist').textContent = km(distTotal);
    $('#kTiempo').textContent = min(tiempo);
    $('#kCons').textContent = (S.ruta.consumoEst).toFixed(1).replace('.',',')+' L';
    return S.ruta;
  }

  function calcular(){
    var r = simRuta();
    var comb = S.comb;
    var litros = Number($('#litros').value)||40;
    var consumo = Number($('#consumo').value)||5.5;
    var desvioMax = Number($('#desvio').value)||3;
    S.litros=litros; S.consumo=consumo; S.desvio=desvioMax;
    var cand = estacionesProv().map(e=>{
      var pf = precioFinal(e, comb);
      if(pf==null) return null;
      // distancia a ruta simulada: más cerca si está entre orig/dest
      var aRuta = Math.max(0.4, e.dist*0.8 + (Math.random()-0.5)*1.2);
      if(aRuta > desvioMax) return null;
      var desvio = aRuta;
      var costeRep = pf * litros;
      var kmViaje = r.distTotal * (S.idaVuelta?2:1);
      var costeViajeComb = pf * (kmViaje*consumo/100);
      var totalViaje = costeRep + costeViajeComb*0.25; // ponderado para priorizar repostaje
      // puntuación: priorizar ahorro total
      var score = (1/pf)*10 - desvio*1.6;
      return { e, pf, aRuta, desvio, costeRep, kmViaje, costeViajeComb, totalViaje, score };
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    if(!cand.length){ toast('Sin estaciones dentro del desvío máximo'); return; }
    S.opciones = cand;
    var best = cand[0];
    S.elegido = best;
    // recomendado
    $('#resumenRuta').hidden = false;
    $('#listaRuta').hidden = false;
    $('#recNombre').textContent = best.e.nombre;
    $('#recDir').textContent = best.e.direccion+' · '+best.e.localidad+' · '+km(best.aRuta)+' desde ruta';
    $('#recPrecio').textContent = eur3(best.pf);
    $('#recCosteRep').textContent = eur2(best.costeRep);
    $('#recCosteViaje').textContent = eur2(best.costeViajeComb*(S.idaVuelta?0.5:0));
    $('#recTotal').textContent = eur2(best.costeRep + (S.idaVuelta?best.costeViajeComb*0.3:0));
    var razon = 'Mejor equilibrio: precio competitivo ('+eur3(best.pf)+') con desvío '+km(best.desvio)+'. ';
    razon += (best.pf < 1.42)?'Muy buen precio para '+comb+'. ':'Buen precio considerando la proximidad a tu ruta.';
    $('#recRazon').textContent = razon;
    // lista
    $('#listaRutaCnt').textContent = cand.length+' opciones';
    $('#listaRutaBody').innerHTML = cand.map((c,i)=>`
      <div class="rfila ${i===0?'activa':''}" data-idx="${i}">
        <div><div class="rnombre">${esc(c.e.nombre)}</div><div class="rmeta">${esc(c.e.marca)} · ${esc(c.e.localidad)}</div></div>
        <div class="rprecio">${eur3(c.pf)}</div>
        <div>${km(c.aRuta)}</div>
        <div>${km(c.desvio)}</div>
        <div>${eur2(c.costeRep)}</div>
        <div>${eur2(c.costeRep + (S.idaVuelta?c.costeViajeComb*0.3:0))}</div>
        <button class="rbot" data-ver="${i}">Ver</button>
      </div>
    `).join('');
    dibujarMapa();
    renderLista();
    setTab('ruta');
    toast('Ruta calculada con '+cand.length+' alternativas');
  }

  function renderLista(){
    var cand = S.opciones.slice();
    var ord = $('#ordLista').value;
    if(ord==='precio') cand.sort((a,b)=>(a.pf-b.pf));
    else if(ord==='dist') cand.sort((a,b)=>(a.aRuta-b.aRuta));
    else if(ord==='marca') cand.sort((a,b)=>(a.e.marca.localeCompare(b.e.marca,'es')));
    else cand.sort((a,b)=>(b.score-a.score));
    $('#tablaBody').innerHTML = cand.map((c,i)=>`
      <tr data-idx="${S.opciones.indexOf(c)}">
        <td><div class="tnombre">${esc(c.e.nombre)}</div><div class="tsub">${esc(c.e.direccion)}</div></td>
        <td>${esc(c.e.marca)}</td>
        <td class="tprecio">${eur3(c.pf)}</td>
        <td>${km(c.aRuta)}</td>
        <td>${km(c.desvio)}</td>
        <td>${eur2(c.costeRep)}</td>
        <td>${eur2(c.costeRep + (S.idaVuelta?c.costeViajeComb*0.3:0))}</td>
        <td><button class="rbot" data-det="${S.opciones.indexOf(c)}">Detalle</button></td>
      </tr>
    `).join('');
  }

  function dibujarMapa(){
    var svg = $('#mapaSvg');
    svg.innerHTML = '<defs><marker id="m" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="rgba(79,155,255,.9)"/></marker></defs><path class="traza" d="M10,70 L35,55 L65,40 L90,25" marker-end="url(#m)"/>';
    var wrap = document.querySelector('#mapaMarc');
    wrap.innerHTML = '';
    if(S.ruta){
      addM(wrap,10,70,'origen','Origen');
      addM(wrap,90,25,'destino','Destino');
    }
    (S.opciones||[]).slice(0,6).forEach((c,i)=>{
      var x = 15 + i*14;
      var y = 65 - i*8;
      var cls = i===0?'mejor':(c.aRuta<2?'alt':'lejos');
      addM(wrap,x,y,cls,c.e.marca+' '+eur3(c.pf));
    });
    function addM(p,x,y,cls,label){
      var d=document.createElement('div'); d.className='marc '+cls; d.style.left=x+'%'; d.style.top=y+'%';
      d.innerHTML='<div class="pin"></div><div class="eti">'+esc(label)+'</div>'; p.appendChild(d);
    }
  }

  function abrirFicha(idx){
    var c = S.opciones[idx]; if(!c) return;
    $('#fMarca').textContent = c.e.marca;
    $('#fNombre').textContent = c.e.nombre;
    $('#fDir').textContent = c.e.direccion+' · '+c.e.localidad+' · '+km(c.e.dist);
    $('#fPrecio').textContent = eur3(c.pf);
    $('#fARuta').textContent = km(c.aRuta);
    $('#fDesvio').textContent = km(c.desvio);
    $('#fCosteRep').textContent = eur2(c.costeRep);
    var pf = precioFinal(c.e, S.comb);
    $('#fPrecios').innerHTML = F.combustiblesVisibles.map(cf=>{
      var pr = precioFinal(c.e, cf);
      return '<div class="fpre"><span>'+esc(cf)+'</span><strong>'+eur3(pr)+'</strong></div>';
    }).join('');
    $('#fRazon').textContent = 'Recomendado por equilibrio entre precio ('+eur3(pf)+'), desvío ('+km(c.desvio)+') y coste total para '+S.litros+' L.';
    $('#ficha').hidden = false;
  }

  function renderIA(){
    var prov = S.iaProv;
    var lista = S.ia[prov]||[];
    var box = $('#iaMsgs');
    box.innerHTML = lista.map(m=>'<div class="msg '+m.r+'"><div class="burbuja">'+esc(m.t).replace(/\n/g,'<br>')+'</div><div class="msg-meta">'+esc(m.m||'')+'</div></div>').join('');
    box.scrollTop = box.scrollHeight;
  }

  function enlazar(){
    $$('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
    $('#btnCalcular').addEventListener('click',calcular);
    $('#btnLimpiarRuta').addEventListener('click',()=>{
      $('#origen').value=''; $('#destino').value=''; $('#resumenRuta').hidden=true; $('#listaRuta').hidden=true;
      S.opciones=[]; S.ruta=null; S.elegido=null; dibujarMapa(); renderLista(); toast('Limpiado');
    });
    $('#recVerMapa').addEventListener('click',()=>setTab('mapa'));
    $('#recDetalle').addEventListener('click',()=>{ var idx=S.opciones.indexOf(S.elegido); if(idx>=0) abrirFicha(idx); });
    $('#listaRutaBody').addEventListener('click',e=>{
      var v=e.target.closest('[data-ver]'); if(v){ setTab('mapa'); toast('Mostrado en mapa'); return; }
    });
    $('#tablaBody').addEventListener('click',e=>{
      var d=e.target.closest('[data-det]'); if(d){ abrirFicha(Number(d.dataset.det)); }
    });
    $('#ordLista').addEventListener('change',renderLista);
    $$('.mapa-ctrl button').forEach(b=>b.addEventListener('click',()=>{
      $$('.mapa-ctrl button').forEach(x=>x.classList.toggle('activo',x===b));
      S.estilo=b.dataset.est; dibujarMapa(); toast('Estilo: '+b.textContent);
    }));
    $('#radio').addEventListener('input',e=>{ S.radio=Number(e.target.value); $('#radioVal').textContent=S.radio+' km'; });
    $('#idaVuelta').addEventListener('change',e=>{ S.idaVuelta=e.target.checked; });
    $('#prioAhorro').addEventListener('change',e=>{ S.prioAhorro=e.target.checked; });
    $('#prov').addEventListener('change',e=>{ S.prov=e.target.value; toast('Provincia: '+F.provinciaNombre(S.prov)); });
    $('#fCerrar').addEventListener('click',()=>$('#ficha').hidden=true);
    $('#fichaVelo').addEventListener('click',()=>$('#ficha').hidden=true);
    $('#iaProv').addEventListener('change',e=>{ S.iaProv=e.target.value; renderIA(); });
    $('#iaForm').addEventListener('submit',e=>{
      e.preventDefault();
      var inp=$('#iaInput'); var txt=inp.value.trim(); if(!txt) return;
      var prov=S.iaProv;
      S.ia[prov].push({r:'user',t:txt,m:''});
      inp.value='';
      renderIA();
      setTimeout(()=>{
        var resp = prov==='general'?'**Ruta óptima:** Con '+S.litros+' L y desvío ≤'+S.desvio+' km, yo miraría primero las estaciones con mejor relación precio/distancia a ruta. Si el ahorro por litro supera ~0,02 €/L, suele compensar desviarse hasta 2-3 km.'
          :'**Análisis:** Para este trayecto, prioriza **coste total** (repostaje + desvío). Con ida y vuelta, el combustible del trayecto puede pesar si repostas poco. Mi recomendación: '+(S.elegido?S.elegido.e.nombre:'calcula primero tu ruta')+'.';
        S.ia[prov].push({r:'ass',t:resp,m:'⏱ '+prov+' · 1,1 s'});
        renderIA();
      },650);
    });
  }

  function iniciar(){
    initSelects();
    enlazar();
    renderIA();
    dibujarMapa();
    setTab('ruta');
  }
  iniciar();
})();

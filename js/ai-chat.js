const AI_PROVIDERS = {
  'groq': {
    key: null,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  'mistral': {
    key: null,
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest', 'open-mistral-nemo', 'ministral-8b-latest'],
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  'openrouter': {
    key: null,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    models: ['nvidia/nemotron-3-ultra-550b-a55b', 'poolside/laguna-m.1'],
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'Precios Gasolina España' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  'google': {
    key: null,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    async send(apiKey, model, messages, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = messages.map(m => ({ parts: [{ text: m.content }] }));
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }), signal });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
    }
  },
  'chrome-nano': {
    key: null,
    endpoint: null,
    defaultModel: 'gemini-nano',
    models: ['gemini-nano'],
    async send(apiKey, model, messages, signal) {
      if (!window.ai || !window.ai.canCreateTextSession) {
        return '<b>Chrome Built-in AI no disponible.</b> Necesitas Chrome Canary/Dev con flags: <code>chrome://flags/#prompt-api-for-gemini-nano</code>';
      }
      const { available } = await window.ai.canCreateTextSession();
      if (available !== 'readily') {
        return '<b>Gemini Nano no está disponible.</b> Descárgalo desde: chrome://components → "Optimization Guide On Device Model" → "Check for update"';
      }
      const session = await window.ai.createTextSession({ systemPrompt: AI_CONTEXT_INSTRUCTION });
      const result = await session.prompt(messages.map(m => m.content).join('\n'));
      session.destroy();
      return result;
    }
  }
};

const AI_KEYS_KEY = 'gasolineras_ai_keys';

const AI_ENCRYPTED_KEYS = {
  'google': 'Mz5HMw1RICFfOxssCBkqOhgjFSAZPTc7ND4FHBhYIAkGN1oAAQstS1leOCkfRQFbJgg6CC4=',
  'groq': 'FRwCLQRdH1xZFlw8HwoQKBpdB1daIz4eJSgNCw1aNDZaHiIIQDssFl4YGVgBQyQbA1cNCgkBMzw=',
  'mistral': 'ESIhBl86GiVYPQMZPFkfC14RRDokHTsxIiYeHQQiPC4=',
  'openrouter': 'AQREHR1EBF5EFF4NEV4LSg1QRlxbEV9YQVkMR15QRAsKEF9eRVsKFAxQE1hQQQlZFA0LQVhQSl9RRwsKS1lfQlhZRFsNRVwIEw=='
};

function xorDecryptBase64(enc, passphrase) {
  try {
    const raw = atob(enc);
    let r = '';
    for (let i = 0; i < raw.length; i++) {
      r += String.fromCharCode(raw.charCodeAt(i) ^ passphrase.charCodeAt(i % passphrase.length));
    }
    return r;
  } catch { return ''; }
}

function tryDecryptDefaultKeys(passphrase) {
  const result = {};
  for (const [provider, enc] of Object.entries(AI_ENCRYPTED_KEYS)) {
    result[provider] = xorDecryptBase64(enc, passphrase);
  }
  // Validate: all decrypted keys should start with expected prefixes
  const prefixes = ['AIza', 'AQ.', 'gsk_', 'cMHt', 'sk-or-'];
  const allValid = Object.values(result).every(k => prefixes.some(p => k.startsWith(p)));
  return allValid ? result : null;
}

function getProviderInputId(provider, prefix) {
  return prefix + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function loadAiApiKeys() {
  try {
    const raw = localStorage.getItem(AI_KEYS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveAiApiKeys(keys) {
  localStorage.setItem(AI_KEYS_KEY, JSON.stringify(keys));
  // Sync to AI_PROVIDERS and config inputs
  for (const [provider, k] of Object.entries(keys)) {
    if (AI_PROVIDERS[provider]) AI_PROVIDERS[provider].key = k;
    const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
    if (cfgInput && cfgInput.value !== k) cfgInput.value = k;
  }
}

function initAiProviderTabs() {
  const tabs = document.querySelectorAll('.ia-provider-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ia-provider-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.iaprovider;
      document.querySelectorAll('.ia-provider-panel').forEach(p => p.classList.remove('active'));
      const panel = document.querySelector('.ia-provider-panel[data-iapanel="' + id + '"]');
      if (panel) panel.classList.add('active');
      updateAiStatus(id);
    });
  });
}

function renderAiKeysConfig() {
  const keys = loadAiApiKeys();
  const passInput = document.getElementById('iaPassphrase');
  const passBtn = document.getElementById('iaLoadKeysBtn');
  const passStatus = document.getElementById('iaPassStatus');
  const reloadBtn = document.getElementById('iaReloadKeysBtn');

  if (passBtn && !passBtn.dataset.listener) {
    passBtn.dataset.listener = '1';
    passBtn.addEventListener('click', handleLoadDefaultKeys);
    passInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLoadDefaultKeys();
    });
  }
  if (reloadBtn && !reloadBtn.dataset.listener) {
    reloadBtn.dataset.listener = '1';
    reloadBtn.addEventListener('click', () => {
      passInput.style.display = 'inline-block';
      passBtn.style.display = 'inline-block';
      reloadBtn.style.display = 'none';
      passStatus.textContent = '🔒 Introduce la contraseña para cargar las claves por defecto';
    });
  }

  if (Object.keys(keys).length === 0) {
    if (passInput) passInput.style.display = 'inline-block';
    if (passBtn) passBtn.style.display = 'inline-block';
    if (reloadBtn) reloadBtn.style.display = 'none';
    if (passStatus) passStatus.textContent = '🔒 Introduce la contraseña para cargar las claves por defecto';
  } else {
    if (passInput) passInput.style.display = 'none';
    if (passBtn) passBtn.style.display = 'none';
    if (reloadBtn) reloadBtn.style.display = 'inline';
    if (passStatus) passStatus.textContent = '✅ Claves cargadas desde almacenamiento';
  }

  for (const provider of Object.keys(AI_PROVIDERS)) {
    if (provider === 'chrome-nano') continue;
    const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
    if (!cfgInput) continue;
    const stored = keys[provider] || '';
    cfgInput.value = stored;
    AI_PROVIDERS[provider].key = stored;
    cfgInput.addEventListener('change', () => {
      const allKeys = loadAiApiKeys();
      allKeys[provider] = cfgInput.value;
      AI_PROVIDERS[provider].key = cfgInput.value;
      saveAiApiKeys(allKeys);
      updateAiStatus(provider);
    });
  }
}

function handleLoadDefaultKeys() {
  const passInput = document.getElementById('iaPassphrase');
  const passBtn = document.getElementById('iaLoadKeysBtn');
  const passStatus = document.getElementById('iaPassStatus');
  const reloadBtn = document.getElementById('iaReloadKeysBtn');
  const pass = passInput ? passInput.value.trim() : '';
  if (!pass) {
    if (passStatus) passStatus.textContent = '❌ Introduce una contraseña';
    return;
  }
  const decrypted = tryDecryptDefaultKeys(pass);
  if (!decrypted) {
    if (passStatus) passStatus.textContent = '❌ Contraseña incorrecta';
    return;
  }
  for (const [provider, k] of Object.entries(decrypted)) {
    AI_PROVIDERS[provider].key = k;
    const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
    if (cfgInput) cfgInput.value = k;
  }
  saveAiApiKeys(decrypted);
  if (passInput) passInput.value = '';
  if (passInput) passInput.style.display = 'none';
  if (passBtn) passBtn.style.display = 'none';
  if (reloadBtn) reloadBtn.style.display = 'inline';
  if (passStatus) passStatus.textContent = '✅ Claves cargadas correctamente';
}

function initAiChat() {
  // First sync keys from config inputs (already populated by renderAiKeysConfig)
  for (const [provider, config] of Object.entries(AI_PROVIDERS)) {
    if (provider !== 'chrome-nano') {
      const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
      if (cfgInput && cfgInput.value) config.key = cfgInput.value;
    }
    const modelSelect = document.getElementById(getProviderInputId(provider, 'iaModel'));
    const input = document.getElementById(getProviderInputId(provider, 'iaInput'));
    const sendBtn = document.getElementById(getProviderInputId(provider, 'iaSend'));
    const messagesEl = document.getElementById(getProviderInputId(provider, 'iaMessages'));

    if (!input || !sendBtn || !messagesEl) continue;

    if (messagesEl.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ia-msg empty';
      empty.textContent = 'Inicia una conversación con ' + provider.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      messagesEl.appendChild(empty);
    }

    const doSend = () => handleAiSend(provider, modelSelect, input, messagesEl, sendBtn);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
    sendBtn.addEventListener('click', doSend);

    updateAiStatus(provider);
  }
}

const AI_ABORT = {};

const AI_CONTEXT_INSTRUCTION = 'Eres un asistente experto en precios de gasolina en España. Responde SIEMPRE en español, de forma clara y concisa (máximo 3 párrafos). Usa los DATOS ACTUALES que se proporcionan a continuación para responder. Si te preguntan por datos históricos o estaciones específicas, busca la información en los datos proporcionados. Si no hay datos suficientes, indícalo claramente.';

async function getAiContext(userText) {
  const lines = [];
  lines.push(AI_CONTEXT_INSTRUCTION);
  lines.push('');

  if (STATE.selectedProv) {
    const provName = STATE.selectedProv;
    const total = STATE.data.length;
    lines.push(`=== DATOS ACTUALES: ${provName} (${total} gasolineras) ===`);
  } else {
    lines.push('=== No hay provincia seleccionada ===');
    lines.push('Sugiere al usuario que seleccione una provincia desde el menú desplegable.');
    return lines.join('\n');
  }

  const stations = STATE.data || [];

  if (STATE.selectedFuel) {
    const group = FUEL_GROUPS[STATE.selectedFuel];
    const fuelDisplay = group ? `${STATE.selectedFuel} (${group.join(', ')})` : STATE.selectedFuel;
    lines.push(`- Filtro combustible activo: ${fuelDisplay}`);
  }
  if (STATE.selectedBrands && STATE.selectedBrands.length) {
    lines.push(`- Filtro marca: ${STATE.selectedBrands.join(', ')}`);
  }
  if (STATE.selectedLoc) {
    lines.push(`- Filtro localidad: ${STATE.selectedLoc}`);
  }
  if (STATE.showFavoritesOnly) {
    lines.push('- Mostrando solo favoritos');
  }

  const fuelName = STATE.selectedFuel || 'Gasolina 95 E5';
  const withPrice = stations
    .map(s => ({ s, p: getSelectedFuelPrice(s) }))
    .filter(x => x.p !== null)
    .sort((a, b) => a.p - b.p);

  if (withPrice.length > 0) {
    lines.push(`\nTOP 30 GASOLINERAS por precio (${fuelName}):`);
    withPrice.slice(0, 30).forEach((x, i) => {
      const s = x.s;
      const parts = [`${i+1}. ${s.Rótulo || 'Sin marca'} - ${x.p.toFixed(3).replace('.', ',')}€/L`];
      if (s.Localidad) parts.push(s.Localidad);
      if (s.Dirección) parts.push(s.Dirección);
      if (s._dist != null) parts.push(`${s._dist.toFixed(1)}km`);
      if (STATE.favorites.includes(s.IDEESS)) parts.push('★');
      lines.push(parts.join(' | '));
    });
  }

  // Cheapest station
  if (withPrice.length > 0) {
    const best = withPrice[0];
    lines.push(`\n🏆 Gasolinera más barata: ${best.s.Rótulo || 'Sin marca'} - ${best.p.toFixed(3).replace('.', ',')}€/L`);
    if (best.s.Localidad) lines.push(`   ${best.s.Localidad}, ${best.s.Dirección || ''}`);
  }

  // Favorites with prices
  try {
    const favs = await dbGetAllFavorites();
    if (favs.length > 0) {
      lines.push(`\n=== FAVORITOS (${favs.length}) ===`);
      favs.forEach((f, i) => {
        const parts = [`${i+1}. ${f.Rótulo || 'Sin marca'}`];
        let anyPrice = false;
        for (const [n, key] of FUEL_NAMES) {
          const p = getFuelPrice(f, key);
          if (p !== null) {
            parts.push(`${n}: ${p.toFixed(3).replace('.', ',')}€/L`);
            anyPrice = true;
          }
        }
        if (!anyPrice) parts.push('(sin precios)');
        if (f.Localidad) parts.push(f.Localidad);
        lines.push(parts.join(' | '));
      });
    }
  } catch {}

  // Pre-fetch history data if user query mentions history
  if (/\b(histori|evoluci|tendencia|cambio|subi|baj|ayer|semana|mes|gráfic|chart|trend)\b/i.test(userText)) {
    lines.push('\n=== DATOS HISTÓRICOS ===');
    try {
      if (STATE.selectedProv) {
        const historyData = await fetchProvinceHistory(STATE.selectedProv, STATE.historyDays || 14);
        if (historyData && Object.keys(historyData).length > 0) {
          const dates = Object.keys(historyData).sort();
          lines.push(`Histórico de ${dates.length} días para ${STATE.selectedProv}:`);
          for (const dateStr of dates.slice(-7)) {
            const list = historyData[dateStr];
            if (list && list.length) {
              const prices = list
                .map(s => getSelectedFuelPrice(s))
                .filter(p => p !== null);
              if (prices.length) {
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                lines.push(`  ${dateStr}: media ${avg.toFixed(3).replace('.', ',')}€/L | mínimo ${min.toFixed(3).replace('.', ',')}€/L | máximo ${max.toFixed(3).replace('.', ',')}€/L`);
              }
            }
          }
        } else {
          lines.push('  No hay datos históricos disponibles en caché.');
        }
      }
    } catch (e) {
      lines.push('  Error al recuperar histórico: ' + e.message);
    }
  }

  return lines.join('\n');
}

function getMessagesForProvider(provider) {
  const el = document.getElementById(getProviderInputId(provider, 'iaMessages'));
  if (!el) return [];
  const msgs = [];
  el.querySelectorAll('.ia-msg:not(.empty):not(.loading)').forEach(m => {
    const role = m.classList.contains('user') ? 'user' : 'assistant';
    msgs.push({ role, content: m.textContent });
  });
  return msgs;
}

function editAiMessage(provider, msgEl, input) {
  const text = msgEl.textContent.replace('✎', '').trim();
  let el = msgEl.nextElementSibling;
  while (el) {
    const next = el.nextElementSibling;
    el.remove();
    el = next;
  }
  msgEl.remove();
  input.value = text;
  input.focus();
}

function cancelAiMessage(provider, loadingEl) {
  if (AI_ABORT[provider]) {
    AI_ABORT[provider].abort();
    delete AI_ABORT[provider];
  }
  loadingEl.remove();
  const input = document.getElementById(getProviderInputId(provider, 'iaInput'));
  const sendBtn = document.getElementById(getProviderInputId(provider, 'iaSend'));
  if (input) input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
}

async function handleAiSend(provider, modelSelect, input, messagesEl, sendBtn) {
  const text = input.value.trim();
  if (!text) return;

  const config = AI_PROVIDERS[provider];
  const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
  const apiKey = (cfgInput && cfgInput.value) || config.key;
  const model = modelSelect ? modelSelect.value : config.defaultModel;

  if (provider !== 'chrome-nano' && !apiKey) {
    addAiMessage(messagesEl, 'Por favor, introduce una API Key válida en Config → IA.', 'error');
    return;
  }

  const empty = messagesEl.querySelector('.ia-msg.empty');
  if (empty) empty.remove();

  addAiMessage(messagesEl, text, 'user', provider, input);
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  const loading = addAiMessage(messagesEl, 'Pensando... <button class="ia-cancel-btn" data-provider="' + provider + '">Cancelar</button>', 'loading', provider, input);
  const cancelBtn = loading.querySelector('.ia-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => cancelAiMessage(provider, loading));

  const abort = new AbortController();
  AI_ABORT[provider] = abort;

  try {
    const allMessages = getMessagesForProvider(provider);
    const context = await getAiContext(text);
    const contextMsg = { role: 'system', content: context };
    const augmentedMessages = [contextMsg, ...allMessages];
    const result = await config.send(apiKey, model, augmentedMessages, abort.signal);
    if (abort.signal.aborted) return;
    loading.remove();
    addAiMessage(messagesEl, result, 'assistant', provider, input);
    updateAiStatus(provider, '✅ Listo');
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (loading.parentNode) loading.remove();
    addAiMessage(messagesEl, '❌ Error: ' + err.message, 'error');
    updateAiStatus(provider, '❌ Error');
  } finally {
    delete AI_ABORT[provider];
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function addAiMessage(container, text, className, provider, input) {
  const div = document.createElement('div');
  div.className = 'ia-msg ' + className;
  div.innerHTML = text;
  if (className === 'user' && provider) {
    const editBtn = document.createElement('button');
    editBtn.className = 'ia-edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'Editar mensaje';
    editBtn.addEventListener('click', () => editAiMessage(provider, div, input));
    div.appendChild(editBtn);
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function updateAiStatus(provider, override) {
  const id = getProviderInputId(provider, 'iaStatus');
  const el = document.getElementById(id);
  if (!el) return;
  if (override) { el.textContent = override; return; }
  const config = AI_PROVIDERS[provider];
  if (provider === 'chrome-nano') {
    el.textContent = window.ai ? '✅ Gemini Nano disponible' : '❌ No disponible (Chrome Canary/Dev)';
    return;
  }
  const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
  const hasKey = cfgInput ? !!cfgInput.value : !!config.key;
  el.textContent = hasKey ? '✅ API Key configurada' : '⚠️ Sin API Key — ve a Config → IA';
}

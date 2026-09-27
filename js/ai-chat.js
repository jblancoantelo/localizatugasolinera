const AI_PROVIDERS = {
  'groq': {
    key: null,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    listModelsUrl: 'https://api.groq.com/openai/v1/models',
    defaultModel: 'qwen/qwen3.8-27b',
    models: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'allam-2-7b'],
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) throw await aiHttpError(res);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  'mistral': {
    key: null,
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    listModelsUrl: 'https://api.mistral.ai/v1/models',
    defaultModel: 'open-mistral-nemo',
    models: ['open-mistral-nemo', 'ministral-8b-latest', 'codestral-latest', 'mistral-small-latest', 'mistral-medium-latest'],
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) throw await aiHttpError(res);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  'openrouter': {
    key: null,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    listModelsUrl: 'https://openrouter.ai/api/v1/models',
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    models: ['nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    // OpenRouter lista TODOS los modelos (miles, casi todos de pago): quedarnos
    // solo con los :free evita volcar el desplegable con 3000 entradas
    async parseModels(data) {
      return (data.data || []).filter(m => String(m.id).endsWith(':free')).map(m => m.id);
    },
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'Precios Gasolina España' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) throw await aiHttpError(res);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  // LLM7.io (https://llm7.io). Se eligio como sustituto de NVIDIA porque SI
  // devuelve Access-Control-Allow-Origin y se puede llamar desde el navegador
  // sin proxy ni backend. Comprobado en Chromium: NVIDIA, Cerebras, Chutes,
  // Z.ai, SambaNova y Cloudflare AI bloquean el preflight; LLM7 responde 401
  // (la peticion llega de verdad) cuando la clave no vale.
  //
  // La API Key es OPCIONAL: sin ella se envia el literal "unused" y se accede
  // en modo anonimo (500k tokens/24 h, 1 peticion/s, 10/min, 60/h). Con un
  // token gratuito de dash.llm7.io el limite sube a 1M tokens/24 h.
  'llm7': {
    key: null,
    endpoint: 'https://api.llm7.io/v1/chat/completions',
    listModelsUrl: 'https://api.llm7.io/v1/models',
    keyOptional: true,
    anonymousKey: 'unused',
    // El GET de /v1/models solo admite las cabeceras "If-None-Match" y
    // "Content-Type" en su preflight: si se manda Authorization el navegador
    // lo rechaza y el catalogo falla con ERR_FAILED. El endpoint es publico,
    // asi que se pide sin cabecera (da los 64 modelos) y la clave solo se usa
    // para el chat, cuyo POST si admite "authorization".
    listModelsNoAuth: true,
    defaultModel: 'codestral-latest',
    // Verificados uno a uno contra la API el 2026-09-27 (con "unused").
    // codestral-latest es el default porque no es "reasoning" y responde en
    // el acto; GLM-5.3-Flash y minimax-m2.7 razonan antes y se quedan sin
    // tokens si la pregunta es larga.
    models: ['codestral-latest', 'GLM-5.3-Flash', 'minimax-m2.7', 'mistral-Nemo-Instruct-2407'],
    // DeepSeek-V4-Flash-0731 aparece como "turbo" pero devuelve 401
    // "invalid_api_key" aunque la clave sea valida, asi que se filtra.
    unavailable: ['DeepSeek-V4-Flash-0731'],
    // /models marca cada modelo con `tier`. Solo los "turbo" son accesibles
    // sin pagar: los "pro" (claude, gpt-5.5, gemini-3.8-flash-high, kimi-k3...)
    // responden 403 sin la suscripcion de $12 o saldo. Sin este filtro el
    // desplegable se llena de 59 modelos que no funcionan. El descarte de audio
    // e imagen lo hace despues isAiModelChatCandidate(), commun a todos.
    async parseModels(data) {
      return (data.data || [])
        .filter(m => String(m.tier || '').toLowerCase() === 'turbo')
        .filter(m => !this.unavailable.includes(m.id))
        .map(m => m.id);
    },
    async send(apiKey, model, messages, signal) {
      const res = await fetch('https://api.llm7.io/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }), signal
      });
      if (!res.ok) throw await aiHttpError(res);
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const content = (msg?.content || '').trim();
      if (content) return content;
      // Los modelos "reasoning" (GLM-5.3-Flash, minimax-m2.7) pueden gastar
      // todo el presupuesto pensando y devolver content vacio.
      if (msg?.reasoning_content) {
        return '<b>' + model + ' se pasó el tiempo pensando y no llegó a responder.</b>'
          + '<br><span class="ia-warn-detail">Es un modelo de razonamiento: consume el máximo de tokens para pensar antes de contestar. Prueba con Codestral Latest o formula una pregunta más corta.</span>';
      }
      return '(sin respuesta)';
    }
  },
  'google': {
    key: null,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    listModelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-3.8-flash',
    models: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'],
    async send(apiKey, model, messages, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = messages.map(m => ({ parts: [{ text: m.content }] }));
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }), signal });
      if (!res.ok) throw await aiHttpError(res);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
    },
    // Google no usa el esquema OpenAI: /models devuelve { models: [{ name: "models/x", supportedGenerationMethods: [] }] }
    async parseModels(data) {
      return (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));
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
  'google': 'MyYTEzwQMDgxJ0JcJw4xEVwmICFeCAEcKl0+JSAvXwwKCwQBGlkk',
  'groq': 'FRwCLS0cBxkFKAEiICkuJV4ZRi4/GwkZJSgNCw1aNDYwORZfIyoiJj0sEV8cJAdYGBYfPwgYEwk=',
  'mistral': 'ESIhBl86GiVYPQMZPFkfC14RRDokHTsxIiYeHQQiPC4=',
  'openrouter': 'AQREHR1EBF5EFF4NEV4LSg1QRlxbEV9YQVkMR15QRAsKEF9eRVsKFAxQE1hQQQlZFA0LQVhQSl9RRwsKS1lfQlhZRFsNRVwIEw=='
};

// Prefijo obligatorio de la API key segun proveedor (evita guardar una clave
// del proveedor equivocado, que solo fallaria al enviar la peticion).
// llm7 NO aparece: su clave es opcional y no tiene prefijo reconocible.
const AI_KEY_PREFIXES = {
  'google': ['AIza'],
  'groq': ['gsk_'],
  'mistral': ['cMHt'],
  'openrouter': ['sk-or-v1-']
};

function isAiKeyFormatValid(provider, key) {
  const prefixes = AI_KEY_PREFIXES[provider];
  if (!prefixes) return true;
  if (!key) return false;
  return prefixes.some(p => key.startsWith(p));
}

// Clave con la que se llama a un proveedor ahora mismo: la del input de Config,
// la guardada al cargar las claves por defecto o, si el proveedor no la
// necesita, su literal de acceso anonimo (llm7 usa "unused").
function aiApiKey(provider) {
  const config = AI_PROVIDERS[provider];
  const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
  const key = (cfgInput && cfgInput.value) || (config && config.key) || '';
  if (!key && config && config.anonymousKey) return config.anonymousKey;
  return key;
}

// Un proveedor con clave opcional esta listo siempre (accede en anonimo); el
// resto, en cuanto tenga una clave.
function isAiProviderReady(provider) {
  const config = AI_PROVIDERS[provider];
  if (!config) return false;
  if (config.keyOptional) return true;
  const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
  return !!(cfgInput && cfgInput.value ? cfgInput.value : config.key);
}

function aiProviderNotReadyMessage(provider) {
  return 'Por favor, introduce una API Key válida en Config → IA.';
}

// Convierte una respuesta de error de la API en un Error con mensaje util.
// Muchas APIs devuelven texto plano o HTML en error (p.ej. "404 page not
// found"), y llamar a res.json() ahi lanzaria un error generico que oculta la
// causa real.
async function aiHttpError(res) {
  let detail = '';
  try {
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      detail = j.error?.message || j.message || j.detail || j.title || '';
    } catch { detail = body.slice(0, 200); }
  } catch { detail = ''; }
  return new Error(detail.trim() || `HTTP ${res.status}`);
}

/* ==========================================================================
   Auto-refresh de modelos por proveedor
   Los catálogos de modelos gratuitos rotan constantemente y además dependen de
   la cuenta (en LLM7 solo 4 de los 64 ids son "turbo" y uno de ellos esta
   roto). Una lista fija en el código se queda obsoleta y rompe la app. Por eso:
     1. Se consulta /models del proveedor y se cachea en localStorage (24 h).
     2. Se mezcla con la lista fija (esa gana: son los defaults que funcionan).
     3. Si el modelo elegido ya no está, se avisa y se ofrece la lista nueva.
   ========================================================================== */

const AI_MODELS_CACHE_KEY = 'gasolineras_ai_models';
const AI_MODELS_TTL = 24 * 60 * 60 * 1000;

// Patrones de error que significan "el modelo ya no existe / no disponible".
// Especificos del proveedor cuando se puede, genericos como red de seguridad.
const AI_MODEL_ERROR_RE = /model_not_found|model not found|model .*not found|no such model|unknown model|invalid model|model .*(does not exist|no longer|not supported|deprecat|retired|is gone|end of life|end-of-life|eol|unavailable|currently unavailable|not available)|unsupported model|function .*not found|^404\b|\b404\b.*model|\b410\b.*model/i;

// Modelos que los catalogos remotos devuelven pero que NO sirven para chat
// (embeddings, vision-only, guardas de seguridad, audio, imagen, video...):
// "nemo-" se quito del filtro: tambien colgaba de "mistral-Nemo-Instruct-2407",
// que si sirve para chat. Los NeMo de NVIDIA quedan fuera por embed/parse/etc.
const AI_NON_CHAT_RE = /embed|guard|safety|nemoretriev|nvclip|clip-|deplot|recontext|retriev|rerank|whisper|tts|stt|vision-instruct|guardrail|parse|reward|classifier|tokeniz|arctic|palmyra|codebe|\bbge\b|bge-|gte-|stella|nomic|jina|\bnsfw\b|voxtral|seedance|seedream|kling|gpt-image|chroma|krea|inkling/i;

function isAiModelChatCandidate(id) {
  if (!id) return false;
  return !AI_NON_CHAT_RE.test(id);
}

function aiModelLabel(id) {
  const bare = id.replace(/:free$/, '');
  const parts = bare.split('/');
  const name = parts[parts.length - 1];
  return (id.endsWith(':free') ? name + ' (gratis)' : name);
}

function loadAiModelsCache() {
  try {
    const raw = localStorage.getItem(AI_MODELS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

function saveAiModelsCache(provider, models) {
  try {
    const cache = loadAiModelsCache();
    cache[provider] = { at: Date.now(), models };
    localStorage.setItem(AI_MODELS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function invalidateAiModelsCache(provider) {
  try {
    const cache = loadAiModelsCache();
    if (!cache[provider]) return;
    delete cache[provider];
    localStorage.setItem(AI_MODELS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function getAiCachedModels(provider) {
  const entry = loadAiModelsCache()[provider];
  if (!entry || !Array.isArray(entry.models) || !entry.models.length) return null;
  return entry;
}

function isAiModelsCacheStale(provider) {
  const entry = getAiCachedModels(provider);
  if (!entry) return true;
  return Date.now() - (entry.at || 0) > AI_MODELS_TTL;
}

// Descarga el catalogo real del proveedor. Devuelve el array de ids.
async function fetchAiModels(provider, apiKey, signal) {
  const config = AI_PROVIDERS[provider];
  if (!config || !config.listModelsUrl) return null;
  const base = config.listModelsUrl;
  const url = provider === 'google'
    ? `${base}?key=${encodeURIComponent(apiKey)}&pageSize=200`
    : base;
  const headers = { 'Accept': 'application/json' };
  if (provider !== 'google' && !config.listModelsNoAuth) headers['Authorization'] = 'Bearer ' + apiKey;
  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw await aiHttpError(res);
  const data = await res.json();
  // .call(config) para que parseModels pueda leer sus propias opciones (p.ej. la
  // lista de ids rotos de LLM7). El await es obligatorio: los parseModels
  // personalizados son async y sin el se intentaria hacer .filter a una Promise.
  const parse = config.parseModels || (d => (d.data || []).map(m => m.id));
  return ((await parse.call(config, data)) || []).filter(isAiModelChatCandidate);
}

// Rellena el <select> de modelos: primero la lista fija del proveedor (los
// defaults verificados), despues los del catalogo remoto sin duplicar.
function populateAiModelSelect(provider, remoteModels) {
  const select = document.getElementById(getProviderInputId(provider, 'iaModel'));
  if (!select) return { missing: null, previous: null };
  const config = AI_PROVIDERS[provider];
  const previous = select.value;
  const base = (config.models || []).slice();
  const all = base.slice();
  for (const m of remoteModels || []) {
    if (!all.includes(m)) all.push(m);
  }
  select.innerHTML = '';
  for (const id of all) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = aiModelLabel(id);
    select.appendChild(opt);
  }
  // Si el modelo que se estaba usando ya no existe en el catalogo, se avisa
  // con el_flag pero NO se cambia solo: puede seguir siendo valido (p.ej. un
  // modelo de pago que no aparece en /models) y el usuario decide.
  const remote = remoteModels || null;
  const missing = (previous && remote && !remote.includes(previous)) ? previous : null;
  if (missing) {
    const opt = [...select.options].find(o => o.value === missing);
    if (opt) opt.textContent += ' ⚠️ no disponible';
    select.value = missing;
  } else if (previous && all.includes(previous)) {
    select.value = previous;
  } else {
    select.value = config.defaultModel;
  }
  return { missing, previous };
}

// Refresca el catalogo de un proveedor y repinta el desplegable.
// force=true ignora la cache. Devuelve { ok, models, missing, error }.
async function refreshAiModels(provider, opts = {}) {
  const config = AI_PROVIDERS[provider];
  if (!config || !config.listModelsUrl) return { ok: false, models: null, reason: 'unsupported' };
  const apiKey = aiApiKey(provider);
  if (!apiKey) return { ok: false, models: null, reason: 'nokey' };

  if (!opts.force) {
    const cached = getAiCachedModels(provider);
    if (cached && !isAiModelsCacheStale(provider)) {
      const res = populateAiModelSelect(provider, cached.models);
      markAiModelsStatus(provider, '📋 ' + cached.models.length + ' modelos (caché)');
      return { ok: true, models: cached.models, missing: res.missing, fromCache: true };
    }
  }

  setAiRefreshButton(provider, true);
  try {
    const models = await fetchAiModels(provider, apiKey, opts.signal);
    if (!models || !models.length) {
      markAiModelsStatus(provider, '⚠️ Catálogo vacío');
      return { ok: false, models: null, reason: 'empty' };
    }
    saveAiModelsCache(provider, models);
    const res = populateAiModelSelect(provider, models);
    markAiModelsStatus(provider, '📋 ' + models.length + ' modelos');
    return { ok: true, models, missing: res.missing };
  } catch (e) {
    markAiModelsStatus(provider, '⚠️ ' + e.message.slice(0, 40));
    return { ok: false, models: null, error: e };
  } finally {
    setAiRefreshButton(provider, false);
  }
}

function setAiRefreshButton(provider, busy) {
  const btn = document.getElementById(getProviderInputId(provider, 'iaRefreshModels'));
  if (!btn) return;
  btn.disabled = !!busy;
  btn.textContent = busy ? '⏳' : '🔄';
}

function markAiModelsStatus(provider, text) {
  const el = document.getElementById(getProviderInputId(provider, 'iaModelsStatus'));
  if (el) el.textContent = text;
}

// Refresco silencioso al abrir la pestaña del proveedor: si el proveedor no
// esta listo (sin clave) se deja el desplegable con la lista fija; si lo esta,
// se sincroniza con el catalogo real (usando la cache).
function autoRefreshAiModels(provider) {
  if (!AI_PROVIDERS[provider] || !AI_PROVIDERS[provider].listModelsUrl) return;
  if (!isAiProviderReady(provider)) return;
  refreshAiModels(provider).then(res => {
    if (res.ok && res.missing) {
      warnAiModelUnavailable(provider, res.missing, 'El catálogo de ' + provider + ' ya no lo incluye.');
    }
  });
}

function initAiModelRefreshButtons() {
  for (const provider of Object.keys(AI_PROVIDERS)) {
    if (!AI_PROVIDERS[provider].listModelsUrl) continue;
    const btn = document.getElementById(getProviderInputId(provider, 'iaRefreshModels'));
    if (!btn || btn.dataset.listener) continue;
    btn.dataset.listener = '1';
    btn.title = 'Actualizar la lista de modelos desde ' + provider;
    btn.addEventListener('click', async () => {
      const res = await refreshAiModels(provider, { force: true });
      const messagesEl = document.getElementById(getProviderInputId(provider, 'iaMessages'));
      if (!messagesEl) return;
      if (res.ok) {
        addAiMessage(messagesEl, '✅ Catálogo actualizado: <b>' + res.models.length + '</b> modelos disponibles en ' + provider + '.', 'info');
      } else if (res.reason === 'nokey') {
        addAiMessage(messagesEl, '⚠️ ' + aiProviderNotReadyMessage(provider), 'warn');
      } else {
        addAiMessage(messagesEl, '❌ No se pudo actualizar el catálogo: ' + ((res.error && res.error.message) || res.reason), 'error');
      }
    });
  }
}

// Aviso en el chat: el modelo fallo o ya no existe, y se ofrece la lista nueva.
function warnAiModelUnavailable(provider, model, detail, onRefreshed) {
  const messagesEl = document.getElementById(getProviderInputId(provider, 'iaMessages'));
  if (!messagesEl) return;
  const div = document.createElement('div');
  div.className = 'ia-msg warn';
  const label = provider.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  div.innerHTML = '⚠️ <b>El modelo <code>' + model + '</code> ya no está disponible en ' + label + '.</b>'
    + (detail ? '<br><span class="ia-warn-detail">' + detail + '</span>' : '')
    + '<br><button class="ia-warn-btn">🔄 Ver los modelos disponibles ahora</button>';
  const btn = div.querySelector('.ia-warn-btn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '⏳ Consultando…';
    const res = await refreshAiModels(provider, { force: true });
    if (res.ok) {
      // El aviso ya cumplio su funcion: se sustituye por la confirmacion
      div.remove();
      addAiMessage(messagesEl, '📋 Hay <b>' + res.models.length + '</b> modelos disponibles en ' + label + '. El desplegable de arriba ya está actualizado — elige uno y vuelve a enviar tu mensaje.', 'info');
      if (typeof onRefreshed === 'function') onRefreshed(res);
    } else {
      addAiMessage(messagesEl, '❌ No se pudo consultar el catálogo: ' + ((res.error && res.error.message) || res.reason || 'sin conexión'), 'error');
      btn.remove();
    }
  });
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

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

// Devuelve { keys, invalid } si la contrasena es correcta, o null si es incorrecta.
// Se considera incorrecta cuando NINGUN descifrado tiene el prefijo de su
// proveedor: una contrasena valida puede fallar solo en un proveedor si ese
// blob esta corrupto o contiene una clave de otro servicio.
function tryDecryptDefaultKeys(passphrase) {
  const keys = {};
  for (const [provider, enc] of Object.entries(AI_ENCRYPTED_KEYS)) {
    keys[provider] = xorDecryptBase64(enc, passphrase);
  }
  const invalid = Object.keys(keys).filter(p => !isAiKeyFormatValid(p, keys[p]));
  if (invalid.length === Object.keys(keys).length) return null;
  return { keys, invalid };
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

function saveAiApiKeys(keys, invalid = []) {
  const stored = {};
  for (const [provider, k] of Object.entries(keys)) {
    // No persistir claves vacias: dejarian la UI creyendo que hay claves cargadas
    if (!k || invalid.includes(provider)) continue;
    stored[provider] = k;
  }
  localStorage.setItem(AI_KEYS_KEY, JSON.stringify(stored));
  // Sync to AI_PROVIDERS and config inputs
  for (const [provider, k] of Object.entries(stored)) {
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
      autoRefreshAiModels(id);
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
      // El catalogo de modelos depende de la cuenta (una clave puede dar acceso
      // a modelos que otra no), asi que se invalida al cambiarla.
      invalidateAiModelsCache(provider);
      autoRefreshAiModels(provider);
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
  const { keys, invalid } = decrypted;
  for (const [provider, k] of Object.entries(keys)) {
    if (invalid.includes(provider)) continue;
    AI_PROVIDERS[provider].key = k;
    const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
    if (cfgInput) cfgInput.value = k;
    updateAiStatus(provider);
  }
  saveAiApiKeys(keys, invalid);
  if (passInput) passInput.value = '';
  if (passInput) passInput.style.display = 'none';
  if (passBtn) passBtn.style.display = 'none';
  if (reloadBtn) reloadBtn.style.display = 'inline';
  if (passStatus) {
    passStatus.textContent = invalid.length
      ? '⚠️ ' + invalid.length + ' clave(s) con formato incorrecto (' + invalid.join(', ') + '). Introdúcelas a mano en sus campos.'
      : '✅ Claves cargadas correctamente';
  }
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
  const apiKey = aiApiKey(provider);
  const model = modelSelect ? modelSelect.value : config.defaultModel;

  if (provider !== 'chrome-nano' && !isAiProviderReady(provider)) {
    addAiMessage(messagesEl, aiProviderNotReadyMessage(provider), 'error');
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
    // Si el fallo es por el modelo (retirado, no disponible para esta cuenta o
    // inexistente) no basta con mostrar el error: se ofrece el catalogo nuevo.
    if (AI_MODEL_ERROR_RE.test(err.message || '')) {
      addAiMessage(messagesEl, '❌ Error: ' + err.message, 'error');
      warnAiModelUnavailable(provider, model, err.message);
    } else {
      addAiMessage(messagesEl, '❌ Error: ' + err.message, 'error');
    }
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
  if (config.keyOptional) {
    const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
    el.textContent = (cfgInput && cfgInput.value)
      ? '✅ API Key configurada'
      : 'ℹ️ Sin clave: acceso anónimo (500k tokens/día)';
    return;
  }
  const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
  const key = cfgInput && cfgInput.value ? cfgInput.value : (config.key || '');
  if (!key) {
    el.textContent = '⚠️ Sin API Key — ve a Config → IA';
  } else if (!isAiKeyFormatValid(provider, key)) {
    el.textContent = '❌ Formato de clave incorrecto para ' + provider + ' (debe empezar por ' + AI_KEY_PREFIXES[provider][0] + ')';
  } else {
    el.textContent = '✅ API Key configurada';
  }
}

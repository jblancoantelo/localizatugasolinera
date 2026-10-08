// Varios modelos gratuitos de estos proveedores son "reasoning": gastan el
// presupuesto de max_tokens pensando y devuelven `content` vacío. En vez de
// dejar el chat en blanco se explica y se sugiere un modelo que responda ya.
// `alternativeModel` es lo que se le ofrece al usuario en ese mensaje.
function aiModelReply(model, data, alternativeModel) {
  const msg = data.choices?.[0]?.message;
  const content = (msg?.content || '').trim();
  if (content) return content;
  if (msg?.reasoning_content) {
    return '**' + model + ' se pasó el tiempo pensando y no llegó a responder.**\n\n'
      + 'Es un modelo de razonamiento: consume el máximo de tokens para pensar antes de contestar. Prueba con ' + alternativeModel + ' o formula una pregunta más corta.';
  }
  return '(sin respuesta)';
}

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
      return aiModelReply(model, data, 'Qwen 3.8 27B');
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
      return aiModelReply(model, data, 'Mistral Nemo');
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
      return aiModelReply(model, data, 'Nemotron 3 Ultra (gratis)');
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
      return aiModelReply(model, data, 'Codestral Latest');
    }
  },
  // NVIDIA NIM (build.nvidia.com) es el unico de la lista con catalogo grande
  // (82 ids) y cuota gratis por cuenta, pero su gateway SOLO devuelve
  // Access-Control-Allow-Origin cuando el origen de la peticion es
  // https://build.nvidia.com. Comprobado con OPTIONS y con Chromium real: desde
  // cualquier otra pagina no llega la cabecera y el navegador aborta con
  // "No 'Access-Control-Allow-Origin' header", asi que no sirve sin proxy.
  // La solucion es un proxy propio (workers/nvidia-proxy.js, un Cloudflare
  // Worker) que guarda la clave nvapi- en un secreto y la anade al reenviar.
  // Por eso viaProxy: aqui no hay API Key, solo la URL del Worker.
  'nvidia': {
    key: null,
    viaProxy: true,
    endpoint: '/v1/chat/completions',
    listModelsUrl: '/v1/models',
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    // Verificados uno a uno contra la API real el 2026-09-27. El catalogo
    // lista 82 ids pero muchos devuelven 404 "Function not found for account"
    // (no estan desplegados para una cuenta nueva): kimi-k2.6,
    // deepseek-v4.1-flash, nemotron-4-340b-instruct, nemotron-nano-3-30b-a3b,
    // nemotron-ultra-253b-v1, gemma-3-12b-it, phi-3.5-moe-instruct...
    models: ['nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'moonshotai/kimi-k3', 'z-ai/glm-5.3', 'z-ai/glm-5.3-flash', 'openai/gpt-oss-20b'],
    async send(apiKey, model, messages, signal) {
      // max_tokens alto a proposito: varios de estos modelos razonan antes de
      // responder y con 1024 se quedaban sin tokens (glm-5.3-flash consumia
      // ~1000 caracteres solo en razonamiento y devolvia content vacio).
      // aiProviderUrl() valida la URL y lanza con el motivo si no puede servir:
      // fuera del try para que aiFetchError() no le añada el sufijo "— proxy: …".
      const url = aiProviderUrl('nvidia', '/v1/chat/completions');
      let res;
      try {
        res = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, max_tokens: 2048 }), signal
        });
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        throw aiFetchError('nvidia', e);
      }
      if (!res.ok) throw await aiHttpError(res);
      const data = await res.json();
      return aiModelReply(model, data, 'Nemotron 3 Ultra o Kimi K3');
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
        return '**Chrome Built-in AI no disponible.** Necesitas Chrome Canary/Dev con flags: `chrome://flags/#prompt-api-for-gemini-nano`';
      }
      const { available } = await window.ai.canCreateTextSession();
      if (available !== 'readily') {
        return '**Gemini Nano no está disponible.** Descárgalo desde: chrome://components → "Optimization Guide On Device Model" → "Check for update"';
      }
      const session = await window.ai.createTextSession({ systemPrompt: AI_CONTEXT_INSTRUCTION });
      const result = await session.prompt(messages.map(m => m.content).join('\n'));
      session.destroy();
      return result;
    }
  }
};

const AI_KEYS_KEY = 'gasolineras_ai_keys';

// URL del proxy de NVIDIA (Cloudflare Worker). La clave nvapi- vive en el
// secreto NVIDIA_API_KEY del Worker, asi que en el navegador solo se guarda
// la direccion: no hay ni clave ni prefijo que validar para este proveedor.
const AI_PROXY_KEY = 'gasolineras_ai_nvidia_proxy';

const AI_ENCRYPTED_KEYS = {
  'google': 'MyYTEzwQMDgxJ0JcJw4xEVwmICFeCAEcKl0+JSAvXwwKCwQBGlkk',
  'groq': 'FRwCLS0cBxkFKAEiICkuJV4ZRi4/GwkZJSgNCw1aNDYwORZfIyoiJj0sEV8cJAdYGBYfPwgYEwk=',
  'mistral': 'ESIhBl86GiVYPQMZPFkfC14RRDokHTsxIiYeHQQiPC4=',
  'openrouter': 'AQREHR1EBF5EFF4NEV4LSg1QRlxbEV9YQVkMR15QRAsKEF9eRVsKFAxQE1hQQQlZFA0LQVhQSl9RRwsKS1lfQlhZRFsNRVwIEw=='
};

// Prefijo obligatorio de la API key segun proveedor (evita guardar una clave
// del proveedor equivocado, que solo fallaria al enviar la peticion).
// llm7 NO aparece: su clave es opcional y no tiene prefijo reconocible.
// nvidia tampoco: su clave no sale del proxy, vive en el secreto del Worker.
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

// --- Proxy de NVIDIA ------------------------------------------------------
// URL predefinida: la FORMA que devuelve `wrangler deploy` con el name de
// workers/wrangler.toml, pero sin el subdominio de la cuenta (que es lo unico
// que Cloudflare no deja elegir: uno por cuenta). Se deja como ejemplo para que
// el campo de Config venga relleno, NO como destino: ese host no resuelve y
// aiProxyUrlIssue() lo marca como inválido para no gastarse un fetch y no
// esconder la causa detrás de un "NetworkError when attempting to fetch".
const AI_PROXY_NVIDIA_DEFAULT = 'https://petrol-nvidia-proxy.workers.dev';

// Cómo es de verdad una URL de workers.dev. 'mi-cuenta' es un ejemplo: lo
// sustituye el subdominio que Cloudflare asigna a la cuenta del usuario.
const AI_PROXY_NVIDIA_SHAPE = 'https://petrol-nvidia-proxy.mi-cuenta.workers.dev';

// Motivos por los que una URL de proxy no sirve, con su versión corta para los
// rótulos de estado. 'nourl' no es un error de formato sino "no configurada".
const AI_PROXY_URL_ISSUES = {
  nourl: 'Falta la URL del proxy',
  placeholder: 'URL con un placeholder sin sustituir',
  invalid: 'URL no válida',
  nosubdomain: 'URL sin el subdominio de tu cuenta'
};

// Normaliza lo que el usuario pega: sin esquema, con barra final o con spaces.
function normalizeAiProxyUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

// Motivo por el que una URL de proxy no puede funcionar, o '' si tiene buena
// pinta. Se comprueba ANTES de fetchear porque los dos fallos mas comunes
// (el valor de ejemplo y el placeholder de la documentación) no son errores de
// red: son direcciones que nunca van a resolver.
function aiProxyUrlIssue(url) {
  const base = normalizeAiProxyUrl(url);
  if (!base) return 'nourl';
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    // El host con <> (https://worker.<tu-cuenta>.workers.dev) lo rechaza el
    // parser de URL: es el placeholder de la documentación, no una URL mala.
    return /[<>{}]/.test(base) ? 'placeholder' : 'invalid';
  }
  // workers.dev publica siempre como <worker>.<subdominio-cuenta>.workers.dev:
  // con solo tres etiquetas falta el subdominio y el host no existe.
  if (host.endsWith('.workers.dev') && host.split('.').length === 3) return 'nosubdomain';
  // Chromium no lanza si el host lleva espacios: los percent-codifica
  // ("mi%20proxy"), que tampoco resuelve. Solo se admiten letras, dígitos, punto
  // y guion, más los corchetes de un IPv6 literal.
  if (!host.startsWith('[') && !/^[a-z0-9.-]+$/i.test(host)) return 'invalid';
  return '';
}

// Explicación de cada motivo, en castellano y diciendo qué pegar.
function aiProxyUrlIssueMessage(issue, url) {
  const base = normalizeAiProxyUrl(url);
  switch (issue) {
    case 'nourl':
      return 'Falta la URL del proxy de NVIDIA: ponla en Config → IA. Es la que imprime "wrangler deploy".';
    case 'placeholder':
      return 'La URL "' + base + '" tiene un placeholder sin sustituir (lo de <…> es un ejemplo, no se copia tal cual).'
        + ' La real tiene esta forma: ' + AI_PROXY_NVIDIA_SHAPE + ', tal como la imprime "wrangler deploy".';
    case 'invalid':
      return 'La URL "' + base + '" no es válida. Debe ser la del Worker, con esta forma: ' + AI_PROXY_NVIDIA_SHAPE;
    case 'nosubdomain':
      return 'La URL "' + base + '" no puede existir: Cloudflare publica cada Worker como <worker>.<subdominio de tu cuenta>.workers.dev,'
        + ' o sea ' + AI_PROXY_NVIDIA_SHAPE + '. Pega en Config → IA la URL exacta que imprime "wrangler deploy"'
        + ' (hace falta una cuenta de Cloudflare, gratuita; sin ella este proveedor no se puede usar).';
    default:
      return '';
  }
}

// Pinta el campo de Config según la URL: rojo si no puede funcionar, verde si
// tiene la forma correcta. El verde no garantiza que el Worker exista: para eso
// está el botón 🔎 Probar.
function markAiProxyUrlInput(provider, url) {
  const input = document.getElementById(getProviderInputId(provider, 'iaProxy'));
  if (!input) return;
  const issue = aiProxyUrlIssue(url);
  input.style.borderColor = issue ? '#c33' : '#2a7';
  input.title = issue ? aiProxyUrlIssueMessage(issue, url) : 'La URL tiene la forma correcta; pulsa 🔎 Probar para comprobar que el Worker responde.';
}

function getAiProxyUrl(provider) {
  if (provider !== 'nvidia') return '';
  // Sin nada guardado se usa la predefinida, asi el proveedor funciona de
  // salida. isDefaultProxyUrl() permite distinguirla de la que puso el usuario.
  return normalizeAiProxyUrl(localStorage.getItem(AI_PROXY_KEY)) || AI_PROXY_NVIDIA_DEFAULT;
}

function isDefaultProxyUrl(provider) {
  return provider === 'nvidia' && !normalizeAiProxyUrl(localStorage.getItem(AI_PROXY_KEY));
}

function setAiProxyUrl(provider, url) {
  if (provider !== 'nvidia') return;
  try { localStorage.setItem(AI_PROXY_KEY, normalizeAiProxyUrl(url)); } catch {}
}

// URL absoluta de una ruta del proveedor, resolviendo el proxy si hace falta.
function aiProviderUrl(provider, path) {
  const config = AI_PROVIDERS[provider];
  if (!config) return path;
  if (config.viaProxy) {
    const base = getAiProxyUrl(provider);
    // Validar aquí evita el fetch imposible y, sobre todo, que el error que ve
    // el usuario sea un "NetworkError" sin explicar de dónde sale.
    const issue = aiProxyUrlIssue(base);
    if (issue) throw new Error(aiProxyUrlIssueMessage(issue, base));
    return base + path;
  }
  return path;
}

// Un fetch a un host que no responde falla con "Failed to fetch" / "Load failed",
// que no dice nada útil. Con el proxy de NVIDIA estos casos son los mas
// frecuentes (Worker borrado, subdominio de la cuenta cambiado, red que lo
// bloquea), asi que se convierte en un mensaje que dice qué mirar. Las URLs que
// no pueden existir las descarta antes aiProxyUrlIssue().
function aiFetchError(provider, err) {
  const config = AI_PROVIDERS[provider] || {};
  if (!config.viaProxy) return err;
  const url = getAiProxyUrl(provider);
  const raw = (err && (err.message || String(err))) || 'error de red';
  if (/failed to fetch|load failed|networkerror|network request failed|dns|err_name_not_resolved|err_connection/i.test(raw)) {
    return new Error('No se pudo conectar con el proxy de NVIDIA en ' + url
      + ' (' + raw + '): ese host no responde. Comprueba que el Worker siga desplegado y que la URL sea'
      + ' la que imprime "wrangler deploy" (' + AI_PROXY_NVIDIA_SHAPE + ').');
  }
  return new Error(raw + ' — proxy: ' + url);
}

// Diagnóstico del proxy: un GET a /v1_models_ (sin coste de tokens) y una
// explicación por cada resultado posible, para no tener que adivinar.
async function aiProxyDiagnostics(provider, urlOverride) {
  const config = AI_PROVIDERS[provider];
  if (!config || !config.viaProxy) return { ok: false, reason: 'unsupported' };
  const base = normalizeAiProxyUrl(urlOverride) || getAiProxyUrl(provider);
  if (!base) return { ok: false, reason: 'nourl' };
  const res = { url: base };
  // Si la URL no puede funcionar no se llega a hacer el fetch: se explica qué
  // pegar, que es justo para lo que se usa este botón.
  const issue = aiProxyUrlIssue(base);
  if (issue) {
    return Object.assign(res, { ok: false, kind: 'invalidurl', issue, message: aiProxyUrlIssueMessage(issue, base) });
  }
  let r;
  try {
    r = await fetch(base + '/v1/models', { headers: { Accept: 'application/json' } });
  } catch (e) {
    return Object.assign(res, {
      ok: false, kind: 'dns',
      message: 'No se pudo ni conectar con ' + base + ' (' + ((e && e.message) || 'error de red')
        + '). Ese host no responde: revisa la URL. La que imprime "wrangler deploy" tiene esta forma: '
        + AI_PROXY_NVIDIA_SHAPE
    });
  }
  const body = await r.text();
  let json = null;
  try { json = JSON.parse(body); } catch {}
  const msg = (json && json.error && json.error.message) || body.slice(0, 160).trim();
  if (r.ok && json) {
    const n = Array.isArray(json.data) ? json.data.length : 0;
    return Object.assign(res, {
      ok: true, kind: 'ok', models: n,
      message: 'El proxy responde en ' + base + ' con ' + n + ' modelos. Ya puedes usar NVIDIA.'
    });
  }
  if (r.status === 500 && /no tiene la clave/i.test(msg)) {
    return Object.assign(res, {
      ok: false, kind: 'nokey', message: 'El Worker existe pero no tiene clave: ejecuta "wrangler secret put NVIDIA_API_KEY" y vuelve a desplegar.'
    });
  }
  if (r.status === 401 || r.status === 403) {
    return Object.assign(res, {
      ok: false, kind: 'badauth',
      message: 'NVIDIA rechazó la clave del Worker (401/403). Revísala: si la rotaste, vuelve a hacer "wrangler secret put NVIDIA_API_KEY".'
    });
  }
  if (r.status === 429) {
    return Object.assign(res, {
      ok: false, kind: 'quota', message: 'NVIDIA devolvió 429 (cuota o rate limit). El proxy está bien; espera unos minutos.'
    });
  }
  if (r.status === 404) {
    return Object.assign(res, {
      ok: false, kind: 'notfound',
      message: 'Ese host responde, pero no tiene un Worker en esa ruta ("' + (msg || '404') + '"). Suele ser el subdominio equivocado: usa el que imprime "wrangler deploy".'
    });
  }
  return Object.assign(res, { ok: false, kind: 'http' + r.status, message: 'HTTP ' + r.status + ': ' + (msg || '(sin detalle)') });
}

// Un proveedor viaProxy esta listo en cuanto tenga una URL de proxy utilizable
// (con forma de workers.dev, no solo con el valor de ejemplo); uno con clave
// opcional siempre (accede en anonimo); el resto, en cuanto tenga clave.
function isAiProviderReady(provider) {
  const config = AI_PROVIDERS[provider];
  if (!config) return false;
  if (config.viaProxy) return !aiProxyUrlIssue(getAiProxyUrl(provider));
  if (config.keyOptional) return true;
  const cfgInput = document.getElementById(getProviderInputId(provider, 'iaKey'));
  return !!(cfgInput && cfgInput.value ? cfgInput.value : config.key);
}

function aiProviderNotReadyMessage(provider) {
  const config = AI_PROVIDERS[provider];
  if (config && config.viaProxy) {
    const base = getAiProxyUrl(provider);
    const issue = aiProxyUrlIssue(base);
    return issue
      ? aiProxyUrlIssueMessage(issue, base)
      : 'El proxy de NVIDIA no responde. Revisa su URL en Config → IA y que el Worker esté desplegado.';
  }
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

// Ultimo modelo enviado por cada proveedor. Se guarda al ENVIAR (no al mover el
// desplegable) para que "el ultimo usado" sea de verdad el ultimo con el que se
// respondio, y se recupera al arrancar la app en vez de volver al default.
const AI_LAST_MODEL_KEY = 'gasolineras_ai_last_models';

function loadAiLastModels() {
  try {
    const raw = localStorage.getItem(AI_LAST_MODEL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

function saveAiLastModel(provider, model) {
  if (!provider || !model) return;
  try {
    const all = loadAiLastModels();
    all[provider] = model;
    localStorage.setItem(AI_LAST_MODEL_KEY, JSON.stringify(all));
  } catch {}
}

function lastAiModel(provider) {
  const m = loadAiLastModels()[provider];
  return (typeof m === 'string' && m) ? m : null;
}

// Selecciona el ultimo modelo del proveedor si sigue en el desplegable.
// Devuelve false si no hay guardado o si ya no existe en la lista.
function restoreAiLastModel(provider, select) {
  const saved = lastAiModel(provider);
  if (!select || !saved) return false;
  if (![...select.options].some(o => o.value === saved)) return false;
  select.value = saved;
  return true;
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
  // viaProxy: la ruta es relativa al Worker y no viaja ninguna clave (la pone el
  // Worker al reenviar). El resto usa su /models con la clave del usuario.
  const base = config.viaProxy ? aiProviderUrl(provider, config.listModelsUrl) : config.listModelsUrl;
  const url = provider === 'google'
    ? `${base}?key=${encodeURIComponent(apiKey)}&pageSize=200`
    : base;
  const headers = { 'Accept': 'application/json' };
  if (provider !== 'google' && !config.viaProxy && !config.listModelsNoAuth) headers['Authorization'] = 'Bearer ' + apiKey;
  let res;
  try {
    res = await fetch(url, { headers, signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    // Con viaProxy un fallo de red casi siempre es la URL equivocada: se
    //iagnostica antes de devolver el error para poder explicar la causa.
    if (config.viaProxy) {
      const diag = await aiProxyDiagnostics(provider);
      throw new Error(diag.message);
    }
    throw e;
  }
  if (!res.ok) throw await aiHttpError(res);
  const data = await res.json();
  // .call(config) para que parseModels pueda leer sus propias opciones (p.ej. la
  // lista de ids rotos de LLM7). El await es obligatorio: los parseModels
  // personalizados son async y sin el se intentaria hacer .filter a una Promise.
  const parse = config.parseModels || (d => (d.data || []).map(m => m.id));
  return ((await parse.call(config, data)) || []).filter(isAiModelChatCandidate);
}

// Orden alfabetico de lo que ve el usuario: se ordena por la ETIQUETA y no por
// el id, porque los ids llevan el prefijo del proveedor (moonshotai/, z-ai/,
// nvidia/...) y asi se agruparian por proveedor en vez de por nombre.
function sortAiModelEntries(entries) {
  return entries.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase(), 'es'));
}

// Rellena el <select> de modelos: primero la lista fija del proveedor (los
// defaults verificados), despues los del catalogo remoto sin duplicar.
// Todo sale en orden alfabetico y, sin seleccion previa, se elige el ultimo
// modelo enviado por el proveedor (o el default si no lo hay).
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
  const entries = sortAiModelEntries(all.map(id => ({ id, label: aiModelLabel(id) })));
  select.innerHTML = '';
  for (const e of entries) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.label;
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
  } else if (!restoreAiLastModel(provider, select)) {
    select.value = config.defaultModel;
  }
  return { missing, previous };
}

// Refresca el catalogo de un proveedor y repinta el desplegable.
// force=true ignora la cache. Devuelve { ok, models, missing, error }.
async function refreshAiModels(provider, opts = {}) {
  const config = AI_PROVIDERS[provider];
  if (!config || !config.listModelsUrl) return { ok: false, models: null, reason: 'unsupported' };
  if (!isAiProviderReady(provider)) return { ok: false, models: null, reason: 'nokey' };
  const apiKey = aiApiKey(provider);

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
// esta listo (sin clave, o sin URL de proxy) se deja el desplegable con la
// lista fija; si lo esta, se sincroniza con el catalogo real (usando la cache).
function autoRefreshAiModels(provider) {
  // La pestaña General refresca a la vez a todos los visibles (cada uno con su
  // propia caché de catálogo, así que solo pide los que llevan >24 h sin ver).
  if (provider === AI_GENERAL) {
    aiVisibleProviders().forEach(autoRefreshAiModels);
    return;
  }
  const config = AI_PROVIDERS[provider];
  if (!config || !config.listModelsUrl) return;
  // Un proxy con la URL de ejemplo no se consulta: se explica el motivo en el
  // desplegable en vez de dejar un error de red sin contexto.
  if (config.viaProxy) {
    const issue = aiProxyUrlIssue(getAiProxyUrl(provider));
    if (issue) { markAiModelsStatus(provider, '⚠️ ' + AI_PROXY_URL_ISSUES[issue]); return; }
  }
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

// ==========================================================================
// Pestañas de IA visibles — Config → "Pestañas de IA"
// Por defecto se muestran los 7 proveedores; en Config se puede ocultar
// cualquiera de ellos (solo se pinta la pestaña y su panel, el chat y los
// mensajes se conservan). Si se oculta la activa se salta a la primera
// visible, y siempre debe quedar al menos una.
const AI_HIDDEN_KEY = 'gasolineras_ai_hidden_providers';

// Pestaña "General": no es un proveedor, no está en AI_PROVIDERS y por eso no
// pide clave ni aparece en Config → "Pestañas de IA". Lanza la misma pregunta
// en paralelo a todos los proveedores visibles y no se puede ocultar.
const AI_GENERAL = 'general';

const AI_PROVIDER_LABELS = {
  'groq': 'Groq',
  'mistral': 'Mistral',
  'openrouter': 'OpenRouter',
  'llm7': 'LLM7.io',
  'nvidia': 'NVIDIA',
  'google': 'Google Gemini',
  'chrome-nano': 'Chrome Built-in AI'
};

function loadAiHiddenProviders() {
  try {
    const raw = localStorage.getItem(AI_HIDDEN_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista.filter(p => AI_PROVIDERS[p]) : [];
  } catch { return []; }
}

function saveAiHiddenProviders(lista) {
  const limpia = lista.filter(p => AI_PROVIDERS[p]);
  if (!limpia.length) localStorage.removeItem(AI_HIDDEN_KEY);
  else localStorage.setItem(AI_HIDDEN_KEY, JSON.stringify(limpia));
}

function isAiProviderHidden(provider) {
  return loadAiHiddenProviders().includes(provider);
}

// Proveedores que consulta la pestaña General: los de AI_PROVIDERS que el
// usuario no haya ocultado en Config → IA.
function aiVisibleProviders() {
  const ocultos = loadAiHiddenProviders();
  return Object.keys(AI_PROVIDERS).filter(p => !ocultos.includes(p));
}

function applyAiProviderVisibility() {
  const ocultos = loadAiHiddenProviders();
  let activaVisible = false;
  document.querySelectorAll('.ia-provider-tab').forEach(tab => {
    const p = tab.dataset.iaprovider;
    // General nunca se oculta, aunque alguien lo meta en la lista guardada.
    const oculto = p !== AI_GENERAL && ocultos.includes(p);
    tab.classList.toggle('ia-hidden', oculto);
    const panel = document.querySelector('.ia-provider-panel[data-iapanel="' + p + '"]');
    if (panel) {
      panel.classList.toggle('ia-hidden', oculto);
      if (oculto) panel.classList.remove('active');
    }
    if (!oculto && tab.classList.contains('active')) activaVisible = true;
  });
  // La pestaña activa quedó oculta: se salta a la primera visible (su click
  // activa el panel y dispara el auto-refresh de modelos igual que un clic real)
  if (!activaVisible) {
    const primera = Array.from(document.querySelectorAll('.ia-provider-tab'))
      .find(t => !t.classList.contains('ia-hidden'));
    if (primera) primera.click();
  }
}

function updateAiProviderVisibilityHint(texto) {
  const hint = document.getElementById('aiProviderVisibilityHint');
  if (hint) hint.textContent = texto || defaultAiProviderVisibilityHint();
}

function defaultAiProviderVisibilityHint() {
  const ocultos = loadAiHiddenProviders();
  const total = Object.keys(AI_PROVIDERS).length;
  const fin = ' La pestaña General no se oculta: consulta a todos los visibles.';
  if (!ocultos.length) return 'Los ' + total + ' proveedores están visibles.' + fin;
  return 'Ocultas ' + ocultos.length + ' de ' + total + ' ('
    + ocultos.map(p => AI_PROVIDER_LABELS[p] || p).join(', ') + '). Sus conversaciones se conservan.' + fin;
}

function renderAiProviderVisibilityConfig() {
  const cont = document.getElementById('aiProviderVisibility');
  if (!cont) return;
  const ocultos = loadAiHiddenProviders();
  cont.innerHTML = Object.keys(AI_PROVIDERS).map(p => {
    const id = 'iaVis' + p.replace(/(^|-)([a-z])/g, (_, d, c) => c.toUpperCase());
    return '<label for="' + id + '" style="display:flex;align-items:center;gap:0.3rem;cursor:pointer">'
      + '<input type="checkbox" id="' + id + '" data-ia-provider="' + p + '"'
      + (ocultos.includes(p) ? '' : ' checked') + '> ' + (AI_PROVIDER_LABELS[p] || p) + '</label>';
  }).join('');

  if (!cont.dataset.listener) {
    cont.dataset.listener = '1';
    cont.addEventListener('change', e => {
      const cb = e.target.closest('input[type="checkbox"][data-ia-provider]');
      if (!cb) return;
      const p = cb.dataset.iaProvider;
      const actual = loadAiHiddenProviders();
      const lista = cb.checked ? actual.filter(x => x !== p)
        : (actual.includes(p) ? actual : actual.concat(p));
      if (!Object.keys(AI_PROVIDERS).some(x => !lista.includes(x))) {
        cb.checked = true;
        updateAiProviderVisibilityHint('Debe quedar al menos una pestaña de IA visible.');
        return;
      }
      saveAiHiddenProviders(lista);
      applyAiProviderVisibility();
      updateAiProviderVisibilityHint();
    });
  }
  updateAiProviderVisibilityHint();
  applyAiProviderVisibility();
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
    if (AI_PROVIDERS[provider].viaProxy) { initAiProxyConfig(provider); continue; }
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

// Alta de un proveedor viaProxy (NVIDIA): no hay input de clave, sino la URL
// del Worker. Al cambiarla se resincroniza el catalogo igual que al cambiar una
// clave, porque detras del proxy hay una cuenta que puede no ser la misma.
function initAiProxyConfig(provider) {
  const input = document.getElementById(getProviderInputId(provider, 'iaProxy'));
  if (!input || input.dataset.listener) return;
  input.dataset.listener = '1';
  input.value = getAiProxyUrl(provider);
  markAiProxyUrlInput(provider, input.value);
  input.addEventListener('change', () => {
    setAiProxyUrl(provider, input.value);
    input.value = getAiProxyUrl(provider);
    updateAiStatus(provider);
    invalidateAiModelsCache(provider);
    if (isAiProviderReady(provider)) {
      markAiModelsStatus(provider, '⏳ Consultando el proxy…');
      autoRefreshAiModels(provider);
    } else {
      markAiModelsStatus(provider, '⚠️ ' + AI_PROXY_URL_ISSUES[aiProxyUrlIssue(input.value)]);
    }
  });
  const reset = document.getElementById('iaProxyResetBtn');
  if (reset && !reset.dataset.listener) {
    reset.dataset.listener = '1';
    reset.addEventListener('click', () => {
      // Vuelve a la URL de ejemplo del wrangler.toml y borra la guardada. Ojo:
      // sin el subdominio de la cuenta ese host no existe, asi que el estado
      // pasa a "URL sin el subdominio de tu cuenta" hasta que se pegue la real.
      setAiProxyUrl(provider, '');
      input.value = getAiProxyUrl(provider);
      updateAiStatus(provider);
      invalidateAiModelsCache(provider);
      markAiModelsStatus(provider, '⚠️ ' + AI_PROXY_URL_ISSUES[aiProxyUrlIssue(input.value)]);
    });
  }
  // "Probar" no cuesta tokens: hace un GET a /v1/models y explica el resultado
  // (host inexistente, Worker sin clave, clave rechazada, cuota, OK). Es la
  // forma de saber si la URL es la buena sin salir de la app.
  const test = document.getElementById('iaProxyTestBtn');
  if (test && !test.dataset.listener) {
    test.dataset.listener = '1';
    const out = document.getElementById('iaProxyTestStatus');
    test.addEventListener('click', async () => {
      const url = normalizeAiProxyUrl(input.value);
      test.disabled = true;
      test.textContent = '⏳';
      if (out) { out.textContent = 'Comprobando ' + (url || '(sin URL)') + '…'; out.style.color = '#888'; }
      const diag = await aiProxyDiagnostics(provider, url);
      test.disabled = false;
      test.textContent = '🔎';
      if (out) { out.textContent = (diag.ok ? '✅ ' : '❌ ') + diag.message; out.style.color = diag.ok ? '#2a7' : '#c33'; }
      if (diag.ok) {
        setAiProxyUrl(provider, url);
        input.value = getAiProxyUrl(provider);
        updateAiStatus(provider);
        invalidateAiModelsCache(provider);
        autoRefreshAiModels(provider);
      }
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

    // El desplegable se reconstruye aqui (ademas de en index.html) para que
    // arranque en orden alfabetico y con el ultimo modelo enviado, con el
    // catalogo cacheado si lo hay. Se vacia la seleccion previa antes de
    // poblar: asi populate no conserva el primer <option> del HTML y cae en
    // el ultimo modelo usado (o en el default).
    if (modelSelect && modelSelect.options.length) {
      modelSelect.value = '';
      populateAiModelSelect(provider, getAiCachedModels(provider)?.models || null);
    }

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

  // Pestaña General: sin desplegable de modelo (usa el último de cada
  // proveedor, o su default) y con su propio chat.
  const genInput = document.getElementById(getProviderInputId(AI_GENERAL, 'iaInput'));
  const genBtn = document.getElementById(getProviderInputId(AI_GENERAL, 'iaSend'));
  const genMsgs = document.getElementById(getProviderInputId(AI_GENERAL, 'iaMessages'));
  if (genInput && genBtn && genMsgs && !genInput.dataset.listener) {
    genInput.dataset.listener = '1';
    if (genMsgs.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ia-msg empty';
      empty.textContent = 'Pregunta a todos los proveedores visibles a la vez: cada respuesta lleva su proveedor, modelo y tiempo.';
      genMsgs.appendChild(empty);
    }
    const doSend = () => handleAiGeneralSend(genInput, genMsgs, genBtn);
    genInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
    genBtn.addEventListener('click', doSend);
    updateAiStatus(AI_GENERAL);
  }
}

const AI_ABORT = {};

const AI_CONTEXT_INSTRUCTION = 'Eres un asistente experto en precios de gasolina en España. Responde SIEMPRE en español, de forma clara y concisa (máximo 3 párrafos). Usa los DATOS ACTUALES que se proporcionan a continuación para responder. Si te preguntan por datos históricos o estaciones específicas, busca la información en los datos proporcionados. Cuando el usuario pregunte por la evolución de precios de una gasolinera concreta, usa la sección HISTÓRICO DE PRECIOS: incluye la serie de precios con su fecha, el mínimo, el máximo y la variación, citando siempre las fechas (dd-mm-aaaa) y los precios en €/L con 3 decimales. Si no hay datos suficientes, indícalo claramente y di qué gasolinera o localidad habría que consultar.';

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
      const parts = [`${i+1}. [id ${s.IDEESS}] ${s.Rótulo || 'Sin marca'} - ${x.p.toFixed(3).replace('.', ',')}€/L`];
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

  // El histórico se carga si la pregunta lo pide explícitamente o si nombra una
  // gasolinera concreta (p. ej. "¿cuánto costaba en Repsol antes?").
  if (wantsStationHistory(userText, stations)) {
    lines.push(...(await buildAiHistoryLines(userText, stations)));
  }

  return lines.join('\n');
}

const AI_HISTORY_WORDS = /\b(histori\w*|evoluci\w*|tendencia\w*|trend|ayer|antes|pasad\w*|antigu\w*|demes\w*|hace\s+\d+|ultim\w*|recient\w*|variaci\w*|diferencia\w*|compar\w*|cambi\w*|cambio\w*|sub\w*|baj\w*|subid\w*|rebaj\w*|mínim\w*|minim\w*|máxim\w*|maxim\w*|máxim\w*|gráfic\w*|chart|serie\w*|diari\w*|fecha\w*|cuánd\w*|cuanto\s+cost\w*|precio\w*\s+de\s+antes)\b/i;

// Rango explícito en la pregunta: "en 30 días", "6 semanas", "3 meses", "1 año".
const AI_HISTORY_RANGE_RE = /(\d{1,3})\s*(d[ií]as?|jornadas?|semanas?|mes(?:es)?)|\b(a[nñ]o|semestre|medio\s+a[nñ]o)\b/i;

function wantsStationHistory(userText, stations) {
  if (!userText) return false;
  if (AI_HISTORY_WORDS.test(userText)) return true;
  // Un rango explícito ("en 7 días", "3 meses") implica histórico aunque no
  // use ninguna palabra clave.
  if (AI_HISTORY_RANGE_RE.test(userText)) return true;
  // También si nombra la marca o la localidad de alguna estación cargada.
  const t = normalizeStr(userText);
  if (t.length < 4) return false;
  return (stations || []).some(s => {
    const nombre = normalizeStr(s['Rótulo'] || '');
    return nombre.length >= 4 && t.includes(nombre);
  });
}

const fmtEur = v => (typeof v === 'number' ? v.toFixed(3).replace('.', ',') : '—');

// Cuántos días pedir. Si la pregunta trae un rango explícito ("en 30 días",
// "6 semanas", "3 meses") se respeta; si no, se usa el que tiene elegido el
// usuario en el combo del modal de histórico. Mismo rango que la app:
// HISTORY_DAYS_OPTIONS (7 a 180 días).
function resolveAiHistoryDays(userText) {
  const min = HISTORY_DAYS_OPTIONS[0];
  const max = HISTORY_DAYS_OPTIONS[HISTORY_DAYS_OPTIONS.length - 1];
  const txt = userText || '';
  const m = /(\d{1,3})\s*(d[ií]as?|jornadas?|semanas?|mes(?:es)?)/i.exec(txt);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const mult = /^se/.test(unit) ? 7 : /^me/.test(unit) ? 30 : 1;
    const days = n * mult;
    return Math.min(max, Math.max(min, days));
  }
  if (/\b(a[nñ]o|semestre|medio a[nñ]o)\b/i.test(txt)) return max;
  const actual = parseInt(STATE.historyDays, 10);
  if (actual >= min && actual <= max) return actual;
  return HISTORY_DAYS_DEFAULT;
}

// Datos del histórico reutilizando lo que ya tenga cargado el resto de la app
// (window._historyCache lo rellenan el modal de detalle y el popup del mapa), y
// su propia caché para no repetir peticiones al ampliar el rango.
async function getAiHistoryData(days) {
  const prov = STATE.selectedProv;
  const usable = c => c && c.province === prov && c.days >= days;
  if (usable(window._historyCache)) {
    return { data: window._historyCache.data, dias: window._historyCache.days, reutilizado: true };
  }
  if (usable(window._aiHistoryCache)) {
    return { data: window._aiHistoryCache.data, dias: window._aiHistoryCache.days, reutilizado: true };
  }
  const data = await fetchProvinceHistory(prov, days);
  window._aiHistoryCache = { province: prov, days, data };
  return { data, dias: days, reutilizado: false };
}

// Combustible del histórico: si el modal de detalle está abierto se usa el suyo
// (es lo que el usuario está viendo en la gráfica); si no, el filtro de la app.
function aiHistoryFuelName(station) {
  const panel = document.getElementById('historyFuel');
  const detail = document.getElementById('detailPanel');
  if (panel && panel.value && detail && detail.classList.contains('show')) return panel.value;
  return resolveHistoryFuel(station, STATE.selectedFuel);
}

// Serie temporal de una estación: la misma que dibuja la gráfica del modal.
function stationSeries(historyData, dates, station, fuelName) {
  const sub = {};
  for (const d of dates) if (historyData[d]) sub[d] = historyData[d];
  return getStationHistory(sub, station.IDEESS, fuelName);
}

function stationHistoryBlock(historyData, dates, station) {
  const fuelName = aiHistoryFuelName(station);
  const serie = stationSeries(historyData, dates, station, fuelName);
  if (!serie.length) return null;
  const precios = serie.map(x => x.price);
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  const avg = precios.reduce((a, b) => a + b, 0) / precios.length;
  const primera = serie[0];
  const ultima = serie[serie.length - 1];
  const delta = ultima.price - primera.price;
  const pct = primera.price ? (delta / primera.price) * 100 : 0;
  const fMin = serie.find(x => x.price === min).date;
  const fMax = serie.find(x => x.price === max).date;
  const key = FUEL_KEYS[fuelName];
  const ahora = key ? getFuelPrice(station, key) : getFirstFuelPrice(station);
  const desc = getDiscount(station);

  const out = [];
  out.push(`[${station.IDEESS}] ${station['Rótulo'] || 'Sin marca'}${station.Localidad ? ' | ' + station.Localidad : ''}${station['Dirección'] ? ' | ' + station['Dirección'] : ''}`);
  if (FUEL_GROUPS[fuelName]) out.push(`   (grupo de combustibles: cada día se usa el primero con precio de ${FUEL_GROUPS[fuelName].join(', ')})`);
  out.push(`   Serie ${fuelName} (€/L): ${serie.slice(-10).map(x => `${x.date.slice(0,5)}: ${fmtEur(x.price)}`).join(' | ')}${serie.length > 10 ? ` (últimos 10 de ${serie.length})` : ''}`);
  out.push(`   Resumen: ahora ${fmtEur(ahora)}${desc && ahora !== null ? ` (con tu descuento del ${desc}% son ${fmtEur(getDiscountedPrice(ahora, station))})` : ''} | mín ${fmtEur(min)} (${fMin}) | máx ${fmtEur(max)} (${fMax}) | media ${fmtEur(avg)} | desde ${primera.date.slice(0,5)} ${delta >= 0 ? '+' : ''}${fmtEur(delta)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%) | ${serie.length} días con precio`);
  return out.join('\n');
}

async function buildAiHistoryLines(userText, stations) {
  const lines = ['\n=== HISTÓRICO DE PRECIOS (Ministerio: instantánea diaria por gasolinera) ==='];
  const days = resolveAiHistoryDays(userText);
  const pedido = /\d/.test(userText || '') || /a[nñ]o|semestre/i.test(userText || '');
  lines.push(`Rango: ${days} días${pedido ? ' (los que has pedido)' : ' (el que tienes seleccionado en el histórico de la app)'}; la app permite ${HISTORY_DAYS_OPTIONS.join(', ')} días.`);
  let cache = { data: {}, dias: days, reutilizado: false };
  try {
    if (STATE.selectedProv) cache = await getAiHistoryData(days);
  } catch (e) {
    lines.push('  Error al recuperar histórico: ' + e.message);
    return lines;
  }
  const historyData = cache.data || {};
  // Si la caché traía más días de los pedidos, se recorta al rango solicitado.
  const dates = sortHistoryDates(Object.keys(historyData)).slice(-days);
  if (!dates.length) {
    lines.push('  No hay datos históricos disponibles en caché para esta provincia.');
    return lines;
  }
  const fuelName = aiHistoryFuelName(stations[0] || {});
  lines.push(`Periodo con datos: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} jornadas)${cache.reutilizado ? `, reutilizando la caché de la app (${cache.dias} días cargados)` : ''}. Fechas en dd-mm-aaaa. Importante: una fecha ausente significa que esa gasolinera no reportaba precio ese día, NO que mantuviera el precio.`);
  lines.push(`Combustible analizado: ${fuelName} (el mismo que el filtro de la app / el combo del modal de histórico).`);

  const priceOf = st => {
    const key = FUEL_KEYS[fuelName];
    if (key) return getFuelPrice(st, key);
    for (const name of (FUEL_GROUPS[fuelName] || [fuelName])) {
      const p = getFuelPrice(st, FUEL_KEYS[name] || '');
      if (p !== null) return p;
    }
    return null;
  };

  // --- Evolución de la provincia ---
  const daily = [];
  for (const d of dates) {
    const conPrecio = (historyData[d] || []).map(s => ({ s, p: priceOf(s) })).filter(x => x.p !== null);
    if (!conPrecio.length) continue;
    const precios = conPrecio.map(x => x.p);
    conPrecio.sort((a, b) => a.p - b.p);
    daily.push({
      fecha: d,
      media: precios.reduce((a, b) => a + b, 0) / precios.length,
      min: precios.reduce((a, b) => Math.min(a, b), Infinity),
      max: precios.reduce((a, b) => Math.max(a, b), -Infinity),
      n: precios.length,
      cheapest: conPrecio[0]
    });
  }
  lines.push(`\n--- Provincia: media de mercado por día (${fuelName}) ---`);
  for (const d of daily.slice(-10)) {
    lines.push(`  ${d.fecha}: media ${fmtEur(d.media)} | mín ${fmtEur(d.min)} | máx ${fmtEur(d.max)} | ${d.n} gasolineras | más barata: ${d.cheapest.s['Rótulo'] || '?'} (${d.cheapest.s.Localidad || '?'}) ${fmtEur(d.cheapest.p)}`);
  }
  if (daily.length > 1) {
    const first = daily[0];
    const last = daily[daily.length - 1];
    const dAvg = last.media - first.media;
    const pct = first.media ? (dAvg / first.media) * 100 : 0;
    const lowest = daily.reduce((a, b) => (b.min < a.min ? b : a));
    lines.push(`  Tendencia provincial: ${first.fecha} → ${last.fecha}, media ${fmtEur(first.media)} → ${fmtEur(last.media)} (${dAvg >= 0 ? '+' : ''}${fmtEur(dAvg)} €/L, ${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%). El precio más bajo visto en toda la provincia fue ${fmtEur(lowest.min)} el ${lowest.fecha}.`);
  }
  if (daily.length > 10) lines.push(`  (se muestran las últimas 10 de ${daily.length} jornadas; la media del rango completo está en las tendencia)`);

  // --- Historial por gasolinera ---
  // Prioridad: las nombradas en la pregunta, los favoritos y las más baratas.
  const t = normalizeStr(userText || '');
  const nombradas = stations.filter(s => {
    const n = normalizeStr(s['Rótulo'] || '');
    return n.length >= 4 && t.includes(n);
  });
  const conPrecio = stations
    .map(s => ({ s, p: priceOf(s) }))
    .filter(x => x.p !== null)
    .sort((a, b) => a.p - b.p)
    .map(x => x.s);
  const favoritos = stations.filter(s => STATE.favorites.includes(s.IDEESS));
  const elegidas = [];
  const push = s => { if (s && !elegidas.some(x => x.IDEESS === s.IDEESS) && elegidas.length < 12) elegidas.push(s); };
  nombradas.forEach(push);
  favoritos.forEach(push);
  conPrecio.slice(0, 8).forEach(push);

  lines.push('\n--- Historial por gasolinera (máx. 12; las nombradas en tu pregunta van primero) ---');
  if (!elegidas.length) {
    lines.push('  No hay estaciones con las que cruzar el histórico.');
  } else {
    let impresas = 0;
    for (const s of elegidas) {
      const bloque = stationHistoryBlock(historyData, dates, s);
      if (bloque) { lines.push('  ' + bloque); impresas++; }
    }
    if (!impresas) lines.push('  Ninguna de esas estaciones tiene precios en el histórico cargado.');
  }

  // --- Quién se movió más en el periodo ---
  const variaciones = [];
  for (const s of conPrecio.slice(0, 60)) {
    const serie = stationSeries(historyData, dates, s, fuelName);
    if (serie.length < 2) continue;
    variaciones.push({ s, d: serie[serie.length - 1].price - serie[0].price, desde: serie[0].date });
  }
  variaciones.sort((a, b) => a.d - b.d);
  const fmtVar = v => `${v.s['Rótulo'] || '?'} (${v.s.Localidad || '?'}) ${v.d >= 0 ? '+' : ''}${fmtEur(v.d)} desde ${v.desde.slice(0,5)}`;
  if (variaciones.length >= 3) {
    lines.push('\n--- Mayor bajada y mayor subida del periodo (muestra de las 60 más baratas) ---');
    variaciones.slice(0, 3).forEach(v => lines.push('  📉 ' + fmtVar(v)));
    variaciones.slice(-3).reverse().forEach(v => lines.push('  📈 ' + fmtVar(v)));
  }

  lines.push('\nInstrucciones: cita siempre la fecha (dd-mm-aaaa) y el precio en €/L con 3 decimales. Si la pregunta es sobre una gasolinera que no aparece arriba, dilo y ofrece consultarla indicando su marca y localidad. Si el usuario pide otro rango, tienes hasta 180 días.');
  return lines;
}

// Historial de un chat: los mensajes con data-raw van con su Markdown
// original; los internos (error/info/warn) con el texto visible.
function readAiMessages(container) {
  const msgs = [];
  if (!container) return msgs;
  container.querySelectorAll('.ia-msg:not(.empty):not(.loading)').forEach(m => {
    const role = m.classList.contains('user') ? 'user' : 'assistant';
    msgs.push({ role, content: m.dataset.raw !== undefined ? m.dataset.raw : m.textContent });
  });
  return msgs;
}

function getMessagesForProvider(provider) {
  return readAiMessages(document.getElementById(getProviderInputId(provider, 'iaMessages')));
}

function editAiMessage(provider, msgEl, input) {
  const crudo = msgEl.dataset.raw !== undefined ? msgEl.dataset.raw : msgEl.textContent;
  const text = crudo.replace('✎', '').trim();
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
  // En el momento de enviar, no al mover el desplegable: el modelo recordado
  // tiene que ser el que de verdad se uso por ultima vez en ese proveedor.
  saveAiLastModel(provider, model);

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
    const t0 = Date.now();
    const result = await config.send(apiKey, model, augmentedMessages, abort.signal);
    if (abort.signal.aborted) return;
    loading.remove();
    const respuesta = addAiMessage(messagesEl, result, 'assistant', provider, input);
    // Marca de agua: modelo usado y tiempo de la respuesta (solo la llamada al
    // modelo, sin el contexto). No se reenvía al historial porque lo que se
    // manda es data-raw, no el texto visible.
    addAiMessageMeta(respuesta, model, Date.now() - t0);
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

// Respuesta de UN proveedor dentro de la pestaña General. El modelo sale del
// último enviado por ese proveedor (o de su default): en General no hay
// desplegable propio, se respeta lo que el usuario eligió en su pestaña.
async function generalAsk(provider, messages, signal, messagesEl, input) {
  const config = AI_PROVIDERS[provider];
  const label = AI_PROVIDER_LABELS[provider] || provider;
  const model = lastAiModel(provider) || config.defaultModel;
  const t0 = Date.now();
  try {
    if (provider !== 'chrome-nano' && !isAiProviderReady(provider)) {
      throw new Error(aiProviderNotReadyMessage(provider));
    }
    const result = await config.send(aiApiKey(provider), model, messages, signal);
    if (signal.aborted) return;
    saveAiLastModel(provider, model);
    const div = addAiMessage(messagesEl, result, 'assistant', AI_GENERAL, input);
    // Marca de agua: proveedor · modelo · tiempo, para poder comparar quién
    // contestó y a qué velocidad con la misma pregunta.
    addAiMessageMeta(div, model, Date.now() - t0, label);
    updateAiStatus(provider, '✅ Listo');
  } catch (err) {
    if (err.name === 'AbortError' || signal.aborted) return;
    addAiMessage(messagesEl, '❌ <b>' + label + '</b>: ' + escapeAiHtml(err.message || 'error'), 'error');
  }
}

// Pestaña General: la MISMA consulta en paralelo a todos los proveedores
// visibles (los de Config → IA; General no se puede ocultar). El snapshot del
// historial se hace una sola vez antes de lanzar, así que todas reciben
// exactamente lo mismo y ninguna respuesta incluye la de los demás.
async function handleAiGeneralSend(input, messagesEl, sendBtn) {
  const text = input.value.trim();
  if (!text) return;
  const providers = aiVisibleProviders();
  if (!providers.length) {
    addAiMessage(messagesEl, '❌ No hay ningún proveedor visible: revisa Config → IA.', 'error');
    return;
  }

  const empty = messagesEl.querySelector('.ia-msg.empty');
  if (empty) empty.remove();
  addAiMessage(messagesEl, text, 'user', AI_GENERAL, input);
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  const loading = addAiMessage(messagesEl,
    'Consultando ' + providers.length + ' proveedores… '
    + '<button class="ia-cancel-btn" data-provider="' + AI_GENERAL + '">Cancelar</button>',
    'loading', AI_GENERAL, input);
  const cancelBtn = loading.querySelector('.ia-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => cancelAiMessage(AI_GENERAL, loading));

  const abort = new AbortController();
  AI_ABORT[AI_GENERAL] = abort;

  try {
    const context = await getAiContext(text);
    const augmented = [{ role: 'system', content: context }, ...readAiMessages(messagesEl)];
    await Promise.all(providers.map(p => generalAsk(p, augmented, abort.signal, messagesEl, input)));
  } catch (err) {
    if (err.name === 'AbortError') return;
    addAiMessage(messagesEl, '❌ Error: ' + escapeAiHtml(err.message || 'error'), 'error');
  } finally {
    delete AI_ABORT[AI_GENERAL];
    if (loading.parentNode) loading.remove();
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// ===========================================================================
// Formateo de la respuesta del LLM
// Los modelos devuelven Markdown (**negrita**, `código`, listas, saltos de
// línea...), y el navegador colapsa los saltos de línea en un bloque si se
// pinta tal cual. Antes todo iba con innerHTML directo: el texto se amontonaba
// y los ** se veían literales. Aquí se convierte un Markdown mínimo a HTML.
// Los mensajes internos (error/info/warn) siguen siendo HTML a mano y NO
// pasan por aquí: solo assistant y user.
// ===========================================================================
function escapeAiHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Formato en línea. El contenido ya viene escapado, así que cualquier etiqueta
// que aparezca aquí es nuestra. El código entre `backticks` se aparta primero
// para que ** ni * lo toquen dentro.
function inlineAiMd(t) {
  const spans = [];
  let s = t.replace(/`([^`]+)`/g, (m, c) => {
    spans.push('<code>' + c + '</code>');
    return '\u0001' + (spans.length - 1) + '\u0001';
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/__([^_]+)__/g, '<b>$1</b>');
  // Cursiva con * : sin espacios dentro de los asteriscos, o sea un texto
  // pegado (`*hola*`). Así una operación como "2 * 3 * 4" no se convierte.
  s = s.replace(/(^|[^*\w])\*([^\s*][^*\n]*[^\s*]|[^\s*])\*/g, '$1<i>$2</i>');
  // Igual con guion bajos, pero pegado a palabra o puntuación: así nombres
  // como gasolineras_prov_filters no se convierten en cursiva.
  s = s.replace(/(^|\s)_([^_\s][^_\n]*[^_\s]|[^_\s])_(?=\s|$|[.,;:!?])/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s.replace(/\u0001(\d+)\u0001/g, (m, i) => spans[+i]);
}

function renderAiMarkdown(md) {
  let src = String(md == null ? '' : md).replace(/\r\n?/g, '\n');
  const blocks = [];

  // Bloques cercados por ```: fuera antes que nada, para que ni el escape ni
  // el formato en línea toquen su contenido (incluido cualquier < literal).
  const guardar = code => {
    blocks.push('<pre class="ia-md-pre"><code>'
      + escapeAiHtml(code.replace(/\n$/, '')) + '</code></pre>');
    return '\u0000' + (blocks.length - 1) + '\u0000';
  };
  src = src.replace(/```[a-zA-Z0-9+#_-]*\n([\s\S]*?)```/g, (m, code) => guardar(code));
  // ``` sin cerrar (respuesta cortada por max_tokens)
  const suelto = src.indexOf('```');
  if (suelto !== -1) {
    const cabecera = src.indexOf('\n', suelto);
    src = src.slice(0, suelto)
      + guardar(cabecera === -1 ? '' : src.slice(cabecera + 1));
  }

  src = escapeAiHtml(src);

  // Tablas Markdown: se convierten en bloques antes de trocear en líneas (ya
  // escapadas, así que una celda con < no inyecta nada).
  src = src.replace(/(?:^[ \t]*\|.*\|[ \t]*\n?)+/gm, bloque => {
    const filas = bloque.trim().split('\n')
      .map(f => f.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
    // La fila separadora (|---|---|) no aporta datos.
    const cuerpo = filas.filter((f, i) => i === 0 || !f.every(c => /^:?-+:?$/.test(c)));
    if (cuerpo.length < 2) return bloque;
    const fila = (f, tag) => '<tr>' + f.map(c => '<' + tag + '>' + inlineAiMd(c) + '</' + tag + '>').join('') + '</tr>';
    blocks.push('<table class="ia-md-table"><thead>' + fila(cuerpo[0], 'th') + '</thead><tbody>'
      + cuerpo.slice(1).map(f => fila(f, 'td')).join('') + '</tbody></table>');
    return '\u0000' + (blocks.length - 1) + '\u0000';
  });

  const out = [];
  let para = [];
  let listTag = null;
  const cerrarLista = () => { if (listTag) { out.push('</' + listTag + '>'); listTag = null; } };
  const cerrarParrafo = () => {
    if (!para.length) return;
    out.push('<p>' + inlineAiMd(para.join('<br>')) + '</p>');
    para = [];
  };

  for (const linea of src.split('\n')) {
    const t = linea.trim();
    if (/^\u0000\d+\u0000$/.test(t)) { cerrarParrafo(); cerrarLista(); out.push(t); continue; }
    if (!t) { cerrarParrafo(); cerrarLista(); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      cerrarParrafo(); cerrarLista();
      out.push('<div class="ia-md-h' + h[1].length + '">' + inlineAiMd(h[2]) + '</div>');
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(t)) { cerrarParrafo(); cerrarLista(); out.push('<hr>'); continue; }
    const li = /^([-*+]|\d+[.)])\s+(.*)$/.exec(t);
    if (li) {
      cerrarParrafo();
      const tag = /^\d/.test(li[1]) ? 'ol' : 'ul';
      if (listTag !== tag) { cerrarLista(); out.push('<' + tag + '>'); listTag = tag; }
      out.push('<li>' + inlineAiMd(li[2]) + '</li>');
      continue;
    }
    const q = /^&gt;\s?(.*)$/.exec(t);
    if (q) {
      cerrarParrafo(); cerrarLista();
      out.push('<div class="ia-md-quote">' + inlineAiMd(q[1]) + '</div>');
      continue;
    }
    para.push(t);
  }
  cerrarParrafo();
  cerrarLista();

  return out.join('').replace(/\u0000(\d+)\u0000/g, (m, i) => blocks[+i]);
}

// El texto original (Markdown del LLM o lo que tecleó el usuario) se guarda en
// data-raw: es lo que se reenvía al modelo en getMessagesForProvider() y lo que
// se recarga en el input al editar, porque del HTML ya renderizado no se puede
// recuperar.
function addAiMessage(container, text, className, provider, input) {
  const div = document.createElement('div');
  div.className = 'ia-msg ' + className;
  if (className === 'assistant') {
    div.dataset.raw = text;
    div.innerHTML = renderAiMarkdown(text);
  } else if (className === 'user') {
    div.dataset.raw = text;
    div.innerHTML = escapeAiHtml(text).replace(/\n/g, '<br>');
  } else {
    div.innerHTML = text;
  }
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

// Marca de agua bajo la respuesta: modelo usado y tiempo empleado. Va en un
// hijo con su propia clase, así que no entra en data-raw (lo que se reenvía al
// modelo) ni en el texto que se recupera al editar.
function formatAiElapsed(ms) {
  if (ms < 1000) return Math.round(ms) + ' ms';
  return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
}

function addAiMessageMeta(div, model, ms, providerLabel) {
  const meta = document.createElement('div');
  meta.className = 'ia-msg-meta';
  meta.textContent = '⏱ ' + (providerLabel ? providerLabel + ' · ' : '') + model + ' · ' + formatAiElapsed(ms);
  meta.title = providerLabel
    ? providerLabel + ' — proveedor, modelo y tiempo de respuesta'
    : 'Modelo usado y tiempo de respuesta';
  div.appendChild(meta);
  const container = div.parentNode;
  if (container) container.scrollTop = container.scrollHeight;
  return meta;
}

function updateAiStatus(provider, override) {
  const id = getProviderInputId(provider, 'iaStatus');
  const el = document.getElementById(id);
  if (!el) return;
  if (override) { el.textContent = override; return; }
  // La pestaña General no tiene clave propia: informa de cuántos de los
  // proveedores visibles están listos para contestar.
  if (provider === AI_GENERAL) {
    const visibles = aiVisibleProviders();
    const listos = visibles.filter(p => (p === 'chrome-nano' ? !!window.ai : isAiProviderReady(p)));
    el.textContent = listos.length
      ? '✅ ' + listos.length + '/' + visibles.length + ' proveedores listos'
      : '⚠️ Ninguno listo — añade claves en Config → IA';
    return;
  }
  const config = AI_PROVIDERS[provider];
  if (provider === 'chrome-nano') {
    el.textContent = window.ai ? '✅ Gemini Nano disponible' : '❌ No disponible (Chrome Canary/Dev)';
    return;
  }
  if (config.viaProxy) {
    const base = getAiProxyUrl(provider);
    const issue = aiProxyUrlIssue(base);
    markAiProxyUrlInput(provider, base);
    if (issue) {
      el.textContent = '⚠️ ' + AI_PROXY_URL_ISSUES[issue] + ' — ve a Config → IA';
      return;
    }
    el.textContent = isDefaultProxyUrl(provider)
      ? '✅ Proxy por defecto (cámbialo en Config → IA)'
      : '✅ Proxy configurado';
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

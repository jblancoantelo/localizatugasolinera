const AI_PROVIDERS = {
  'chrome-nano': {
    key: null,
    endpoint: null,
    defaultModel: 'gemini-nano',
    models: ['gemini-nano'],
    async send(apiKey, model, messages) {
      if (!window.ai || !window.ai.canCreateTextSession) {
        return '<b>Chrome Built-in AI no disponible.</b> Necesitas Chrome Canary/Dev con flags: <code>chrome://flags/#prompt-api-for-gemini-nano</code>';
      }
      const { available } = await window.ai.canCreateTextSession();
      if (available !== 'readily') {
        return '<b>Gemini Nano no está disponible.</b> Descárgalo desde: chrome://components → "Optimization Guide On Device Model" → "Check for update"';
      }
      const session = await window.ai.createTextSession({ systemPrompt: 'Eres un asistente útil. Responde en español de forma clara y concisa.' });
      const result = await session.prompt(messages.map(m => m.content).join('\n'));
      session.destroy();
      return result;
    }
  },
  'gemini-studio': {
    key: null,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash'],
    async send(apiKey, model, messages) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = messages.map(m => ({ parts: [{ text: m.content }] }));
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
    }
  },
  'groq': {
    key: null,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-4-scout-17b-16e-instruct', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    async send(apiKey, model, messages) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: 'Eres un asistente útil. Responde en español de forma clara y concisa.' }, ...messages], max_tokens: 1024 })
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
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest', 'codestral-latest'],
    async send(apiKey, model, messages) {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: 'Eres un asistente útil. Responde en español de forma clara y concisa.' }, ...messages], max_tokens: 1024 })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  },
  'gemini-api': {
    key: null,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    async send(apiKey, model, messages) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = messages.map(m => ({ parts: [{ text: m.content }] }));
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
    }
  },
  'openrouter': {
    key: null,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'deepseek/deepseek-r1:free',
    models: ['deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-coder-480b:free', 'google/gemma-3-12b-it:free'],
    async send(apiKey, model, messages) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'Precios Gasolina España' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: 'Eres un asistente útil. Responde en español de forma clara y concisa.' }, ...messages], max_tokens: 1024 })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '(sin respuesta)';
    }
  }
};

const AI_KEYS_KEY = 'gasolineras_ai_keys';

function loadAiApiKeys() {
  try {
    const raw = localStorage.getItem(AI_KEYS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveAiApiKey(provider, key) {
  const keys = loadAiApiKeys();
  keys[provider] = key;
  localStorage.setItem(AI_KEYS_KEY, JSON.stringify(keys));
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
    });
  });
}

function initAiChat() {
  const keys = loadAiApiKeys();
  for (const [provider, config] of Object.entries(AI_PROVIDERS)) {
    const keyInput = document.getElementById('iaKey' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    if (keyInput) {
      if (keys[provider]) {
        keyInput.value = keys[provider];
        config.key = keys[provider];
      }
      keyInput.addEventListener('change', () => {
        saveAiApiKey(provider, keyInput.value);
        config.key = keyInput.value;
        updateAiStatus(provider);
      });
    }
    const modelSelect = document.getElementById('iaModel' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    const input = document.getElementById('iaInput' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    const sendBtn = document.getElementById('iaSend' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    const messagesEl = document.getElementById('iaMessages' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));

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

function getMessagesForProvider(provider) {
  const id = 'iaMessages' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const el = document.getElementById(id);
  if (!el) return [];
  const msgs = [];
  el.querySelectorAll('.ia-msg:not(.empty):not(.loading)').forEach(m => {
    const role = m.classList.contains('user') ? 'user' : 'assistant';
    msgs.push({ role, content: m.textContent });
  });
  return msgs;
}

async function handleAiSend(provider, modelSelect, input, messagesEl, sendBtn) {
  const text = input.value.trim();
  if (!text) return;

  const config = AI_PROVIDERS[provider];
  const apiKey = config.key;
  const model = modelSelect ? modelSelect.value : config.defaultModel;

  if (provider !== 'chrome-nano' && !apiKey) {
    addAiMessage(messagesEl, 'Por favor, introduce una API Key válida en la configuración.', 'error');
    return;
  }

  // Remove empty placeholder
  const empty = messagesEl.querySelector('.ia-msg.empty');
  if (empty) empty.remove();

  addAiMessage(messagesEl, text, 'user');
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  const loading = addAiMessage(messagesEl, 'Pensando...', 'loading');

  try {
    const allMessages = getMessagesForProvider(provider);
    const result = await config.send(apiKey, model, allMessages);
    loading.remove();
    addAiMessage(messagesEl, result, 'assistant');
    updateAiStatus(provider, '✅ Listo');
  } catch (err) {
    loading.remove();
    addAiMessage(messagesEl, '❌ Error: ' + err.message, 'error');
    updateAiStatus(provider, '❌ Error');
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function addAiMessage(container, text, className) {
  const div = document.createElement('div');
  div.className = 'ia-msg ' + className;
  div.innerHTML = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function updateAiStatus(provider, override) {
  const id = 'iaStatus' + provider.charAt(0).toUpperCase() + provider.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const el = document.getElementById(id);
  if (!el) return;
  if (override) { el.textContent = override; return; }
  const config = AI_PROVIDERS[provider];
  if (provider === 'chrome-nano') {
    el.textContent = window.ai ? '✅ Gemini Nano disponible' : '❌ No disponible (Chrome Canary/Dev)';
    return;
  }
  el.textContent = config.key ? '✅ API Key configurada' : '⚠️ Sin API Key';
}

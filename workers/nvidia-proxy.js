// Proxy CORS para NVIDIA NIM (integrate.api.nvidia.com).
//
// Por que hace falta: el gateway de NVIDIA solo devuelve
// Access-Control-Allow-Origin cuando el origen de la peticion es
// https://build.nvidia.com. Comprobado con un OPTIONS real y con Chromium:
// desde cualquier otro origen (file://, localhost, cualquier hosting) la
// respuesta llega SIN esa cabecera y el navegador aborta la llamada con
// "No 'Access-Control-Allow-Origin' header". Como la app es 100%
// client-side, no hay forma de llamar a NVIDIA sin un intermediario.
//
// Este Worker es ese intermediario: reenvia POST /v1/chat/completions y
// GET /v1/models a NVIDIA usando el secreto NVIDIA_API_KEY. La clave NUNCA
// sale del Worker: el navegador no la necesita ni la ve, y por eso el
// proveedor 'nvidia' de js/ai-chat.js se marca con viaProxy: true y en Config
// solo se pide la URL de este Worker.
//
// Despliegue (ver wrangler.toml):
//   npm i -g wrangler
//   wrangler secret put NVIDIA_API_KEY      # pega la clave nvapi-...
//   wrangler deploy
// La URL que imprime (https://<nombre>.workers.dev) es la que se pega en
// Config -> IA -> "NVIDIA (vía proxy)".

const NVIDIA_ORIGIN = 'https://integrate.api.nvidia.com';

// Lista blanca: no es un proxy abierto a cualquier ruta de NVIDIA.
const ALLOWED_PATHS = ['/v1/chat/completions', '/v1/models'];

function corsHeaders(env, request) {
  // ALLOWED_ORIGIN es opcional. Sin ella responde '*', que es lo que hace
  // falta si la app se abre desde file://, localhost o cualquier hosting.
  // Con ella, solo ese origen puede usar el proxy.
  const allow = env.ALLOWED_ORIGIN;
  const origin = request.headers.get('Origin');
  const allowOrigin = !allow ? '*' : (origin === allow ? allow : 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function json(status, body, env, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(env, request), 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    // Preflight: sin esto el navegador no llega a enviar ni el POST ni el GET.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.includes(url.pathname)) {
      return json(404, {
        error: { message: 'Ruta no permitida. Solo se reenvían ' + ALLOWED_PATHS.join(' y ') + '.' }
      }, env, request);
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json(405, { error: { message: 'Método no permitido: ' + request.method } }, env, request);
    }

    const key = (env.NVIDIA_API_KEY || '').trim();
    if (!key) {
      return json(500, {
        error: { message: 'El Worker no tiene la clave: ejecuta "wrangler secret put NVIDIA_API_KEY" y vuelve a desplegar.' }
      }, env, request);
    }

    let upstream;
    try {
      upstream = await fetch(NVIDIA_ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers: {
          'Authorization': 'Bearer ' + key,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: request.method === 'GET' ? undefined : await request.text()
      });
    } catch (e) {
      return json(502, { error: { message: 'No se pudo contactar con NVIDIA: ' + e.message } }, env, request);
    }

    // Se reenvia el cuerpo tal cual (con los 401/404/429 de NVIDIA) para que la
    // app distinga cuota agotada de modelo retirado. Solo se reescribe CORS: la
    // cabecera de NVIDIA solo vale para build.nvidia.com.
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        ...corsHeaders(env, request),
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json'
      }
    });
  }
};

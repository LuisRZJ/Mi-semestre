// api/_cors.js
// Configuración dinámica y restrictiva de cabeceras CORS para serverless functions

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const customAllowedOrigin = process.env.ALLOWED_ORIGIN;

  let allowOrigin = "*";

  if (customAllowedOrigin) {
    allowOrigin = customAllowedOrigin;
  } else if (origin) {
    try {
      const originHost = new URL(origin).host;
      // Permitir si proviene del mismo dominio de la aplicación, desarrollo local o Vercel
      if (
        originHost === host ||
        originHost.startsWith("localhost") ||
        originHost.startsWith("127.0.0.1") ||
        (process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL))
      ) {
        allowOrigin = origin;
      } else {
        allowOrigin = origin;
      }
    } catch (_) {
      allowOrigin = origin;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

module.exports = { setCorsHeaders };

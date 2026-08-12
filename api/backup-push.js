const crypto = require("crypto");
const { checkRateLimit, recordFailedAttempt, resetFailedAttempts } = require("./_rate-limit");
const { setCorsHeaders } = require("./_cors");

function timingSafeCompare(a, b) {
  try {
    const aBuffer = Buffer.from(String(a));
    const bBuffer = Buffer.from(String(b));
    if (aBuffer.length !== bBuffer.length) {
      crypto.timingSafeEqual(aBuffer, aBuffer);
      return false;
    }
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch (_) { return false; }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 1. Verificar Límite de Intentos (Rate Limiting)
  const rateLimitStatus = await checkRateLimit(req);
  if (rateLimitStatus.isRateLimited) {
    res.setHeader("Retry-After", String(rateLimitStatus.retryAfterSec));
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Por favor espera ${Math.ceil(rateLimitStatus.retryAfterSec / 60)} minuto(s) antes de reintentar.`
    });
  }

  const { password, data } = req.body || {};

  if (!password || !process.env.BACKUP_PASSWORD) {
    await recordFailedAttempt(req);
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!timingSafeCompare(password, process.env.BACKUP_PASSWORD)) {
    await recordFailedAttempt(req);
    return res.status(401).json({ error: "Contrasena incorrecta" });
  }

  // Éxito: Limpiar contador de intentos fallidos
  await resetFailedAttempts(req);

  if (!data || typeof data !== "object")
    return res.status(400).json({ error: "No se proporcionaron datos validos para el backup." });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || "LuisRZJ";
  const repo = process.env.GITHUB_REPO_NAME || "Base-de-datos-Mi-semestre";
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/backup.json`;

  const githubHeaders = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  let sha;
  try {
    const getRes = await fetch(apiUrl, { headers: githubHeaders });
    if (getRes.ok) { const fd = await getRes.json(); sha = fd.sha; }
  } catch (_) {}

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const commitDate = new Date().toISOString();
  const putBody = { message: `Backup actualizado - ${commitDate}`, content, ...(sha ? { sha } : {}) };

  const putRes = await fetch(apiUrl, {
    method: "PUT", headers: githubHeaders, body: JSON.stringify(putBody)
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    return res.status(500).json({ error: "Error al subir el backup a GitHub.", detail: err.message || "" });
  }

  return res.status(200).json({ ok: true, message: "Backup guardado en GitHub exitosamente.", date: commitDate });
};

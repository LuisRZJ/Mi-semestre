// api/_rate-limit.js
// Sistema de Rate Limiting para Serverless Functions en Vercel

const WINDOW_MS = 15 * 60 * 1000; // Ventana de 15 minutos
const MAX_FAILED_ATTEMPTS = 5;      // Máximo 5 intentos fallidos por IP

// Almacenamiento en memoria para instancias cálidas de Vercel
const attemptsMap = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "127.0.0.1";
}

function cleanExpiredAttempts(now) {
  for (const [ip, data] of attemptsMap.entries()) {
    if (now - data.firstAttempt > WINDOW_MS) {
      attemptsMap.delete(ip);
    }
  }
}

/**
 * Comprueba si una IP ha excedido el límite de intentos fallidos.
 * Devuelve { isRateLimited: boolean, remainingAttempts: number, retryAfterSec: number }
 */
async function checkRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  cleanExpiredAttempts(now);

  const entry = attemptsMap.get(ip);
  if (!entry) {
    return { isRateLimited: false, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSec: 0 };
  }

  // Si la ventana expiró, reseteamos
  if (now - entry.firstAttempt > WINDOW_MS) {
    attemptsMap.delete(ip);
    return { isRateLimited: false, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSec: 0 };
  }

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const elapsedSec = Math.ceil((now - entry.firstAttempt) / 1000);
    const retryAfterSec = Math.max(1, Math.ceil(WINDOW_MS / 1000) - elapsedSec);
    return { isRateLimited: true, remainingAttempts: 0, retryAfterSec };
  }

  return {
    isRateLimited: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - entry.count,
    retryAfterSec: 0
  };
}

/**
 * Registra un intento fallido de autenticación para la IP.
 */
async function recordFailedAttempt(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  cleanExpiredAttempts(now);

  const entry = attemptsMap.get(ip);
  if (!entry || (now - entry.firstAttempt > WINDOW_MS)) {
    attemptsMap.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

/**
 * Limpia los intentos fallidos al autenticarse correctamente.
 */
async function resetFailedAttempts(req) {
  const ip = getClientIp(req);
  attemptsMap.delete(ip);
}

module.exports = {
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  getClientIp
};

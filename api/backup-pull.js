const crypto = require("crypto");

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};

  if (!password || !process.env.BACKUP_PASSWORD)
    return res.status(401).json({ error: "Unauthorized" });

  if (!timingSafeCompare(password, process.env.BACKUP_PASSWORD))
    return res.status(401).json({ error: "Contrasena incorrecta" });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || "LuisRZJ";
  const repo = process.env.GITHUB_REPO_NAME || "Base-de-datos-Mi-semestre";
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/backup.json`;

  const getRes = await fetch(apiUrl, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (getRes.status === 404)
    return res.status(404).json({ error: "No se encontro ningun backup en la nube. Sube uno primero." });

  if (!getRes.ok)
    return res.status(500).json({ error: "Error al obtener el backup de GitHub." });

  const fileData = await getRes.json();
  const decoded = Buffer.from(fileData.content, "base64").toString("utf-8");
  const data = JSON.parse(decoded);

  return res.status(200).json({ ok: true, data });
};

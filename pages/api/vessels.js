// pages/api/vessels.js

import { Buffer } from "buffer";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO; // ex: "seuUsuario/seuRepositorio"
const filePath = process.env.GITHUB_FILE_PATH; // ex: "data/vessels.json"

const GH_API_BASE = "https://api.github.com";

function ensureEnvOk() {
  if (!token || !repo || !filePath) {
    throw new Error(
      "Environment variables faltando. Verifique GITHUB_TOKEN, GITHUB_REPO e GITHUB_FILE_PATH."
    );
  }
}

function parseRepo(repoStr) {
  const [owner, repoName] = (repoStr || "").split("/");
  if (!owner || !repoName) {
    throw new Error(
      "GITHUB_REPO inválido. Use o formato 'owner/repo', ex: 'felippe/svnp-imbetiba'"
    );
  }
  return { owner, repoName };
}

export default async function handler(req, res) {
  try {
    ensureEnvOk();
  } catch (err) {
    console.error("[/api/vessels] ERRO ENV:", err.message);
    return res.status(500).json({ error: err.message });
  }

  const { owner, repoName } = parseRepo(repo);

  if (req.method === "GET") {
    try {
      const ghRes = await fetch(
        `${GH_API_BASE}/repos/${owner}/${repoName}/contents/${encodeURIComponent(
          filePath
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }
      );

      // Se o arquivo não existir ainda, devolve base vazia
      if (ghRes.status === 404) {
        return res.status(200).json({ data: [], sha: null });
      }

      if (!ghRes.ok) {
        const text = await ghRes.text();
        console.error("[/api/vessels] GET GitHub error:", ghRes.status, text);
        return res.status(ghRes.status).json({
          error: "Falha ao ler arquivo no GitHub",
          details: text,
        });
      }

      const ghJson = await ghRes.json();
      const { content, sha } = ghJson;

      let data = [];
      try {
        const decoded = Buffer.from(content, "base64").toString("utf8");
        data = JSON.parse(decoded);
        if (!Array.isArray(data)) {
          console.warn(
            "[/api/vessels] Conteúdo não é um array. Forçando array vazio."
          );
          data = [];
        }
      } catch (err) {
        console.error("[/api/vessels] Erro ao decodificar/parsing JSON:", err);
        // Se der erro de parse, melhor retornar vazio mas com aviso
        return res.status(500).json({
          error: "Erro ao interpretar JSON do GitHub",
          details: err.message,
        });
      }

      return res.status(200).json({ data, sha: sha || null });
    } catch (err) {
      console.error("[/api/vessels] GET error:", err);
      return res.status(500).json({ error: "Erro interno no GET" });
    }
  }

  if (req.method === "PUT") {
    try {
      const body = req.body || {};
      const data = Array.isArray(body.data) ? body.data : [];
      const incomingSha = body.sha || null;

      // Monta o conteúdo em base64
      const content = Buffer.from(
        JSON.stringify(data, null, 2),
        "utf8"
      ).toString("base64");

      const ghRes = await fetch(
        `${GH_API_BASE}/repos/${owner}/${repoName}/contents/${encodeURIComponent(
          filePath
        )}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Update vessels via SVNP-Imbetiba",
            content,
            // Se não tiver SHA, o GitHub cria o arquivo
            ...(incomingSha ? { sha: incomingSha } : {}),
          }),
        }
      );

      if (!ghRes.ok) {
        const text = await ghRes.text();
        console.error("[/api/vessels] PUT GitHub error:", ghRes.status, text);
        return res.status(ghRes.status).json({
          error: "Falha ao salvar arquivo no GitHub",
          details: text,
        });
      }

      const ghJson = await ghRes.json();
      const newSha = ghJson.content?.sha || null;

      return res.status(200).json({ ok: true, sha: newSha });
    } catch (err) {
      console.error("[/api/vessels] PUT error:", err);
      return res.status(500).json({ error: "Erro interno no PUT" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).json({ error: "Method not allowed" });
}

// pages/api/vessels.js

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO; // Ex: "seu-usuario/seu-repo"
const filePath = process.env.GITHUB_FILE_PATH || "data/vessels.json";

if (!token || !repo || !filePath) {
  console.warn(
    "[/api/vessels] Variáveis de ambiente ausentes. " +
      "Defina GITHUB_TOKEN, GITHUB_REPO e GITHUB_FILE_PATH."
  );
}

/**
 * Lê o arquivo de embarcações no GitHub.
 * Retorna { data: [], sha: string | null }
 */
async function readFromGitHub() {
  if (!token || !repo || !filePath) {
    return { data: [], sha: null, error: "Env vars not configured" };
  }

  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (res.status === 404) {
    // Arquivo ainda não existe → retorna base vazia
    return { data: [], sha: null };
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[readFromGitHub] Erro HTTP:", res.status, text);
    throw new Error(`GitHub GET failed: ${res.status}`);
  }

  const json = await res.json();

  if (!json.content) {
    console.error("[readFromGitHub] Resposta sem 'content':", json);
    throw new Error("Invalid GitHub response (no content)");
  }

  const buff = Buffer.from(json.content, json.encoding || "base64");
  let data;
  try {
    data = JSON.parse(buff.toString("utf8"));
  } catch (e) {
    console.error("[readFromGitHub] Falha ao parsear JSON:", e);
    data = [];
  }

  return { data, sha: json.sha || null };
}

/**
 * Escreve o arquivo de embarcações no GitHub.
 * payloadData → array de embarcações
 * sha         → sha atual (ou null se arquivo novo)
 */
async function writeToGitHub(payloadData, sha) {
  if (!token || !repo || !filePath) {
    throw new Error("Env vars not configured");
  }

  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const content = Buffer.from(
    JSON.stringify(payloadData, null, 2),
    "utf8"
  ).toString("base64");

  const body = {
    message: "chore: update SVNP vessels database",
    content,
    committer: {
      name: "SVNP-Imbetiba Bot",
      email: "svnp-bot@example.com",
    },
  };

  if (sha) {
    // Atualização de arquivo existente
    body.sha = sha;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[writeToGitHub] Erro HTTP:", res.status, json);
    throw new Error(
      json.message || `GitHub PUT failed: ${res.status}`
    );
  }

  const newSha = json.content?.sha || null;
  return { sha: newSha };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await readFromGitHub();
      return res.status(200).json({
        data: Array.isArray(result.data) ? result.data : [],
        sha: result.sha || null,
      });
    }

    if (req.method === "PUT") {
      const { data, sha } = req.body || {};

      if (!Array.isArray(data)) {
        return res
          .status(400)
          .json({ error: "Campo 'data' deve ser um array de embarcações." });
      }

      const writeResult = await writeToGitHub(data, sha || null);

      return res.status(200).json({
        ok: true,
        sha: writeResult.sha,
      });
    }

    // Outros métodos não permitidos
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[/api/vessels] Erro geral:", err);
    return res.status(500).json({
      error: err.message || "Erro interno na API de vessels.",
    });
  }
}

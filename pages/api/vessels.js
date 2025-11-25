// pages/api/vessels.js

// Garante que essa API rode no runtime Node.js da Vercel
export const config = {
  runtime: "nodejs",
};

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO;
const filePath = process.env.GITHUB_FILE_PATH;
const branch = process.env.GITHUB_BRANCH || "main";

export default async function handler(req, res) {
  // Validação básica de env vars
  if (!token || !repo || !filePath) {
    return res.status(500).json({
      error:
        "Variáveis de ambiente ausentes. Defina GITHUB_TOKEN, GITHUB_REPO e GITHUB_FILE_PATH.",
    });
  }

  // -------------------------------
  // GET — LER VESSELS DO GITHUB
  // -------------------------------
  if (req.method === "GET") {
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;

    try {
      const githubRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (githubRes.status === 404) {
        // Arquivo ainda não existe → retorna lista vazia
        return res.status(200).json({ data: [], sha: null });
      }

      if (!githubRes.ok) {
        console.error("Erro GitHub GET:", githubRes.status);
        return res
          .status(500)
          .json({ error: "Erro ao acessar o repositório no GitHub." });
      }

      const json = await githubRes.json();
      const decoded = Buffer.from(json.content, "base64").toString("utf8");

      let parsed = [];
      try {
        parsed = JSON.parse(decoded);
      } catch {
        parsed = [];
      }

      return res.status(200).json({
        data: parsed,
        sha: json.sha,
      });
    } catch (err) {
      console.error("Erro GET /api/vessels:", err);
      return res
        .status(500)
        .json({ error: "Erro ao acessar o repositório no GitHub." });
    }
  }

  // -------------------------------
  // PUT — SALVAR VESSELS NO GITHUB
  // -------------------------------
  if (req.method === "PUT") {
    try {
      const { data, sha } = req.body || {};

      const encodedContent = Buffer.from(
        JSON.stringify(data || [], null, 2)
      ).toString("base64");

      const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

      const githubRes = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: "Update vessels database from SVNP-Imbetiba",
          content: encodedContent,
          sha: sha || null, // se null → cria o arquivo
          branch,
        }),
      });

      if (!githubRes.ok) {
        const errorText = await githubRes.text();
        console.error("Erro GitHub PUT:", errorText);
        return res
          .status(500)
          .json({ error: "Falha ao salvar dados no GitHub." });
      }

      const json = await githubRes.json();

      return res.status(200).json({
        ok: true,
        sha: json.content.sha,
      });
    } catch (err) {
      console.error("Erro PUT /api/vessels:", err);
      return res
        .status(500)
        .json({ error: "Erro ao salvar dados no GitHub." });
    }
  }

  // Qualquer outro método → 405
  return res.status(405).json({ error: "Method not allowed" });
}

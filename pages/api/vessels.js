import { NextRequest } from "next/server";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO;
const filePath = process.env.GITHUB_FILE_PATH;
const branch = process.env.GITHUB_BRANCH || "main";

// -------------------------------
// GET — LER VESSELS DO GITHUB
// -------------------------------
export async function GET() {
  if (!token || !repo || !filePath) {
    return Response.json(
      {
        error:
          "Variáveis de ambiente ausentes. Defina GITHUB_TOKEN, GITHUB_REPO e GITHUB_FILE_PATH.",
      },
      { status: 500 }
    );
  }

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
      return Response.json({ data: [], sha: null });
    }

    if (!githubRes.ok) {
      throw new Error(`Erro ao acessar: ${githubRes.status}`);
    }

    const json = await githubRes.json();

    const decoded = Buffer.from(json.content, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);

    return Response.json({
      data: parsed,
      sha: json.sha,
    });
  } catch (err) {
    console.error("Erro GET /api/vessels:", err);
    return Response.json(
      { error: "Erro ao acessar o repositório no GitHub." },
      { status: 500 }
    );
  }
}

// -------------------------------
// PUT — SALVAR VESSELS NO GITHUB
// -------------------------------
export async function PUT(req: NextRequest) {
  if (!token || !repo || !filePath) {
    return Response.json(
      {
        error:
          "Variáveis de ambiente ausentes. Defina GITHUB_TOKEN, GITHUB_REPO e GITHUB_FILE_PATH.",
      },
      { status: 500 }
    );
  }

  try {
    const { data, sha } = await req.json();

    const encodedContent = Buffer.from(
      JSON.stringify(data, null, 2)
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
        sha: sha || null, // Se null → cria o arquivo no GitHub
        branch,
      }),
    });

    if (!githubRes.ok) {
      const errorText = await githubRes.text();
      console.error("Erro GitHub:", errorText);
      throw new Error("Falha ao salvar no GitHub");
    }

    const json = await githubRes.json();

    return Response.json({
      ok: true,
      sha: json.content.sha,
    });
  } catch (err) {
    console.error("Erro PUT /api/vessels:", err);
    return Response.json(
      { error: "Erro ao salvar dados no GitHub." },
      { status: 500 }
    );
  }
}

import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Função de limpeza robusta para variáveis de ambiente
const sanitize = (val: string | undefined) => 
  val?.replace(/['"]/g, "").trim() || "";

// Priorização correta para ambientes Vercel e Supabase
const supabaseUrl = sanitize(
  process.env.SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

// Alterado para priorizar ANON_KEY e evitar chaves de gerenciamento (sb_secret)
const supabaseKey = sanitize(
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Credenciais do Supabase ausentes ou inválidas. Leaderboard desativado.");
} else {
  console.log(`📡 Conectando ao Supabase: ${supabaseUrl.substring(0, 25)}...`);
}

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const tableName = process.env.SUPABASE_TABLE_NAME || 'leaderboard';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/leaderboard", async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/scores", async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }
    const { username, score } = req.body;
    if (!username || typeof score !== 'number') {
      return res.status(400).json({ error: "Invalid score data" });
    }

    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert([{ username, score }])
        .select();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Error saving score:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

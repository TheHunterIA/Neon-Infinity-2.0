import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leaderboard", async (req, res) => {
    try {
      if (!supabase) {
        console.error("Supabase client not initialized - missing environment variables");
        return res.status(503).json({ error: "Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY." });
      }
      
      const { data, error } = await supabase
        .from("scores")
        .select("username, score")
        .order("score", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Supabase select error:", error);
        return res.status(500).json({ error: error.message, details: error });
      }
      res.json(data || []);
    } catch (err: any) {
      console.error("Internal server error during leaderboard fetch:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/scores", async (req, res) => {
    const { username, score } = req.body;
    
    if (!username || typeof score !== "number") {
      return res.status(400).json({ error: "Invalid data: username (string) and score (number) are required" });
    }

    try {
      if (!supabase) {
        return res.status(503).json({ error: "Supabase not configured" });
      }

      const { error } = await supabase
        .from("scores")
        .insert([{ username, score }]);

      if (error) {
        console.error("Supabase insert error:", error);
        return res.status(500).json({ error: error.message, details: error });
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Internal server error during score save:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
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

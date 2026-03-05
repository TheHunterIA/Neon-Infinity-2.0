import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Supabase client
const sanitize = (val: string | undefined) => val?.replace(/['"]/g, "").trim() || "";

const supabaseUrl = sanitize(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = sanitize(
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase credentials missing. Leaderboard will be disabled.");
} else {
  console.log(`📡 Initializing Supabase with URL: ${supabaseUrl.substring(0, 20)}...`);
  console.log(`🔑 Using Key starting with: ${supabaseKey.substring(0, 10)}...`);
  
  if (!supabaseUrl.startsWith("https://")) {
    console.error("❌ Invalid SUPABASE_URL: Must start with https://");
  }
}

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Diagnostic Route
  app.get("/api/debug/supabase", async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ 
        status: "error", 
        message: "Supabase client not initialized",
        env: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
          urlStart: supabaseUrl?.substring(0, 10),
          keyStart: supabaseKey?.substring(0, 10)
        }
      });
    }

    try {
      // Try to fetch 1 row from leaderboard
      const { data, error, status } = await supabase
        .from("leaderboard")
        .select("count", { count: "exact", head: true });

      if (error) {
        return res.status(status || 500).json({ 
          status: "error", 
          message: error.message, 
          code: error.code,
          hint: error.hint,
          details: error 
        });
      }

      res.json({ 
        status: "ok", 
        message: "Connected to Supabase successfully",
        tableExists: true
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // API Routes
  app.get("/api/leaderboard", async (req, res) => {
    try {
      if (!supabase) {
        console.error("Supabase client not initialized - missing environment variables");
        return res.status(503).json({ error: "Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY." });
      }
      
      const { data, error } = await supabase
        .from("leaderboard")
        .select("metadata, score")
        .order("score", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Supabase select error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ error: error.message, details: error });
      }

      // Map metadata.username to username for the frontend
      const mappedData = (data || []).map((entry: any) => ({
        username: entry.metadata?.username || "Unknown Dasher",
        score: entry.score
      }));

      res.json(mappedData);
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
        .from("leaderboard")
        .insert([{ 
          user_id: "00000000-0000-0000-0000-000000000000", // Placeholder for guest
          score, 
          metadata: { username } 
        }]);

      if (error) {
        console.error("Supabase insert error:", JSON.stringify(error, null, 2));
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

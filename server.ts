import express from "express";
import { createServer as createViteServer } from "vite";
import { sql } from "@vercel/postgres";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize database table
async function initDb() {
  try {
    // Check if we have the POSTGRES_URL before attempting to run SQL
    if (!process.env.POSTGRES_URL) {
      console.warn("POSTGRES_URL is not defined. Database features will be unavailable.");
      return;
    }
    await sql`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("Database table initialized or already exists.");
  } catch (err) {
    console.error("Failed to initialize database table:", err);
  }
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leaderboard", async (req, res) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(503).json({ error: "Database not configured" });
      }
      const { rows } = await sql`
        SELECT username, score 
        FROM scores 
        ORDER BY score DESC 
        LIMIT 10
      `;
      res.json(rows);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/scores", async (req, res) => {
    const { username, score } = req.body;
    console.log(`Received score: ${username} - ${score}`);
    
    if (!username || typeof score !== "number") {
      console.error("Invalid data received for score");
      return res.status(400).json({ error: "Invalid data" });
    }

    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(503).json({ error: "Database not configured" });
      }
      await sql`
        INSERT INTO scores (username, score) 
        VALUES (${username}, ${score})
      `;
      console.log(`Score saved successfully for ${username}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to save score to database:", err);
      res.status(500).json({ error: "Database error" });
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

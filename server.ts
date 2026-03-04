import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "leaderboard.db");
console.log(`Initializing database at: ${dbPath}`);
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leaderboard", (req, res) => {
    const scores = db.prepare("SELECT username, score FROM scores ORDER BY score DESC LIMIT 10").all();
    res.json(scores);
  });

  app.post("/api/scores", (req, res) => {
    const { username, score } = req.body;
    console.log(`Received score: ${username} - ${score}`);
    if (!username || typeof score !== "number") {
      console.error("Invalid data received for score");
      return res.status(400).json({ error: "Invalid data" });
    }
    try {
      db.prepare("INSERT INTO scores (username, score) VALUES (?, ?)").run(username, score);
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

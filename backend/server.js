require("dotenv").config();

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "change-me-in-kubernetes-secret";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username },
    jwtSecret,
    { expiresIn: "8h" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: Number(payload.sub), username: payload.username };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({
      error: "Username must have at least 3 characters and password at least 6"
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }
    throw error;
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const result = await pool.query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  res.json({
    token: signToken(user),
    user: { id: user.id, username: user.username }
  });
});

app.get("/api/todos", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, title, completed, created_at, updated_at FROM todos WHERE user_id = $1 ORDER BY id DESC",
    [req.user.id]
  );
  res.json(result.rows);
});

app.post("/api/todos", requireAuth, async (req, res) => {
  const title = String(req.body.title || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Todo title is required" });
  }

  const result = await pool.query(
    "INSERT INTO todos (user_id, title) VALUES ($1, $2) RETURNING id, title, completed, created_at, updated_at",
    [req.user.id, title]
  );
  res.status(201).json(result.rows[0]);
});

app.put("/api/todos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const title = typeof req.body.title === "string" ? req.body.title.trim() : null;
  const completed =
    typeof req.body.completed === "boolean" ? req.body.completed : null;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid todo id" });
  }

  const result = await pool.query(
    `UPDATE todos
     SET title = COALESCE($1, title),
         completed = COALESCE($2, completed),
         updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, title, completed, created_at, updated_at`,
    [title, completed, id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Todo not found" });
  }

  res.json(result.rows[0]);
});

app.delete("/api/todos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid todo id" });
  }

  const result = await pool.query(
    "DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Todo not found" });
  }

  res.status(204).send();
});

app.get("/api/load", (_req, res) => {
  const started = Date.now();
  let value = 0;
  while (Date.now() - started < 120) {
    value += Math.sqrt(Math.random() * 1000000);
  }
  res.json({ status: "load generated", value });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`TodoList API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });

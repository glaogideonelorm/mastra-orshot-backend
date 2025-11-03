// src/server.ts
import "dotenv/config";
import express from "express";
import { env } from "./env.js";
import { handleLanding } from "./routes/a2a.js";
import { handleA2A } from "./routes/a2aRoot.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Telex A2A entrypoint
app.post("/a2a", handleA2A);

// Optional: direct testing endpoint
app.post("/a2a/agent/landing", handleLanding);

app.listen(env.PORT, () => {
  console.log(`Mastra server listening on :${env.PORT}`);
});

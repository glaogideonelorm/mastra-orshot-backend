// src/server.ts
import "dotenv/config";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { env } from "./env.js";
import { handleLanding } from "./routes/a2a.js";
import { renderLandingFromMessage } from "./routes/a2a.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").trim();
}

function extractMessageAndFormat(body: any) {
  // JSON-RPC from Telex
  if (body?.jsonrpc === "2.0" && body?.method === "message/send") {
    const parts = body?.params?.message?.parts ?? [];

    // last non-empty text part
    let text = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if ((p?.kind || p?.type) === "text" && typeof p?.text === "string") {
        const cleaned = stripHtml(p.text);
        if (cleaned.length > 0) {
          text = cleaned;
          break;
        }
      }
    }

    return {
      message: text || undefined,
      format: "png" as const,
      source: "jsonrpc",
    };
  }

  // Bare shape for manual testing
  if (typeof body?.message === "string") {
    return {
      message: body.message,
      format: (body?.format as "png" | "pdf") ?? "png",
      source: "bare",
    };
  }

  return { message: undefined, format: "png" as const, source: "unknown" };
}

export async function handleA2A(req: Request, res: Response) {
  const rpcId = (req.body as any)?.id ?? null;
  const { message, format, source } = extractMessageAndFormat(req.body);

  console.log("[A2A] source:", source, "message:", message?.slice(0, 80));

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(200).json({
      jsonrpc: "2.0",
      id: rpcId,
      error: {
        code: -32602,
        message: "message required",
      },
    });
  }

  try {
    // 1) Call Orshot via our helper
    const { url, meta } = await renderLandingFromMessage(message, format);

    // 2) Build a Task object with a Message Telex can display
    const taskId = uuidv4();
    const contextId = uuidv4();
    const messageId = uuidv4();

    const agentMessage = {
      role: "agent" as const,
      parts: [
        {
          kind: "text",
          text: `Here’s your generated landing page mock:\n${url}`,
        },
      ],
      messageId,
      taskId,
      contextId,
      kind: "message" as const,
    };

    const task = {
      id: taskId,
      contextId,
      status: {
        state: "completed",
        message: agentMessage,
        timestamp: new Date().toISOString(),
      },
      artifacts: [
        {
          artifactId: uuidv4(),
          name: "Landing page mock",
          parts: [
            {
              kind: "text",
              text: url, // Telex will render as link; UI can also fetch the image directly
            },
          ],
        },
      ],
      metadata: {
        ...meta,
      },
      kind: "task" as const,
    };

    // 3) Return JSON-RPC response
    return res.status(200).json({
      jsonrpc: "2.0",
      id: rpcId,
      result: task,
    });
  } catch (e: any) {
    console.error("A2A error:", e);
    return res.status(200).json({
      jsonrpc: "2.0",
      id: rpcId,
      error: {
        code: -32603,
        message: String(e.message ?? e).slice(0, 300),
      },
    });
  }
}

// Telex A2A entrypoint
app.post("/a2a", (req: Request, res: Response) => handleA2A(req, res));

// Optional: direct test endpoint
app.post("/a2a/agent/landing", handleLanding);

app.listen(env.PORT, () => {
  console.log(`Mastra server listening on :${env.PORT}`);
});
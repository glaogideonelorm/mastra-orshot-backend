import type { Request, Response } from "express";
import { handleLanding } from "./a2a.js";

// Helper: strip simple HTML tags
function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").trim();
}

function extractMessageAndFormat(body: any) {
  // (A) Simple node envelope
  if (body?.action === "renderLanding") {
    return {
      message: body?.payload?.message,
      format: body?.payload?.format ?? "png",
      source: "node-envelope",
    };
  }

  // (B) JSON-RPC message/send used by Telex A2A
  if (body?.jsonrpc === "2.0" && body?.method === "message/send") {
    const parts = body?.params?.message?.parts ?? [];

    // 1) Find the last non-empty text part
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

    // 2) If still empty, try looking inside data arrays
    if (!text) {
      for (let i = parts.length - 1; i >= 0 && !text; i--) {
        const p = parts[i];
        if ((p?.kind || p?.type) === "data" && Array.isArray(p?.data)) {
          for (let j = p.data.length - 1; j >= 0; j--) {
            const d = p.data[j];
            if (
              (d?.kind || d?.type) === "text" &&
              typeof d?.text === "string"
            ) {
              const cleaned = stripHtml(d.text);
              if (cleaned.length > 0) {
                text = cleaned;
                break;
              }
            }
          }
        }
      }
    }

    return { message: text || undefined, format: "png", source: "jsonrpc" };
  }

  // (C) Bare { message, format }
  if (typeof body?.message === "string") {
    return {
      message: body.message,
      format: body?.format ?? "png",
      source: "bare",
    };
  }

  return { message: undefined, format: "png", source: "unknown" };
}

export async function handleA2A(req: Request, res: Response) {
  const { message, format, source } = extractMessageAndFormat(req.body);
  console.log("[A2A] source:", source, "message:", message?.slice(0, 80));

  if (!message || !message.trim()) {
    return res.status(400).json({
      ok: false,
      error: "no text found in JSON-RPC message",
    });
  }

  req.body = { message, format };
  return handleLanding(req, res);
}

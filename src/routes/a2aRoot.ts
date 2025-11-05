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
      pushConfig: null,
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

    return {
      message: text || undefined,
      format: "png",
      source: "jsonrpc",
      pushConfig: body?.params?.configuration?.pushNotificationConfig || null
    };
  }

  // (C) Bare { message, format }
  if (typeof body?.message === "string") {
    return {
      message: body.message,
      format: body?.format ?? "png",
      source: "bare",
      pushConfig: null,
    };
  }

  return { message: undefined, format: "png", source: "unknown", pushConfig: null };
}

async function sendTelexCallback(pushConfig: any, text: string) {
  if (!pushConfig?.url || !pushConfig?.token) return;

  await fetch(pushConfig.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Telex told us to use Bearer
      Authorization: `Bearer ${pushConfig.token}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "message/create",
      params: {
        message: {
          kind: "message",
          role: "assistant",
          parts: [
            {
              kind: "text",
              text
            }
          ]
        }
      }
    })
  });
}

export async function handleA2A(req: Request, res: Response) {
  const { message, format, source, pushConfig } = extractMessageAndFormat(req.body);
  console.log("[A2A] source:", source, "message:", message?.slice(0, 80));

  if (!message || !message.trim()) {
    return res.status(400).json({
      ok: false,
      error: "no text found in JSON-RPC message"
    });
  }

  // 1) Call your existing landing handler, but intercept the JSON it would send
  //    Simplest quick hack: call handleLanding-like logic in a helper.
  //    For now, we'll reuse handleLanding by faking a mini Response object.

  let resultBody: any = null;
  const fakeRes = {
    status: (_code: number) => fakeRes,
    json: (body: any) => {
      resultBody = body;
      return fakeRes;
    }
  } as unknown as Response;

  // Call your existing logic to generate the Orshot URL
  req.body = { message, format };
  await handleLanding(req, fakeRes);

  // If we got a valid result, push it back to Telex as plain text with the URL
  if (resultBody?.ok && resultBody?.url && pushConfig) {
    const text = `Here is your landing page mock:\n${resultBody.url}`;
    await sendTelexCallback(pushConfig, text);
  }

  // 2) Return the original result for validators / debugging
  if (resultBody) {
    return res.json(resultBody);
  }

  // Fallback
  return res.status(500).json({ ok: false, error: "failed to render landing page" });
}

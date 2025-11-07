// src/routes/a2aRoot.ts

import type { Request, Response } from "express";

import { renderLandingFromMessage } from "./a2a.js";



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



    const pushConfig =

      body?.params?.configuration?.pushNotificationConfig || null;



    return {

      message: text || undefined,

      format: "png" as const,

      source: "jsonrpc",

      pushConfig,

    };

  }



  // Bare shape for manual testing

  if (typeof body?.message === "string") {

    return {

      message: body.message,

      format: (body?.format as "png" | "pdf") ?? "png",

      source: "bare",

      pushConfig: null,

    };

  }



  return { message: undefined, format: "png" as const, source: "unknown", pushConfig: null };

}



async function sendTelexCallback(pushConfig: any, text: string) {

  if (!pushConfig?.url || !pushConfig?.token) return;



  try {

    await fetch(pushConfig.url, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        Authorization: `Bearer ${pushConfig.token}`,

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

                text,

              },

            ],

          },

        },

      }),

    });

  } catch (e) {

    console.error("Telex callback failed:", e);

  }

}



export async function handleA2A(req: Request, res: Response) {

  const { message, format, source, pushConfig } = extractMessageAndFormat(

    req.body

  );



  console.log("[A2A] source:", source, "message:", message?.slice(0, 80));



  if (!message || !message.trim()) {

    return res

      .status(400)

      .json({ ok: false, error: "no text found in JSON-RPC message" });

  }



  try {

    const result = await renderLandingFromMessage(

      message,

      format as "png" | "pdf"

    );



    // Fire-and-forget callback to Telex so it shows up in the chat UI

    if (result?.ok && result.url && pushConfig) {

      const text = `Here is your landing page mock:\n${result.url}`;

      await sendTelexCallback(pushConfig, text);

    }



    // Also return result to the original A2A caller (for validator/logs)

    return res.json(result);

  } catch (e: any) {

    return res

      .status(500)

      .json({ ok: false, error: String(e.message ?? e).slice(0, 300) });

  }

}
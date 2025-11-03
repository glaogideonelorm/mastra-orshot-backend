//a2a.ts
import type { Request, Response } from "express";
import { ModsSchema } from "../lib/schema.js";
import { env } from "../env.js";

// Orshot fetch with timeouts and retries
async function orshotFetch(
  path: string,
  body: any,
  timeoutMs = 30000,
  retries = 1
) {
  const url = `https://api.orshot.com/v1/${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ORSHOT_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      clearTimeout(t);

      if (!res.ok) throw new Error(`Orshot ${res.status}: ${await res.text()}`);

      return res.json();
    } catch (e) {
      clearTimeout(t);
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

// Orshot Studio render (for user-designed templates)
async function orshotStudioFetch(body: any, timeoutMs = 30000, retries = 1) {
  const url = `https://api.orshot.com/v1/studio/render`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ORSHOT_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      clearTimeout(t);

      if (!res.ok)
        throw new Error(`Orshot Studio ${res.status}: ${await res.text()}`);

      return res.json();
    } catch (e) {
      clearTimeout(t);
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

// Smart routing function that determines template type and generates modifications
async function generateModifications(message: string): Promise<any> {
  // Check if this is a screenshot request (contains URL or screenshot keywords)
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  const hasScreenshotKeywords =
    /\b(screenshot|screen.?shot|capture|image of)\b/i.test(message);

  if (urlMatch || hasScreenshotKeywords) {
    // Screenshot template - extract URL or use example
    const websiteUrl = urlMatch ? urlMatch[1] : "https://example.com";
    return { websiteUrl };
  } else {
    // Landing page template - generate creative content based on prompt
    // This is where you'd integrate with a real LLM in production
    const prompt = message.toLowerCase();

    let headline = "Transform Your Business Today";
    let primaryCta = "Get Started";
    let subheadline = "Join thousands of satisfied customers";
    let palette = "brand";

    // Customize based on prompt content
    if (prompt.includes("gym") || prompt.includes("fitness")) {
      headline = "Transform Your Fitness Journey";
      primaryCta = "Start Your Journey";
      subheadline = "Achieve your goals with our comprehensive platform";
      palette = prompt.includes("neon") ? "dark-neon" : "brand";
    } else if (prompt.includes("saas") || prompt.includes("software")) {
      headline = "Streamline Your Workflow";
      primaryCta = "Try Free";
      subheadline = "The modern solution for growing businesses";
    } else if (prompt.includes("ecommerce") || prompt.includes("shop")) {
      headline = "Shop with Confidence";
      primaryCta = "Shop Now";
      subheadline = "Quality products at competitive prices";
    }

    return {
      headline,
      primaryCta,
      subheadline,
      secondaryCta: "Learn More",
      features: [
        { title: "Easy Setup", desc: "Get started in minutes" },
        { title: "24/7 Support", desc: "We're here when you need us" },
        { title: "Secure & Reliable", desc: "Your data is safe with us" },
      ],
      quotes: ["This changed everything for us!", "Best decision we ever made"],
      palette,
    };
  }
}

export async function handleLanding(req: Request, res: Response) {
  const { message, format = "png" } = (req.body ?? {}) as {
    message?: string;
    format?: "png" | "pdf";
  };

  if (!message) {
    return res.status(400).json({ ok: false, error: "message required" });
  }

  try {
    // Determine if this is a screenshot request
    const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
    const hasScreenshotKeywords =
      /\b(screenshot|screen.?shot|capture|image of)\b/i.test(message);
    const wantsScreenshot = urlMatch || hasScreenshotKeywords;

    if (wantsScreenshot) {
      // LIBRARY TEMPLATE (string id + /v1/generate/images)
      const extractedUrl = urlMatch ? urlMatch[1] : "https://example.com";

      const renderType = format === "pdf" ? "pdfs" : "images";
      const orshotBody = {
        templateId: env.ORSHOT_TEMPLATE_ID_SCREENSHOT, // "website-screenshot"
        response: { type: "url", format },
        modifications: {
          websiteUrl: extractedUrl,
          fullCapture: true,
          delay: 1500,
          width: 1440,
          height: 1024,
        },
      };

      const orshotData = await orshotFetch(
        `generate/${renderType}`,
        orshotBody
      );

      // Library render returns { data: { content: "url" } } (same as Studio)
      const url = orshotData?.data?.content || orshotData?.url;
      if (!url) {
        throw new Error("Orshot: no render URL in response");
      }

      return res.json({
        ok: true,
        type: "content",
        contentType: format === "pdf" ? "document" : "image",
        url,
        meta: {
          format,
          templateId: env.ORSHOT_TEMPLATE_ID_SCREENSHOT,
          templateType: "screenshot",
          modifications: orshotBody.modifications,
        },
      });
    } else {
      // STUDIO TEMPLATE (numeric id + /v1/studio/render)
      const modifications = await generateModifications(message);
      const validatedMods = ModsSchema.parse(modifications);

      const orshotBody = {
        templateId: Number(env.ORSHOT_TEMPLATE_ID_LANDING), // 1340
        modifications: validatedMods,
        response: { type: "url", format: format, scale: 1 },
      };

      const orshotData = await orshotStudioFetch(orshotBody);

      // Studio render returns { data: { content: "url" } }
      const url = orshotData?.data?.content;
      if (!url) {
        throw new Error("Orshot Studio: no render URL in response");
      }

      return res.json({
        ok: true,
        type: "content",
        contentType: format === "pdf" ? "document" : "image",
        url,
        meta: {
          format,
          templateId: env.ORSHOT_TEMPLATE_ID_LANDING,
          templateType: "studio",
          modifications: validatedMods,
        },
      });
    }
  } catch (e: any) {
    // Don't leak secrets; keep errors short.
    return res
      .status(500)
      .json({ ok: false, error: String(e.message ?? e).slice(0, 300) });
  }
}

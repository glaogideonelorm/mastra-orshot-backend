import { Agent } from "@mastra/core/agent";
import { ModsSchema } from "../lib/schema.js";

export const landingAgent = new Agent({
  name: "landingAgent",
  instructions: `You convert a user's brief into JSON for ONE of two templates:

1) Screenshot: {"websiteUrl": "<https://...>"} when the user asks for a screenshot of an existing site.

2) Landing concept: {
  "headline": "...",
  "primaryCta": "...",
  "subheadline": "...",
  "features": [{"title":"...","desc":"..."}...],
  "quotes": ["...","..."],
  "palette": "dark-neon" | "light-clean" | "brand",
  "bgImageUrl": "<optional>"
}

Output JSON only. Choose the appropriate template based on user intent.`,
  model: "openai/gpt-4", // You may need to configure this properly
});

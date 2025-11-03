import { z } from "zod";

const ScreenshotSchema = z.object({
  websiteUrl: z.string().url(),
});

const LandingSchema = z.object({
  headline: z.string(),
  primaryCta: z.string(),
  subheadline: z.string().optional(),
  secondaryCta: z.string().optional(),
  bgImageUrl: z.string().url().optional(),
  features: z
    .array(
      z.object({
        title: z.string(),
        desc: z.string(),
      })
    )
    .min(1)
    .max(3)
    .optional(),
  quotes: z.array(z.string()).min(1).max(3).optional(),
  footerNote: z.string().optional(),
  palette: z.enum(["dark-neon", "light-clean", "brand"]).optional(),
});

export const ModsSchema = z.union([ScreenshotSchema, LandingSchema]);

export type Mods = z.infer<typeof ModsSchema>;
export type ScreenshotMods = z.infer<typeof ScreenshotSchema>;
export type LandingMods = z.infer<typeof LandingSchema>;

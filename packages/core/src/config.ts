import { z } from "zod";

const safeLinkSchema = z.string().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}, "Links must use https:// or mailto:");

export const providerSchema = z.enum([
  "local",
  "openai",
  "anthropic",
  "compatible",
  "mock",
]);

export const contextClassificationSchema = z.enum([
  "public",
  "local-only",
  "disabled",
]);

export const contextDocumentSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  content: z.string().min(1).max(50_000),
  classification: contextClassificationSchema,
});

export const siteConfigSchema = z.object({
  profile: z.object({
    name: z.string().min(1).max(80),
    handle: z.string().max(80),
    bio: z.string().max(280),
    status: z.string().max(80),
    avatar: z.string().max(2048).optional(),
  }),
  appearance: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    radius: z.enum(["square", "soft", "round"]),
  }),
  links: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(120),
        href: safeLinkSchema,
        description: z.string().max(240),
        icon: z.enum([
          "globe",
          "github",
          "discord",
          "mail",
          "heart",
          "code",
          "link",
        ]),
        enabled: z.boolean(),
      }),
    )
    .max(30),
  chat: z.object({
    enabled: z.boolean(),
    title: z.string().min(1).max(120),
    placeholder: z.string().min(1).max(120),
    welcome: z.string().min(1).max(500),
    provider: providerSchema,
    model: z.string().min(1).max(160),
    systemPrompt: z.string().min(1).max(8_000),
    maxInputCharacters: z.number().int().min(1).max(4_000),
  }),
  footer: z.object({
    showPoweredBy: z.boolean(),
    text: z.string().max(160),
  }),
});

export const runtimeConfigSchema = z.object({
  site: siteConfigSchema,
  context: z.array(contextDocumentSchema).max(100),
});

export type Provider = z.infer<typeof providerSchema>;
export type ContextClassification = z.infer<
  typeof contextClassificationSchema
>;
export type ContextDocument = z.infer<typeof contextDocumentSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

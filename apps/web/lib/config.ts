import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runtimeConfigSchema, type RuntimeConfig } from "@bioctl/core";

function configDirectory(): string {
  return process.env.BIOCTL_CONFIG_DIR
    ? path.resolve(process.env.BIOCTL_CONFIG_DIR)
    : existsSync(path.resolve(process.cwd(), "config", "site.json"))
      ? path.resolve(process.cwd(), "config")
      : path.resolve(process.cwd(), "../../config");
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const directory = configDirectory();
  const [siteRaw, contextRaw] = await Promise.all([
    readFile(path.join(directory, "site.json"), "utf8"),
    readFile(path.join(directory, "context.json"), "utf8"),
  ]);

  const parsedSite: unknown = JSON.parse(siteRaw);
  const parsedContext: unknown = JSON.parse(contextRaw);
  return runtimeConfigSchema.parse({
    site: parsedSite,
    context: parsedContext,
  });
}

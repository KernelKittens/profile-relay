import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  runtimeConfigSchema,
  siteConfigSchema,
  type ContextDocument,
  type RuntimeConfig,
  type SiteConfig,
} from "@bioctl/core";

export type ConnectorConfig = {
  siteUrl: string;
  bridgeToken: string;
  connectorId: string;
  modelEndpoint: string;
  models: string[];
};

export function findProjectRoot(start = process.cwd()): string {
  let current = path.resolve(start);
  for (;;) {
    if (
      existsSync(path.join(current, "config", "site.json")) &&
      existsSync(path.join(current, "config", "context.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Could not find config/site.json. Run bioctl inside the project.");
    }
    current = parent;
  }
}

async function readJson(filename: string): Promise<unknown> {
  return JSON.parse(await readFile(filename, "utf8")) as unknown;
}

async function writeJsonAtomic(filename: string, value: unknown): Promise<void> {
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, filename);
}

export async function loadProjectConfig(root = findProjectRoot()): Promise<RuntimeConfig> {
  return runtimeConfigSchema.parse({
    site: await readJson(path.join(root, "config", "site.json")),
    context: await readJson(path.join(root, "config", "context.json")),
  });
}

export async function saveSiteConfig(site: SiteConfig, root = findProjectRoot()): Promise<void> {
  const parsed = siteConfigSchema.parse(site);
  await writeJsonAtomic(path.join(root, "config", "site.json"), parsed);
}

export async function saveContext(
  site: SiteConfig,
  context: ContextDocument[],
  root = findProjectRoot(),
): Promise<void> {
  const parsed = runtimeConfigSchema.parse({ site, context });
  await writeJsonAtomic(path.join(root, "config", "context.json"), parsed.context);
}

export function connectorConfigPath(): string {
  const base =
    process.platform === "win32"
      ? process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
      : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "bioctl", "connector.json");
}

export async function loadConnectorConfig(): Promise<ConnectorConfig> {
  const fileConfig = existsSync(connectorConfigPath())
    ? ((await readJson(connectorConfigPath())) as Partial<ConnectorConfig>)
    : {};
  const config: ConnectorConfig = {
    siteUrl: process.env.BIOCTL_SITE_URL || fileConfig.siteUrl || "",
    bridgeToken: process.env.BIOCTL_BRIDGE_TOKEN || fileConfig.bridgeToken || "",
    connectorId: process.env.BIOCTL_CONNECTOR_ID || fileConfig.connectorId || "",
    modelEndpoint:
      process.env.BIOCTL_MODEL_ENDPOINT || fileConfig.modelEndpoint || "http://127.0.0.1:11434",
    models: (process.env.BIOCTL_MODELS?.split(",") || fileConfig.models || []).filter(Boolean),
  };
  return config;
}

export async function saveConnectorConfig(config: ConnectorConfig): Promise<void> {
  const filename = connectorConfigPath();
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  await writeJsonAtomic(filename, config);
}

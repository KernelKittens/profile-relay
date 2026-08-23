#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ContextClassification, Provider, SiteConfig } from "@bioctl/core";
import { runConnector } from "./connector.js";
import {
  findProjectRoot,
  loadProjectConfig,
  saveConnectorConfig,
  saveContext,
  saveSiteConfig,
} from "./files.js";

const colors = {
  pink: "\u001b[38;5;205m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  reset: "\u001b[0m",
};

function paint(value: string, color: string): string {
  return output.isTTY ? `${color}${value}${colors.reset}` : value;
}

function heading(): void {
  output.write(`\n${paint("bioctl", colors.bold + colors.pink)} ${paint("white-label link page + isolated chat", colors.dim)}\n`);
  output.write(`${paint("project", colors.dim)} ${findProjectRoot()}\n\n`);
}

async function ask(rl: Interface, label: string, current?: string): Promise<string> {
  const suffix = current ? ` ${paint(`[${current}]`, colors.dim)}` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || current || "";
}

async function choose<T extends string>(
  rl: Interface,
  label: string,
  choices: readonly T[],
  current?: T,
): Promise<T> {
  output.write(`${label}\n`);
  choices.forEach((choice, index) => {
    const marker = choice === current ? "*" : " ";
    output.write(`  ${marker} ${index + 1}. ${choice}\n`);
  });
  const answer = await ask(rl, "select", current ? String(choices.indexOf(current) + 1) : "1");
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || !choices[index]) throw new Error("Invalid selection.");
  return choices[index];
}

function help(): void {
  output.write(`
  /site       name, handle, bio, and status
  /links      add, remove, or toggle a link
  /theme      colors and corner style
  /provider   local, OpenAI, Anthropic, compatible, or demo
  /model      model name
  /context    add or remove context with a data class
  /limits     visitor input limit
  /connect    save the outbound local connector settings
  /domain     print a Caddy custom-domain block
  /doctor     validate config and provider requirements
  /export     print the public configuration
  /help       show this list
  /quit       exit

`);
}

async function editSite(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site } = await loadProjectConfig(root);
  site.profile.name = await ask(rl, "name", site.profile.name);
  site.profile.handle = await ask(rl, "handle", site.profile.handle);
  site.profile.bio = await ask(rl, "bio", site.profile.bio);
  site.profile.status = await ask(rl, "status", site.profile.status);
  await saveSiteConfig(site, root);
  output.write("saved config/site.json\n");
}

async function editTheme(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site } = await loadProjectConfig(root);
  site.appearance.accent = await ask(rl, "accent hex", site.appearance.accent);
  site.appearance.background = await ask(rl, "background hex", site.appearance.background);
  site.appearance.surface = await ask(rl, "surface hex", site.appearance.surface);
  site.appearance.foreground = await ask(rl, "text hex", site.appearance.foreground);
  site.appearance.radius = await choose(
    rl,
    "corner style",
    ["square", "soft", "round"] as const,
    site.appearance.radius,
  );
  await saveSiteConfig(site, root);
  output.write("theme saved\n");
}

async function editProvider(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site } = await loadProjectConfig(root);
  site.chat.provider = await choose(
    rl,
    "provider",
    ["local", "openai", "anthropic", "compatible", "mock"] as const,
    site.chat.provider,
  ) as Provider;
  await saveSiteConfig(site, root);
  output.write(`provider=${site.chat.provider}\n`);
}

async function editModel(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site } = await loadProjectConfig(root);
  site.chat.model = await ask(rl, "model", site.chat.model);
  await saveSiteConfig(site, root);
  output.write(`model=${site.chat.model}\n`);
}

async function editLinks(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site } = await loadProjectConfig(root);
  output.write("\n");
  site.links.forEach((link, index) => {
    output.write(`  ${index + 1}. ${link.enabled ? "on " : "off"} ${link.label} -> ${link.href}\n`);
  });
  const action = await choose(rl, "link action", ["add", "toggle", "remove", "cancel"] as const);
  if (action === "cancel") return;
  if (action === "add") {
    const label = await ask(rl, "label");
    const href = await ask(rl, "https or mailto link");
    const description = await ask(rl, "description");
    site.links.push({ id: randomUUID(), label, href, description, icon: "link", enabled: true });
  } else {
    const selected = Number(await ask(rl, "link number")) - 1;
    const link = site.links[selected];
    if (!link) throw new Error("Link not found.");
    if (action === "toggle") link.enabled = !link.enabled;
    if (action === "remove") site.links.splice(selected, 1);
  }
  await saveSiteConfig(site, root);
  output.write("links saved\n");
}

async function editContext(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site, context } = await loadProjectConfig(root);
  output.write("\n");
  context.forEach((document, index) => {
    output.write(`  ${index + 1}. [${document.classification}] ${document.title}\n`);
  });
  const action = await choose(rl, "context action", ["add", "remove", "cancel"] as const);
  if (action === "cancel") return;
  if (action === "add") {
    const title = await ask(rl, "title");
    const content = await ask(rl, "content");
    const classification = await choose(
      rl,
      "data class",
      ["public", "local-only", "disabled"] as const,
      "public",
    ) as ContextClassification;
    context.push({ id: randomUUID(), title, content, classification });
  } else {
    const selected = Number(await ask(rl, "context number")) - 1;
    if (!context[selected]) throw new Error("Context entry not found.");
    context.splice(selected, 1);
  }
  await saveContext(site, context, root);
  output.write("context saved\n");
}

async function editLimits(rl: Interface): Promise<void> {
  const root = findProjectRoot();
  const { site } = await loadProjectConfig(root);
  site.chat.maxInputCharacters = Number(
    await ask(rl, "maximum visitor characters", String(site.chat.maxInputCharacters)),
  );
  await saveSiteConfig(site, root);
  output.write("limits saved\n");
}

async function configureConnector(rl: Interface): Promise<void> {
  const siteUrl = await ask(rl, "public site URL", "https://bio.example.com");
  const bridgeToken = await ask(rl, "bridge token (32+ random characters)");
  const modelEndpoint = await ask(rl, "local OpenAI-compatible endpoint", "http://127.0.0.1:11434");
  const models = (await ask(rl, "allowed models, comma separated", "llama3.2"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  await saveConnectorConfig({ siteUrl, bridgeToken, modelEndpoint, models, connectorId: randomUUID() });
  output.write("connector saved. run: bioctl bridge\n");
}

async function doctor(): Promise<boolean> {
  const root = findProjectRoot();
  const { site, context } = await loadProjectConfig(root);
  const checks: Array<[string, boolean, string]> = [
    ["site config", true, "valid"],
    ["context", true, `${context.length} entries`],
    ["placeholder links", !site.links.some((link) => /example\.com$/i.test(new URL(link.href).hostname)), "replace example.com before launch"],
  ];
  if (site.chat.provider === "local") {
    checks.push(["bridge token", Boolean(process.env.BIOCTL_BRIDGE_TOKEN?.length && process.env.BIOCTL_BRIDGE_TOKEN.length >= 32), "BIOCTL_BRIDGE_TOKEN must be 32+ characters on the server"]);
  }
  if (site.chat.provider === "openai") checks.push(["OpenAI key", Boolean(process.env.OPENAI_API_KEY), "OPENAI_API_KEY"]);
  if (site.chat.provider === "anthropic") checks.push(["Anthropic key", Boolean(process.env.ANTHROPIC_API_KEY), "ANTHROPIC_API_KEY"]);
  if (site.chat.provider === "compatible") checks.push(["compatible URL", Boolean(process.env.BIOCTL_COMPATIBLE_BASE_URL), "BIOCTL_COMPATIBLE_BASE_URL"]);
  output.write("\n");
  for (const [name, ok, detail] of checks) {
    output.write(`${ok ? "ok " : "!! "}${name}: ${detail}\n`);
  }
  return checks.every(([, ok]) => ok);
}

async function interactive(): Promise<void> {
  heading();
  help();
  const rl = createInterface({ input, output });
  try {
    for (;;) {
      const command = (await rl.question(paint("bioctl> ", colors.pink))).trim().toLowerCase();
      try {
        if (command === "/quit" || command === "quit" || command === "exit") break;
        if (command === "/help" || command === "help" || !command) help();
        else if (command === "/site") await editSite(rl);
        else if (command === "/links") await editLinks(rl);
        else if (command === "/theme") await editTheme(rl);
        else if (command === "/provider") await editProvider(rl);
        else if (command === "/model") await editModel(rl);
        else if (command === "/context") await editContext(rl);
        else if (command === "/limits") await editLimits(rl);
        else if (command === "/connect") await configureConnector(rl);
        else if (command === "/doctor") await doctor();
        else if (command === "/export") output.write(`${JSON.stringify((await loadProjectConfig()).site, null, 2)}\n`);
        else if (command === "/domain") {
          const domain = await ask(rl, "domain", "bio.example.com");
          output.write(`\n${domain} {\n  reverse_proxy 127.0.0.1:3000\n}\n\n`);
        } else output.write("unknown command. use /help\n");
      } catch (error) {
        output.write(`${paint("error", colors.pink)}: ${error instanceof Error ? error.message : "unknown error"}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

const command = process.argv[2];
if (command === "bridge") {
  await runConnector();
} else if (command === "doctor") {
  process.exitCode = (await doctor()) ? 0 : 1;
} else if (command === "help" || command === "--help" || command === "-h") {
  heading();
  help();
  output.write("non-interactive: bioctl doctor | bioctl bridge\n");
} else {
  await interactive();
}

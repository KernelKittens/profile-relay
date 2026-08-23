import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ModelMessage } from "@bioctl/core";

export type RelayPayload = {
  model: string;
  messages: ModelMessage[];
};

export type RelayJob = RelayPayload & {
  id: string;
  expiresAt: number;
};

export type PublicJob = {
  status: "queued" | "leased" | "complete" | "failed";
  reply?: string;
  error?: string;
};

type JobRow = {
  id: string;
  status: PublicJob["status"];
  model: string;
  payload: string;
  result: string | null;
  error: string | null;
  expires_at: number;
  connector_id: string | null;
};

export class RelayStore {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    }
    this.database = new DatabaseSync(filename);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 3000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS relay_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'complete', 'failed')),
        model TEXT NOT NULL,
        payload TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        lease_until INTEGER NOT NULL DEFAULT 0,
        connector_id TEXT
      );
      CREATE INDEX IF NOT EXISTS relay_jobs_claim
      ON relay_jobs (status, expires_at, created_at);
    `);
  }

  close(): void {
    this.database.close();
  }

  enqueue(payload: RelayPayload, now = Date.now()): string {
    const id = randomBytes(24).toString("base64url");
    this.cleanup(now);
    this.database
      .prepare(`
        INSERT INTO relay_jobs
          (id, status, model, payload, created_at, expires_at)
        VALUES (?, 'queued', ?, ?, ?, ?)
      `)
      .run(id, payload.model, JSON.stringify(payload), now, now + 120_000);
    return id;
  }

  claim(
    connectorId: string,
    supportedModels: string[],
    now = Date.now(),
  ): RelayJob | null {
    if (!connectorId || supportedModels.length === 0) return null;
    const models = new Set(supportedModels.slice(0, 32));
    this.cleanup(now);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const candidates = this.database
        .prepare(`
          SELECT id, status, model, payload, result, error, expires_at, connector_id
          FROM relay_jobs
          WHERE expires_at > ?
            AND (status = 'queued' OR (status = 'leased' AND lease_until <= ?))
          ORDER BY created_at ASC
          LIMIT 50
        `)
        .all(now, now) as unknown as JobRow[];
      const row = candidates.find((candidate) => models.has(candidate.model));
      if (!row) {
        this.database.exec("COMMIT");
        return null;
      }

      this.database
        .prepare(`
          UPDATE relay_jobs
          SET status = 'leased', lease_until = ?, connector_id = ?
          WHERE id = ?
        `)
        .run(now + 30_000, connectorId.slice(0, 120), row.id);
      this.database.exec("COMMIT");
      const payload = JSON.parse(row.payload) as RelayPayload;
      return { id: row.id, expiresAt: row.expires_at, ...payload };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  complete(
    id: string,
    connectorId: string,
    outcome: { reply?: string; error?: string },
    now = Date.now(),
  ): boolean {
    const status = outcome.error ? "failed" : "complete";
    const result = outcome.reply?.slice(0, 12_000) ?? null;
    const error = outcome.error?.slice(0, 500) ?? null;
    const changed = this.database
      .prepare(`
        UPDATE relay_jobs
        SET status = ?, result = ?, error = ?, lease_until = 0
        WHERE id = ? AND status = 'leased' AND connector_id = ? AND expires_at > ?
      `)
      .run(status, result, error, id, connectorId.slice(0, 120), now);
    return Number(changed.changes) === 1;
  }

  get(id: string, now = Date.now()): PublicJob | null {
    const row = this.database
      .prepare(`
        SELECT id, status, model, payload, result, error, expires_at, connector_id
        FROM relay_jobs WHERE id = ?
      `)
      .get(id) as unknown as JobRow | undefined;
    if (!row) return null;
    if (row.expires_at <= now && row.status !== "complete") {
      return { status: "failed", error: "The local model request expired." };
    }
    if (row.status === "complete") return { status: "complete", reply: row.result ?? "" };
    if (row.status === "failed") return { status: "failed", error: row.error ?? "Request failed." };
    return { status: row.status };
  }

  private cleanup(now: number): void {
    this.database
      .prepare("DELETE FROM relay_jobs WHERE expires_at < ? AND created_at < ?")
      .run(now - 600_000, now - 600_000);
  }
}

function relayDatabasePath(): string {
  const dataDirectory = process.env.BIOCTL_DATA_DIR
    ? path.resolve(process.env.BIOCTL_DATA_DIR)
    : existsSync(path.resolve(process.cwd(), "config", "site.json"))
      ? path.resolve(process.cwd(), "data")
      : path.resolve(process.cwd(), "../../data");
  return path.join(dataDirectory, "relay.sqlite");
}

const globalForRelay = globalThis as typeof globalThis & {
  bioctlRelayStore?: RelayStore;
};

export const relayStore =
  globalForRelay.bioctlRelayStore ?? new RelayStore(relayDatabasePath());
globalForRelay.bioctlRelayStore = relayStore;

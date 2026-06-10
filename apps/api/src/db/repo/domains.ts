import { eq, desc } from "drizzle-orm";
import { getDrizzle } from "../drizzle";
import { domains } from "../schema";
import type { Domain, CreateDomainInput, DomainValidationStatus, SslStatus } from "../../types";
import { randomUUID } from "node:crypto";
import { now } from "./helpers";

const mapDomain = (row: typeof domains.$inferSelect): Domain => ({
  id: row.id,
  projectId: row.projectId,
  domain: row.domain,
  type: row.type as Domain["type"],
  validationStatus: row.validationStatus as DomainValidationStatus,
  sslStatus: row.sslStatus as SslStatus,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createDomain = async (input: CreateDomainInput): Promise<Domain> => {
  const id = randomUUID();
  const timestamp = now();
  const db = await getDrizzle();
  db.insert(domains).values({
    id,
    projectId: input.projectId,
    domain: input.domain,
    type: input.type,
    validationStatus: "pending",
    sslStatus: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  const row = db.select().from(domains).where(eq(domains.id, id)).get()!;
  return mapDomain(row);
};

export const listDomains = async (projectId: string): Promise<Domain[]> => {
  const db = await getDrizzle();
  return db.select().from(domains).where(eq(domains.projectId, projectId)).orderBy(desc(domains.createdAt)).all().map(mapDomain);
};

export const getDomainById = async (id: string): Promise<Domain | null> => {
  const db = await getDrizzle();
  const row = db.select().from(domains).where(eq(domains.id, id)).get();
  return row ? mapDomain(row) : null;
};

export const updateDomainValidation = async (id: string, validationStatus: DomainValidationStatus, sslStatus?: SslStatus): Promise<void> => {
  const db = await getDrizzle();
  const updates: Record<string, unknown> = { validationStatus, updatedAt: now() };
  if (sslStatus !== undefined) updates.sslStatus = sslStatus;
  db.update(domains).set(updates).where(eq(domains.id, id)).run();
};

export const updateDomainSslStatus = async (id: string, sslStatus: SslStatus): Promise<void> => {
  const db = await getDrizzle();
  db.update(domains).set({ sslStatus, updatedAt: now() }).where(eq(domains.id, id)).run();
};

export const deleteDomain = async (id: string): Promise<boolean> => {
  const db = await getDrizzle();
  return db.delete(domains).where(eq(domains.id, id)).run().changes > 0;
};

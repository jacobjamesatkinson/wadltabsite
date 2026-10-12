import { createHash, randomBytes } from "crypto";

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function tokenPrefix(raw: string): string {
  return raw.slice(0, 8);
}

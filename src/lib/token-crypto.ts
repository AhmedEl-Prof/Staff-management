import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM round-trip helpers for storing OAuth tokens at rest.
//
// Generate a key once:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// then set DRIVE_TOKEN_ENCRYPTION_KEY in your environment.
//
// Format: `iv.ciphertext.authTag` (each base64url).

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard

function getKey(): Buffer {
  const raw = process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "DRIVE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes",
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    authTag.toString("base64url"),
  ].join(".");
}

export function decryptToken(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token");
  }
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

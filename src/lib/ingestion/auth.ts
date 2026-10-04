import { createHmac, timingSafeEqual } from "crypto";

export function secretMatches(given: string | null, secret: string | undefined): boolean {
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** HMAC-SHA256 hex over the raw body. */
export function signatureMatches(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return secretMatches(signature.replace(/^sha256=/, ""), expected);
}

import { Buffer } from "node:buffer";
import { createSign } from "node:crypto";

const PUSH_TOPIC = "ihub_new_opportunities";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects";

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface NewOpportunityPush {
  kind: "hackathon" | "internship";
  title: string;
  organizer: string;
}

type Fetcher = typeof fetch;

export function parseFirebaseServiceAccount(value: string | undefined): FirebaseServiceAccount | null {
  if (!value?.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields.");
  }
  const account = parsed as Record<string, unknown>;
  if (
    typeof account["project_id"] !== "string" ||
    typeof account["client_email"] !== "string" ||
    typeof account["private_key"] !== "string"
  ) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields.");
  }

  return {
    project_id: account["project_id"],
    client_email: account["client_email"],
    private_key: account["private_key"].replace(/\\n/g, "\n"),
  };
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function createSignedAssertion(account: FirebaseServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: FCM_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(account.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function getAccessToken(account: FirebaseServiceAccount, fetcher: Fetcher): Promise<string> {
  const response = await fetcher(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createSignedAssertion(account),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Firebase OAuth token request failed [${response.status}].`);

  const payload: unknown = await response.json();
  const token = (payload as { access_token?: unknown })?.access_token;
  if (typeof token !== "string" || !token) throw new Error("Firebase OAuth response did not include an access token.");
  return token;
}

/** Sends one broadcast for a batch of newly inserted, verified opportunities. */
export async function sendNewOpportunityPush(
  opportunities: NewOpportunityPush[],
  fetcher: Fetcher = fetch,
  serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"],
): Promise<"sent" | "not_configured"> {
  if (opportunities.length === 0) return "not_configured";
  const account = parseFirebaseServiceAccount(serviceAccountJson);
  if (!account) return "not_configured";

  const accessToken = await getAccessToken(account, fetcher);
  const one = opportunities.length === 1 ? opportunities[0] : null;
  const title = one
    ? `New ${one.kind} on iHub`
    : `${opportunities.length} new opportunities on iHub`;
  const body = one
    ? `${one.title} — ${one.organizer}. Tap to explore.`.slice(0, 180)
    : "New verified hackathons and internships are ready. Tap to explore.";

  const response = await fetcher(`${FCM_ENDPOINT}/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        topic: PUSH_TOPIC,
        notification: { title, body },
        data: { type: "new_opportunities", url: "/" },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Firebase push send failed [${response.status}].`);
  return "sent";
}

export { PUSH_TOPIC };

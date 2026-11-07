import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";

import { parseFirebaseServiceAccount, sendNewOpportunityPush } from "./fcm.server";

describe("Firebase opportunity push", () => {
  it("does nothing when Firebase server credentials are not configured", async () => {
    assert.equal(await sendNewOpportunityPush([{ kind: "internship", title: "Data Intern", organizer: "Acme" }], fetch, ""), "not_configured");
  });

  it("rejects malformed service-account configuration", () => {
    assert.throws(() => parseFirebaseServiceAccount("{not-json"), /valid JSON/);
    assert.throws(() => parseFirebaseServiceAccount(JSON.stringify({ project_id: "demo" })), /missing required/);
  });

  it("sends a topic notification for newly verified opportunities", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const serviceAccount = JSON.stringify({
      project_id: "ihub-test",
      client_email: "firebase-adminsdk@example.iam.gserviceaccount.com",
      private_key: privateKey,
    });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(init === undefined ? { url } : { url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({ access_token: "test-access-token", expires_in: 3600 });
      }
      return Response.json({ name: "projects/ihub-test/messages/123" });
    };

    assert.equal(await sendNewOpportunityPush(
      [{ kind: "internship", title: "Data Science Intern", organizer: "Acme" }],
      fetcher,
      serviceAccount,
    ), "sent");
    assert.equal(calls.length, 2);
    assert.equal(calls[1]?.url, "https://fcm.googleapis.com/v1/projects/ihub-test/messages:send");
    assert.equal(new Headers(calls[1]?.init?.headers).get("authorization"), "Bearer test-access-token");
    const payload = JSON.parse(String(calls[1]?.init?.body)) as { message?: { topic?: string; notification?: { title?: string }; data?: { url?: string } } };
    assert.equal(payload.message?.topic, "ihub_new_opportunities");
    assert.equal(payload.message?.notification?.title, "New internship on iHub");
    assert.equal(payload.message?.data?.url, "/");
  });
});

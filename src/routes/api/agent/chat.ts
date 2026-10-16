import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ALL_TAGS } from "@/lib/types";
import {
  buildAgentInstructions,
  extractResponseText,
  formatAgentEvidence,
  runAgentSkill,
} from "@/lib/agent/skills.server";

const RequestBody = z.object({
  message: z.string().trim().min(2).max(1200),
  profile: z.object({
    interests: z.array(z.enum(ALL_TAGS)).max(10).default([]),
    locations: z.array(z.enum(["Hyderabad", "Remote", "Bengaluru", "Pune", "Chennai"])).max(5).default([]),
  }).default({ interests: [], locations: [] }),
});

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/agent/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // The UI is same-origin. Reject cross-site browser requests to reduce
        // accidental third-party use of the server-side model key.
        const origin = request.headers.get("origin");
        if (origin) {
          try {
            if (new URL(origin).origin !== new URL(request.url).origin) {
              return json({ error: "Cross-origin requests are not allowed." }, 403);
            }
          } catch {
            return json({ error: "Invalid request origin." }, 403);
          }
        }

        const key = process.env["OPENAI_API_KEY"];
        if (!key) {
          return json({
            error: "The iHub AI service is not configured yet. Add OPENAI_API_KEY to the server environment; no key is needed in the browser.",
            code: "AI_NOT_CONFIGURED",
          }, 503);
        }

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return json({ error: "Send a JSON request." }, 415);
        }

        let raw: unknown;
        try {
          const length = Number(request.headers.get("content-length") ?? 0);
          if (length > 10_000) return json({ error: "Request body is too large." }, 413);
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body." }, 400);
        }

        const parsed = RequestBody.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "Enter a question and choose valid profile preferences." , code: "INVALID_REQUEST" }, 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const skillResult = await runAgentSkill(supabaseAdmin, parsed.data.message, parsed.data.profile);

          // Do not spend model tokens when there are no verified, active records
          // to ground the answer in.
          if (skillResult.opportunities.length === 0) {
            return json({
              skill: skillResult.skill,
              answer: skillResult.context,
              opportunities: [],
              grounded: true,
            });
          }

          const baseUrl = (process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/$/, "");
          const model = process.env["OPENAI_MODEL"] ?? "gpt-4.1-mini";
          const evidence = formatAgentEvidence(skillResult);
          const response = await fetch(`${baseUrl}/responses`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({
              model,
              store: false,
              max_output_tokens: 650,
              instructions: buildAgentInstructions(skillResult.skill, skillResult.context),
              input: [
                { role: "user", content: [
                  { type: "input_text", text: `Student's question: ${parsed.data.message}\n\nVerified database evidence (JSON):\n${evidence}` },
                ] },
              ],
            }),
          });

          if (!response.ok) {
            // Never return provider response bodies or credentials to the browser.
            return json({
              error: response.status === 429
                ? "The AI service is busy or has reached its usage limit. Try again later."
                : "The AI service could not complete this request. Try again later.",
              code: response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_ERROR",
            }, response.status === 429 ? 429 : 502);
          }

          const payload: unknown = await response.json();
          const answer = extractResponseText(payload);
          if (!answer) return json({ error: "The AI service returned an empty answer.", code: "EMPTY_ANSWER" }, 502);

          return json({
            skill: skillResult.skill,
            answer,
            opportunities: skillResult.opportunities,
            grounded: true,
          });
        } catch (error) {
          console.error("[iHub agent] request failed", error instanceof Error ? error.message : "unknown error");
          return json({
            error: "iHub could not read its verified opportunity data. Check the server's database configuration and try again.",
            code: "AGENT_DATA_ERROR",
          }, 502);
        }
      },
    },
  },
});

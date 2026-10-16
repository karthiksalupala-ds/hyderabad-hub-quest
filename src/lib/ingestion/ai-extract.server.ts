import { parseAiExtraction, type AiExtraction } from "./mapping";

const PROMPT = `You extract structured facts about ONE hackathon or internship from source text.
Rules: use ONLY facts literally stated in the text. If a field is not stated, return null. Never guess dates, amounts, locations or URLs.
Dates as YYYY-MM-DD. Amounts in INR as plain numbers. mode: offline|online|hybrid|remote.
tags: only from [AI/ML, Data Science, Python, Analytics, Web Development, Software Engineering, Agentic AI, MCP, Cloud, Product] when clearly relevant.
relevance: 0-1 for a Hyderabad B.Tech data-science student (metadata only).
Respond with a single JSON object with keys: kind,title,organizer,role,location,mode,start_date,end_date,deadline,fee,prize,stipend,eligibility,tags,relevance.`;

export class AiStop extends Error {}

/** Streams a Responses call and returns parsed JSON, or null when output is invalid. */
export async function aiExtract(evidence: string): Promise<AiExtraction | null> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) return null;
  const baseUrl = (process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env["OPENAI_MODEL"] ?? "gpt-4.1-mini",
      stream: true,
      store: false,
      instructions: PROMPT,
      input: evidence.slice(0, 8000),
    }),
  });
  if (res.status === 402 || res.status === 403 || res.status === 429 || res.status === 401) {
    throw new AiStop(`AI extraction paused [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  }
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(l.slice(5).trim()) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      } catch { /* keep-alive */ }
    }
  }
  return parseAiExtraction(text);
}

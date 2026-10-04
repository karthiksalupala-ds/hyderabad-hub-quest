import { createFileRoute } from "@tanstack/react-router";
import { secretMatches } from "@/lib/ingestion/auth";

/** Apify run-finished webhook. Configure header x-ingest-secret and ?source=<source_id>. */
export const Route = createFileRoute("/api/public/webhooks/apify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secretMatches(request.headers.get("x-ingest-secret"), process.env["INGEST_SECRET"])) return new Response("Unauthorized", { status: 401 });
        const sourceId = new URL(request.url).searchParams.get("source") ?? "";
        const body = (await request.json().catch(() => null)) as { eventType?: string; resource?: { id?: string; defaultDatasetId?: string; status?: string } } | null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: src } = await supabaseAdmin.from("source_registry").select("*").eq("id", sourceId).eq("kind", "apify").maybeSingle();
        const ds = body?.resource?.defaultDatasetId;
        if (!src || !ds || body?.resource?.status !== "SUCCEEDED") {
          await supabaseAdmin.from("ingestion_events").insert({ source_id: src?.id ?? null, event_type: body?.eventType ?? "unknown", external_run_id: body?.resource?.id ?? null, status: "rejected", error: "unknown source, missing dataset or run not succeeded" });
          return new Response("Ignored", { status: 202 });
        }
        const { apifyMissing, readApifyDataset } = await import("@/lib/ingestion/adapters.server");
        const { processItems } = await import("@/lib/ingestion/pipeline.server");
        const missing = apifyMissing(src);
        if (missing) return new Response(missing, { status: 409 });
        try {
          const result = await processItems(supabaseAdmin, src, await readApifyDataset(src, ds), src.official_domains, "webhook");
          await supabaseAdmin.from("ingestion_events").insert({ source_id: src.id, event_type: body.eventType ?? "run.succeeded", external_run_id: body.resource.id ?? null, status: "processed" });
          return Response.json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("ingestion_events").insert({ source_id: src.id, event_type: body.eventType ?? "run", status: "error", error: msg });
          return new Response(msg, { status: 502 });
        }
      },
    },
  },
});

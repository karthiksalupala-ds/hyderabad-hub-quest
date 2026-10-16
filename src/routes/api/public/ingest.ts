import { createFileRoute } from "@tanstack/react-router";
import { secretMatches } from "@/lib/ingestion/auth";

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secretMatches(request.headers.get("x-ingest-secret"), process.env["INGEST_SECRET"])) return new Response("Unauthorized", { status: 401 });
        const force = new URL(request.url).searchParams.get("force") === "1";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runIngestion } = await import("@/lib/ingestion/pipeline.server");
        const sourceId = new URL(request.url).searchParams.get("source");
        return Response.json(await runIngestion(supabaseAdmin, { force, ...(sourceId ? { sourceId } : {}) }));
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INGEST_SECRET"];
        const given = request.headers.get("x-ingest-secret") ?? "";
        if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runIngestion } = await import("@/lib/ingestion/pipeline.server");
        const result = await runIngestion(supabaseAdmin);
        return Response.json(result);
      },
    },
  },
});

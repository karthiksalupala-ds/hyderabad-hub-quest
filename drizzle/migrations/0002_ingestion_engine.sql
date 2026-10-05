ALTER TABLE public.source_registry
  ADD COLUMN IF NOT EXISTS adapter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_empty_runs int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_manual_run_at timestamptz;

ALTER TABLE public.ingestion_runs
  ADD COLUMN IF NOT EXISTS duration_ms int,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_verification int NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS ingestion_runs_idem_uq ON public.ingestion_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ingestion_runs_source_started ON public.ingestion_runs(source_id, started_at DESC);

ALTER TABLE public.ingestion_events
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.ingestion_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS ingestion_events_idem_uq ON public.ingestion_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.opportunity_changes DROP CONSTRAINT IF EXISTS opportunity_changes_change_type_check;
ALTER TABLE public.opportunity_changes ADD CONSTRAINT opportunity_changes_change_type_check CHECK (change_type = ANY (ARRAY['new','deadline_changed','location_changed','mode_changed','prize_changed','stipend_changed','application_url_changed','content_changed','details_changed','expired']));

-- Changes are only readable for listings that are publicly visible.
DROP POLICY IF EXISTS "Public read changes" ON public.opportunity_changes;
CREATE POLICY "Public read changes of verified listings" ON public.opportunity_changes FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.status <> 'removed' AND o.verification_status = 'verified'));

ALTER TABLE public.source_registry DROP CONSTRAINT IF EXISTS source_registry_kind_check;
ALTER TABLE public.source_registry ADD CONSTRAINT source_registry_kind_check CHECK (kind = ANY (ARRAY['rss','api','careers','manual','apify','webhook','mcp']));

-- Source definitions only (no opportunities). All disabled until configured.
INSERT INTO public.source_registry (id, name, kind, enabled, status, requirement, discovery_method, priority, poll_interval_minutes, supports_webhook, adapter_config)
VALUES
  ('rest_api', 'Generic REST/API sources', 'api', false, 'not_configured', 'REST_SOURCES secret (JSON) not set', 'api', 40, 360, false, '{"env":"REST_SOURCES"}'),
  ('webmcp', 'WebMCP / MCP tool sources', 'mcp', false, 'not_configured', 'WEBMCP_TOOLS secret (JSON) not set', 'mcp', 60, 720, false, '{"env":"WEBMCP_TOOLS"}'),
  ('signed_webhook', 'Signed webhook events', 'webhook', false, 'not_configured', 'WEBHOOK_SIGNING_SECRET not set', 'webhook', 10, 1440, true, '{}')
ON CONFLICT (id) DO NOTHING;
UPDATE public.source_registry SET adapter_config = '{"env":"INGEST_FEEDS"}' WHERE id='rss';
UPDATE public.source_registry SET adapter_config = '{"env":"CAREER_FEEDS","format":"greenhouse_lever"}', discovery_method='careers' WHERE id='careers';
UPDATE public.source_registry SET adapter_config = '{"env":"COLLEGE_FEEDS"}' WHERE id='college_pages';
UPDATE public.source_registry SET supports_webhook = true WHERE kind='apify';

ALTER TABLE public.opportunity_changes REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunity_changes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ingestion_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.source_registry; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
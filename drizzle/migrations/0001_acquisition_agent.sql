DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname, conrelid::regclass::text AS t FROM pg_constraint
    WHERE contype='c' AND conrelid IN ('public.source_registry'::regclass,'public.opportunities'::regclass)
      AND (pg_get_constraintdef(oid) ILIKE '%kind%rss%' OR pg_get_constraintdef(oid) ILIKE '%verification_status%')
  LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.t, r.conname); END LOOP;
END $$;

ALTER TABLE public.source_registry
  ADD COLUMN IF NOT EXISTS official_domains text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS discovery_method text NOT NULL DEFAULT 'rss',
  ADD COLUMN IF NOT EXISTS actor_id text,
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS allowed_start_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_kind text,
  ADD COLUMN IF NOT EXISTS poll_interval_minutes int NOT NULL DEFAULT 1440,
  ADD COLUMN IF NOT EXISTS supports_webhook boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_counts jsonb;
ALTER TABLE public.source_registry ADD CONSTRAINT source_registry_kind_chk CHECK (kind IN ('rss','api','careers','manual','apify','webhook','mcp'));
ALTER TABLE public.source_registry ADD CONSTRAINT source_registry_poll_chk CHECK (poll_interval_minutes >= 60);

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS application_url text,
  ADD COLUMN IF NOT EXISTS evidence_json jsonb,
  ADD COLUMN IF NOT EXISTS raw_source_hash text,
  ADD COLUMN IF NOT EXISTS verification_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relevance_score numeric,
  ADD COLUMN IF NOT EXISTS last_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_change_summary text;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_verification_chk CHECK (verification_status IN ('verified','needs_verification','unverified','rejected','failed'));
CREATE INDEX IF NOT EXISTS opportunities_verification_idx ON public.opportunities(verification_status);
CREATE INDEX IF NOT EXISTS opportunities_hash_idx ON public.opportunities(content_hash);

ALTER TABLE public.ingestion_runs
  ADD COLUMN IF NOT EXISTS accepted int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicates int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS public.opportunity_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.ingestion_runs(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('new','deadline_changed','location_changed','mode_changed','prize_changed','stipend_changed','details_changed','expired')),
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunity_changes TO anon, authenticated;
GRANT ALL ON public.opportunity_changes TO service_role;
ALTER TABLE public.opportunity_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read changes" ON public.opportunity_changes FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS opportunity_changes_created_idx ON public.opportunity_changes(created_at DESC);

CREATE TABLE IF NOT EXISTS public.ingestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text REFERENCES public.source_registry(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  external_run_id text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','rejected','error')),
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ingestion_events TO anon, authenticated;
GRANT ALL ON public.ingestion_events TO service_role;
ALTER TABLE public.ingestion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read events" ON public.ingestion_events FOR SELECT TO anon, authenticated USING (true);

-- Only verified, non-removed listings are publicly readable
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='opportunities' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.opportunities', p.policyname); END LOOP;
END $$;
CREATE POLICY "Public reads verified listings" ON public.opportunities FOR SELECT TO anon, authenticated
  USING (status <> 'removed' AND verification_status = 'verified');

CREATE OR REPLACE FUNCTION public.opportunity_counts()
RETURNS TABLE(verification_status text, status text, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT verification_status, status, count(*) FROM public.opportunities GROUP BY 1,2
$$;
GRANT EXECUTE ON FUNCTION public.opportunity_counts() TO anon, authenticated;

-- Source definitions only (no opportunities). All disabled until configured.
UPDATE public.source_registry SET discovery_method='rss', poll_interval_minutes=360, priority=20 WHERE id='rss';
UPDATE public.source_registry SET discovery_method='rss', poll_interval_minutes=720, priority=10, requirement='Set CAREER_FEEDS with official Greenhouse/Lever/Workday feed URLs' WHERE id='careers';
UPDATE public.source_registry SET discovery_method='api', official_domains='{devpost.com}', priority=30 WHERE id='devpost';
UPDATE public.source_registry SET discovery_method='api', official_domains='{unstop.com}', priority=30 WHERE id='unstop';
UPDATE public.source_registry SET discovery_method='api', official_domains='{internshala.com}', priority=30 WHERE id='internshala';
INSERT INTO public.source_registry (id,name,kind,enabled,status,requirement,discovery_method,priority,supports_webhook,poll_interval_minutes,default_kind)
VALUES
 ('apify_hackathons','Apify — hackathon pages','apify',false,'not_configured','Connect Apify, then set actor_id, allowed_start_urls and official_domains for a site whose terms permit extraction','apify',40,true,1440,'hackathon'),
 ('apify_internships','Apify — internship pages','apify',false,'not_configured','Connect Apify, then set actor_id, allowed_start_urls and official_domains for a site whose terms permit extraction','apify',40,true,720,'internship'),
 ('linkedin','LinkedIn Jobs','api',false,'disabled','LinkedIn prohibits scraping; only usable through an approved LinkedIn partner program','api',90,false,1440,'internship'),
 ('college_pages','College / university hackathon pages','rss',false,'not_configured','Add official college event RSS/Atom feeds to INGEST_FEEDS','rss',25,false,1440,'hackathon')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE public.source_registry (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('rss','api','careers','manual')),
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','ready','error','disabled')),
  requirement text,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.source_registry TO anon, authenticated;
GRANT ALL ON public.source_registry TO service_role;
ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sources are public" ON public.source_registry FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('hackathon','internship')),
  title text NOT NULL,
  organizer text NOT NULL,
  normalized_title text NOT NULL,
  normalized_organizer text NOT NULL,
  source_id text NOT NULL REFERENCES public.source_registry(id),
  source_name text NOT NULL,
  source_url text NOT NULL,
  canonical_url text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  summary text,
  description text,
  location text,
  city text,
  mode text CHECK (mode IN ('offline','online','hybrid','remote')),
  start_date date,
  end_date date,
  deadline date,
  eligibility text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  fee numeric,
  team_size text,
  prize_pool numeric,
  role text,
  duration text,
  stipend numeric,
  openings integer,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','verified','failed')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','removed')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunities_kind_status_idx ON public.opportunities (kind, status);
CREATE INDEX opportunities_deadline_idx ON public.opportunities (deadline);
CREATE INDEX opportunities_dedupe_idx ON public.opportunities (normalized_organizer, normalized_title);
CREATE INDEX opportunities_tags_idx ON public.opportunities USING gin (tags);
GRANT SELECT ON public.opportunities TO anon, authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active opportunities are public" ON public.opportunities FOR SELECT TO anon, authenticated USING (status <> 'removed');

CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text REFERENCES public.source_registry(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error','skipped')),
  fetched integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  expired integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX ingestion_runs_started_idx ON public.ingestion_runs (started_at DESC);
GRANT SELECT ON public.ingestion_runs TO anon, authenticated;
GRANT ALL ON public.ingestion_runs TO service_role;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Run stats are public" ON public.ingestion_runs FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.expire_opportunities() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.opportunities SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND deadline IS NOT NULL AND deadline < current_date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.expire_opportunities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_opportunities() TO service_role;

ALTER TABLE public.opportunities REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ingestion_runs;

INSERT INTO public.source_registry (id, name, kind, enabled, status, requirement) VALUES
 ('rss', 'RSS / Atom feeds', 'rss', false, 'not_configured', 'Set INGEST_FEEDS secret to a JSON list of permitted feed URLs.'),
 ('devpost', 'Devpost', 'api', false, 'not_configured', 'No official public API. Needs written permission or a partner data feed from Devpost.'),
 ('unstop', 'Unstop', 'api', false, 'not_configured', 'Needs partner API access and an UNSTOP_API_KEY from Unstop.'),
 ('internshala', 'Internshala', 'api', false, 'not_configured', 'Needs partner/affiliate API access and an INTERNSHALA_API_KEY.'),
 ('careers', 'Company career pages', 'careers', false, 'not_configured', 'Set CAREER_FEEDS secret to permitted Greenhouse/Lever board feed URLs.');
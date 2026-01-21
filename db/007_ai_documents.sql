-- AI documents + vector search for MindMesh
-- Run AFTER 006_reminders.sql

-- =====================
-- DOCUMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    source_type text NOT NULL CHECK (source_type IN ('note','task','file','reminder')),
    source_id uuid NOT NULL,
    title text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    tags text[] NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now(),
    embedding vector(768)
);

CREATE UNIQUE INDEX IF NOT EXISTS documents_source_idx ON public.documents (source_type, source_id);
CREATE INDEX IF NOT EXISTS documents_tenant_user_idx ON public.documents (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS documents_updated_idx ON public.documents (updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =====================
-- RLS FOR DOCUMENTS (USER-ONLY)
-- =====================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;
DROP POLICY IF EXISTS documents_delete ON public.documents;

CREATE POLICY documents_select ON public.documents
AS PERMISSIVE FOR SELECT TO authenticated
USING ( user_id = auth.uid() );

CREATE POLICY documents_insert ON public.documents
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY documents_update ON public.documents
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY documents_delete ON public.documents
AS PERMISSIVE FOR DELETE TO authenticated
USING ( user_id = auth.uid() );

-- =====================
-- VECTOR MATCH FUNCTION
-- =====================
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(768),
    match_count int,
    filter_tenant uuid
)
RETURNS TABLE (
    id uuid,
    source_type text,
    source_id uuid,
    title text,
    content text,
    tags text[],
    updated_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE AS $$
    SELECT
        d.id,
        d.source_type,
        d.source_id,
        d.title,
        d.content,
        d.tags,
        d.updated_at,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM public.documents d
    WHERE d.tenant_id = filter_tenant
      AND d.user_id = auth.uid()
      AND d.embedding IS NOT NULL
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_documents(vector(768), int, uuid) TO authenticated;

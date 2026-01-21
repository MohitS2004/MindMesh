-- Files schema and policies for MindMesh
-- Run AFTER 004_fix_rls_recursion.sql

-- =====================
-- FILES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    file_type text NOT NULL CHECK (file_type IN ('upload','link')),
    storage_path text,
    url text,
    mime_type text,
    size_bytes bigint,
    original_name text,
    visibility public.visibility NOT NULL DEFAULT 'private',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS files_tenant_idx ON public.files (tenant_id);
CREATE INDEX IF NOT EXISTS files_user_idx ON public.files (user_id);
CREATE INDEX IF NOT EXISTS files_updated_idx ON public.files (updated_at DESC);

-- =====================
-- UPDATED_AT TRIGGER
-- =====================
DROP TRIGGER IF EXISTS files_set_updated_at ON public.files;
CREATE TRIGGER files_set_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- RLS FOR FILES
-- =====================
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS files_select ON public.files;
DROP POLICY IF EXISTS files_insert ON public.files;
DROP POLICY IF EXISTS files_update ON public.files;
DROP POLICY IF EXISTS files_delete ON public.files;

CREATE POLICY files_select ON public.files
AS PERMISSIVE FOR SELECT TO authenticated
USING ( public.can_access_item(tenant_id, user_id, visibility) );

CREATE POLICY files_insert ON public.files
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND public.is_tenant_member(tenant_id)
);

CREATE POLICY files_update ON public.files
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY files_delete ON public.files
AS PERMISSIVE FOR DELETE TO authenticated
USING ( user_id = auth.uid() );

-- =====================
-- EXTEND ITEM_TAGS FOR FILES
-- =====================
ALTER TABLE public.item_tags DROP CONSTRAINT IF EXISTS item_tags_item_type_check;
ALTER TABLE public.item_tags
  ADD CONSTRAINT item_tags_item_type_check CHECK (item_type IN ('note','task','file'));

-- Ensure tags.item_type supports files if the column exists
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tags'
          AND column_name = 'item_type'
    ) THEN
        ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_item_type_check;
        ALTER TABLE public.tags
          ADD CONSTRAINT tags_item_type_check CHECK (item_type IN ('note','task','file'));
    END IF;
END $$;

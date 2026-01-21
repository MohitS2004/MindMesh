-- Reminders schema and policies for MindMesh
-- Run AFTER 005_files.sql

-- =====================
-- REMINDERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    remind_at timestamptz NOT NULL,
    visibility public.visibility NOT NULL DEFAULT 'private',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_tenant_idx ON public.reminders (tenant_id);
CREATE INDEX IF NOT EXISTS reminders_user_idx ON public.reminders (user_id);
CREATE INDEX IF NOT EXISTS reminders_remind_at_idx ON public.reminders (remind_at);

-- =====================
-- UPDATED_AT TRIGGER
-- =====================
DROP TRIGGER IF EXISTS reminders_set_updated_at ON public.reminders;
CREATE TRIGGER reminders_set_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- RLS FOR REMINDERS
-- =====================
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminders_select ON public.reminders;
DROP POLICY IF EXISTS reminders_insert ON public.reminders;
DROP POLICY IF EXISTS reminders_update ON public.reminders;
DROP POLICY IF EXISTS reminders_delete ON public.reminders;

CREATE POLICY reminders_select ON public.reminders
AS PERMISSIVE FOR SELECT TO authenticated
USING ( public.can_access_item(tenant_id, user_id, visibility) );

CREATE POLICY reminders_insert ON public.reminders
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND public.is_tenant_member(tenant_id)
);

CREATE POLICY reminders_update ON public.reminders
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY reminders_delete ON public.reminders
AS PERMISSIVE FOR DELETE TO authenticated
USING ( user_id = auth.uid() );

-- =====================
-- EXTEND ITEM_TAGS FOR REMINDERS
-- =====================
ALTER TABLE public.item_tags DROP CONSTRAINT IF EXISTS item_tags_item_type_check;
ALTER TABLE public.item_tags
  ADD CONSTRAINT item_tags_item_type_check CHECK (item_type IN ('note','task','file','reminder'));

-- Ensure tags.item_type supports reminders if the column exists
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
          ADD CONSTRAINT tags_item_type_check CHECK (item_type IN ('note','task','file','reminder'));
    END IF;
END $$;

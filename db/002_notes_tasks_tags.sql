-- Notes, Tasks, Tags schema for MindMesh
-- Run AFTER schema.sql and policies.sql

-- =====================
-- TASK STATUS ENUM
-- =====================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('todo','in_progress','done','cancelled');
    END IF;
END $$;

-- =====================
-- NOTES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    visibility public.visibility NOT NULL DEFAULT 'private',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_tenant_idx ON public.notes (tenant_id);
CREATE INDEX IF NOT EXISTS notes_user_idx ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS notes_updated_idx ON public.notes (updated_at DESC);
CREATE INDEX IF NOT EXISTS notes_title_trgm_idx ON public.notes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS notes_body_trgm_idx ON public.notes USING gin (body gin_trgm_ops);

-- =====================
-- TASKS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    status public.task_status NOT NULL DEFAULT 'todo',
    progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    due_date timestamptz,
    visibility public.visibility NOT NULL DEFAULT 'private',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_tenant_idx ON public.tasks (tenant_id);
CREATE INDEX IF NOT EXISTS tasks_user_idx ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_due_idx ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);

-- =====================
-- TAGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name citext NOT NULL,
    color text NOT NULL DEFAULT '#6366f1',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS tags_tenant_idx ON public.tags (tenant_id);
CREATE INDEX IF NOT EXISTS tags_name_idx ON public.tags (name);

-- =====================
-- ITEM_TAGS JUNCTION TABLE (polymorphic)
-- =====================
CREATE TABLE IF NOT EXISTS public.item_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id uuid NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
    item_type text NOT NULL CHECK (item_type IN ('note','task')),
    item_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tag_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS item_tags_tag_idx ON public.item_tags (tag_id);
CREATE INDEX IF NOT EXISTS item_tags_item_idx ON public.item_tags (item_type, item_id);

-- =====================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS notes_set_updated_at ON public.notes;
CREATE TRIGGER notes_set_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- HELPER: Check if user can access note/task
-- =====================
CREATE OR REPLACE FUNCTION public.can_access_item(p_tenant_id uuid, p_user_id uuid, p_visibility public.visibility) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT 
        CASE 
            WHEN p_visibility = 'private' THEN p_user_id = auth.uid()
            WHEN p_visibility = 'org' THEN public.is_tenant_member(p_tenant_id)
            ELSE false
        END;
$$;

-- =====================
-- RLS FOR NOTES
-- =====================
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_select ON public.notes;
DROP POLICY IF EXISTS notes_insert ON public.notes;
DROP POLICY IF EXISTS notes_update ON public.notes;
DROP POLICY IF EXISTS notes_delete ON public.notes;

CREATE POLICY notes_select ON public.notes
AS PERMISSIVE FOR SELECT TO authenticated
USING ( public.can_access_item(tenant_id, user_id, visibility) );

CREATE POLICY notes_insert ON public.notes
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK ( 
    user_id = auth.uid() 
    AND public.is_tenant_member(tenant_id) 
);

CREATE POLICY notes_update ON public.notes
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY notes_delete ON public.notes
AS PERMISSIVE FOR DELETE TO authenticated
USING ( user_id = auth.uid() );

-- =====================
-- RLS FOR TASKS
-- =====================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;

CREATE POLICY tasks_select ON public.tasks
AS PERMISSIVE FOR SELECT TO authenticated
USING ( public.can_access_item(tenant_id, user_id, visibility) );

CREATE POLICY tasks_insert ON public.tasks
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK ( 
    user_id = auth.uid() 
    AND public.is_tenant_member(tenant_id) 
);

CREATE POLICY tasks_update ON public.tasks
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );

CREATE POLICY tasks_delete ON public.tasks
AS PERMISSIVE FOR DELETE TO authenticated
USING ( user_id = auth.uid() );

-- =====================
-- RLS FOR TAGS
-- =====================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select ON public.tags;
DROP POLICY IF EXISTS tags_insert ON public.tags;
DROP POLICY IF EXISTS tags_update ON public.tags;
DROP POLICY IF EXISTS tags_delete ON public.tags;

CREATE POLICY tags_select ON public.tags
AS PERMISSIVE FOR SELECT TO authenticated
USING ( public.is_tenant_member(tenant_id) );

CREATE POLICY tags_insert ON public.tags
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK ( public.is_tenant_member(tenant_id) );

CREATE POLICY tags_update ON public.tags
AS PERMISSIVE FOR UPDATE TO authenticated
USING ( public.is_tenant_admin(tenant_id) )
WITH CHECK ( public.is_tenant_admin(tenant_id) );

CREATE POLICY tags_delete ON public.tags
AS PERMISSIVE FOR DELETE TO authenticated
USING ( public.is_tenant_admin(tenant_id) );

-- =====================
-- RLS FOR ITEM_TAGS
-- =====================
ALTER TABLE public.item_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_tags_select ON public.item_tags;
DROP POLICY IF EXISTS item_tags_insert ON public.item_tags;
DROP POLICY IF EXISTS item_tags_delete ON public.item_tags;

CREATE POLICY item_tags_select ON public.item_tags
AS PERMISSIVE FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tags t 
        WHERE t.id = tag_id 
        AND public.is_tenant_member(t.tenant_id)
    )
);

CREATE POLICY item_tags_insert ON public.item_tags
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tags t 
        WHERE t.id = tag_id 
        AND public.is_tenant_member(t.tenant_id)
    )
);

CREATE POLICY item_tags_delete ON public.item_tags
AS PERMISSIVE FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tags t 
        WHERE t.id = tag_id 
        AND public.is_tenant_member(t.tenant_id)
    )
);

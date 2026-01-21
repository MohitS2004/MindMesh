-- Personal Workspace Feature Migration
-- Run this in Supabase SQL editor AFTER 002_notes_tasks_tags.sql

-- =====================
-- ADD is_personal COLUMN TO TENANTS
-- =====================
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

-- Index for quick lookup of personal workspaces
CREATE INDEX IF NOT EXISTS tenants_is_personal_idx ON public.tenants (is_personal);
CREATE INDEX IF NOT EXISTS tenants_created_by_personal_idx ON public.tenants (created_by, is_personal);

-- =====================
-- FUNCTION: Create personal workspace for a user
-- =====================
CREATE OR REPLACE FUNCTION public.create_personal_workspace(p_user_id uuid, p_user_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_name text;
    v_slug text;
BEGIN
    -- Check if personal workspace already exists
    SELECT t.id INTO v_tenant_id
    FROM public.tenants t
    WHERE t.created_by = p_user_id AND t.is_personal = true
    LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;
    
    -- Generate name and slug from email
    v_name := split_part(p_user_email, '@', 1) || '''s Workspace';
    v_slug := lower(regexp_replace(split_part(p_user_email, '@', 1), '[^a-zA-Z0-9]', '-', 'g')) || '-personal';
    
    -- Create the personal workspace
    INSERT INTO public.tenants (name, slug, created_by, is_personal)
    VALUES (v_name, v_slug, p_user_id, true)
    ON CONFLICT (slug) DO UPDATE SET slug = v_slug || '-' || substr(gen_random_uuid()::text, 1, 8)
    RETURNING id INTO v_tenant_id;
    
    -- Note: The trigger tenants_auto_add_creator_admin will auto-add user as admin
    
    RETURN v_tenant_id;
END;
$$;

-- =====================
-- TRIGGER: Auto-create personal workspace on new user signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user_personal_workspace()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Create personal workspace for new user
    PERFORM public.create_personal_workspace(NEW.id, COALESCE(NEW.email, NEW.id::text));
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_personal_workspace ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created_personal_workspace
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_personal_workspace();

-- =====================
-- PREVENT DELETING PERSONAL WORKSPACE
-- =====================
CREATE OR REPLACE FUNCTION public.prevent_personal_workspace_delete()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.is_personal = true THEN
        RAISE EXCEPTION 'Cannot delete personal workspace' USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tenants_prevent_personal_delete ON public.tenants;
CREATE TRIGGER tenants_prevent_personal_delete
BEFORE DELETE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.prevent_personal_workspace_delete();

-- =====================
-- HELPER: Get or create personal workspace for current user
-- =====================
CREATE OR REPLACE FUNCTION public.get_or_create_personal_workspace()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_user_email text;
    v_tenant_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check if personal workspace exists
    SELECT t.id INTO v_tenant_id
    FROM public.tenants t
    WHERE t.created_by = v_user_id AND t.is_personal = true
    LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;
    
    -- Get user email
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    -- Create personal workspace
    RETURN public.create_personal_workspace(v_user_id, COALESCE(v_user_email, v_user_id::text));
END;
$$;

-- =====================
-- CREATE PERSONAL WORKSPACES FOR EXISTING USERS
-- =====================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, email FROM auth.users LOOP
        PERFORM public.create_personal_workspace(r.id, COALESCE(r.email, r.id::text));
    END LOOP;
END;
$$;

 
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
        CREATE TYPE public.org_role AS ENUM ('viewer','commenter','editor','admin');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility') THEN
        CREATE TYPE public.visibility AS ENUM ('private','org');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT auth.uid();
$$;

CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (char_length(name) > 1),
    slug citext UNIQUE,
    created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants (slug);

CREATE TABLE IF NOT EXISTS public.memberships (
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role public.org_role NOT NULL DEFAULT 'viewer',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_role_idx ON public.memberships (role);

CREATE OR REPLACE FUNCTION public.is_tenant_admin(t_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = t_id
          AND m.user_id = auth.uid()
          AND m.role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(t_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = t_id
          AND m.user_id = auth.uid()
    );
$$;

DROP TRIGGER IF EXISTS tenants_auto_add_creator_admin ON public.tenants;
DROP FUNCTION IF EXISTS public.tenants_auto_add_creator_admin();

CREATE OR REPLACE FUNCTION public.tenants_auto_add_creator_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    RETURN NEW;
END;$$;

CREATE TRIGGER tenants_auto_add_creator_admin
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tenants_auto_add_creator_admin();

DROP TRIGGER IF EXISTS memberships_prevent_last_admin_delete ON public.memberships;
DROP FUNCTION IF EXISTS public.memberships_prevent_last_admin_delete();
DROP TRIGGER IF EXISTS memberships_prevent_last_admin_demotion ON public.memberships;
DROP FUNCTION IF EXISTS public.memberships_prevent_last_admin_demotion();

CREATE OR REPLACE FUNCTION public.memberships_prevent_last_admin_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    admin_count int;
BEGIN
    IF OLD.role = 'admin' THEN
        SELECT COUNT(*) INTO admin_count FROM public.memberships
        WHERE tenant_id = OLD.tenant_id AND role = 'admin' AND user_id <> OLD.user_id;
        IF admin_count = 0 THEN
            RAISE EXCEPTION 'cannot remove the last admin from tenant %', OLD.tenant_id USING ERRCODE = 'raise_exception';
        END IF;
    END IF;
    RETURN OLD;
END;$$;

CREATE TRIGGER memberships_prevent_last_admin_delete
BEFORE DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.memberships_prevent_last_admin_delete();

CREATE OR REPLACE FUNCTION public.memberships_prevent_last_admin_demotion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    remaining_admins int;
BEGIN
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
        SELECT COUNT(*) INTO remaining_admins FROM public.memberships
        WHERE tenant_id = OLD.tenant_id AND role = 'admin' AND user_id <> OLD.user_id;
        IF remaining_admins = 0 THEN
            RAISE EXCEPTION 'cannot demote the last admin from tenant %', OLD.tenant_id USING ERRCODE = 'raise_exception';
        END IF;
    END IF;
    RETURN NEW;
END;$$;

CREATE TRIGGER memberships_prevent_last_admin_demotion
BEFORE UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.memberships_prevent_last_admin_demotion();

 

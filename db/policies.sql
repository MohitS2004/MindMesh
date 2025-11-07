 
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

 
DROP POLICY IF EXISTS tenants_select_if_member ON public.tenants;
DROP POLICY IF EXISTS tenants_insert_if_creator_is_self ON public.tenants;
DROP POLICY IF EXISTS tenants_update_if_admin ON public.tenants;
DROP POLICY IF EXISTS tenants_delete_if_admin ON public.tenants;

CREATE POLICY tenants_select_if_member ON public.tenants
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ( public.is_tenant_member(id) );

CREATE POLICY tenants_insert_if_creator_is_self ON public.tenants
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK ( created_by = auth.uid() );

CREATE POLICY tenants_update_if_admin ON public.tenants
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING ( public.is_tenant_admin(id) )
WITH CHECK ( public.is_tenant_admin(id) );

CREATE POLICY tenants_delete_if_admin ON public.tenants
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ( public.is_tenant_admin(id) );

 
DROP POLICY IF EXISTS memberships_select_if_same_tenant_member ON public.memberships;
DROP POLICY IF EXISTS memberships_insert_if_admin ON public.memberships;
DROP POLICY IF EXISTS memberships_update_if_admin ON public.memberships;
DROP POLICY IF EXISTS memberships_delete_if_admin ON public.memberships;

CREATE POLICY memberships_select_if_same_tenant_member ON public.memberships
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ( public.is_tenant_member(tenant_id) );

CREATE POLICY memberships_insert_if_admin ON public.memberships
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK ( public.is_tenant_admin(tenant_id) );

CREATE POLICY memberships_update_if_admin ON public.memberships
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING ( public.is_tenant_admin(tenant_id) )
WITH CHECK ( public.is_tenant_admin(tenant_id) );

CREATE POLICY memberships_delete_if_admin ON public.memberships
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ( public.is_tenant_admin(tenant_id) );

 

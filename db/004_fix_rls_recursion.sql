-- Fix RLS Recursion Issue
-- Run this in Supabase SQL editor to fix "stack depth limit exceeded" error

-- The issue: RLS policies call is_tenant_member/is_tenant_admin functions
-- which query memberships table, triggering the same RLS policies again → infinite recursion

-- Solution: Mark these functions as SECURITY DEFINER to bypass RLS when checking membership

-- =====================
-- FIX: is_tenant_member with SECURITY DEFINER
-- =====================
CREATE OR REPLACE FUNCTION public.is_tenant_member(t_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = t_id
          AND m.user_id = auth.uid()
    );
$$;

-- =====================
-- FIX: is_tenant_admin with SECURITY DEFINER
-- =====================
CREATE OR REPLACE FUNCTION public.is_tenant_admin(t_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = t_id
          AND m.user_id = auth.uid()
          AND m.role = 'admin'
    );
$$;

-- =====================
-- ALTERNATIVE: Simpler RLS policies that don't use helper functions
-- This is more reliable and avoids any recursion issues
-- =====================

-- Drop existing policies
DROP POLICY IF EXISTS memberships_select_if_same_tenant_member ON public.memberships;
DROP POLICY IF EXISTS memberships_select_own ON public.memberships;

-- Create simple policy: users can see their own memberships
CREATE POLICY memberships_select_own ON public.memberships
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ( user_id = auth.uid() );

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

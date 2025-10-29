-- Migration: RLS Policies
-- Description: Enable Row Level Security with is_member_of() helper function and policies for agencies, agency_members, and sites
-- Author: Dev Agent (James)
-- Date: 2025-10-29

-- =====================================================
-- HELPER FUNCTION
-- =====================================================

-- Helper function to check if current user is member of given agency
CREATE OR REPLACE FUNCTION is_member_of(ag_id UUID) 
RETURNS BOOLEAN
LANGUAGE SQL 
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agency_members
    WHERE agency_id = ag_id AND user_id = auth.uid()
  );
$$;

-- Helper function to get current user's role in given agency
CREATE OR REPLACE FUNCTION get_member_role(ag_id UUID) 
RETURNS member_role
LANGUAGE SQL 
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM agency_members
  WHERE agency_id = ag_id AND user_id = auth.uid()
  LIMIT 1;
$$;

-- =====================================================
-- RLS POLICIES FOR AGENCIES
-- =====================================================

-- Enable RLS on agencies table
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT agencies they are members of
CREATE POLICY agencies_select ON agencies
  FOR SELECT
  USING (is_member_of(id));

-- Policy: Only admins can modify agencies
CREATE POLICY agencies_modify ON agencies
  FOR ALL
  USING (is_member_of(id) AND get_member_role(id) = 'admin');

-- =====================================================
-- RLS POLICIES FOR AGENCY_MEMBERS
-- =====================================================

-- Enable RLS on agency_members table
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT members of agencies they belong to
CREATE POLICY agency_members_select ON agency_members
  FOR SELECT
  USING (is_member_of(agency_id));

-- Policy: Only admins can INSERT members
CREATE POLICY agency_members_insert ON agency_members
  FOR INSERT
  WITH CHECK (is_member_of(agency_id) AND get_member_role(agency_id) = 'admin');

-- Policy: Only admins can UPDATE members
CREATE POLICY agency_members_update ON agency_members
  FOR UPDATE
  USING (is_member_of(agency_id) AND get_member_role(agency_id) = 'admin')
  WITH CHECK (is_member_of(agency_id) AND get_member_role(agency_id) = 'admin');

-- Policy: Only admins can DELETE members
CREATE POLICY agency_members_delete ON agency_members
  FOR DELETE
  USING (is_member_of(agency_id) AND get_member_role(agency_id) = 'admin');

-- =====================================================
-- RLS POLICIES FOR SITES
-- =====================================================

-- Enable RLS on sites table
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT sites of agencies they belong to
CREATE POLICY sites_select ON sites
  FOR SELECT
  USING (is_member_of(agency_id));

-- Policy: Admins and staff can INSERT sites
CREATE POLICY sites_insert ON sites
  FOR INSERT
  WITH CHECK (is_member_of(agency_id) AND get_member_role(agency_id) IN ('admin', 'staff'));

-- Policy: Admins and staff can UPDATE sites
CREATE POLICY sites_update ON sites
  FOR UPDATE
  USING (is_member_of(agency_id) AND get_member_role(agency_id) IN ('admin', 'staff'))
  WITH CHECK (is_member_of(agency_id) AND get_member_role(agency_id) IN ('admin', 'staff'));

-- Policy: Admins and staff can DELETE sites (soft delete)
CREATE POLICY sites_delete ON sites
  FOR DELETE
  USING (is_member_of(agency_id) AND get_member_role(agency_id) IN ('admin', 'staff'));

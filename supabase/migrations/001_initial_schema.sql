-- Migration: Initial Schema
-- Description: Create core tables (agencies, agency_members, sites), enums, foreign keys, and indexes
-- Author: Dev Agent (James)
-- Date: 2025-10-29

-- =====================================================
-- ENUMS
-- =====================================================

-- Agency tier enum: defines subscription levels
CREATE TYPE agency_tier AS ENUM ('base', 'pro', 'agency', 'enterprise_future');

-- Member role enum: defines access levels within agencies
CREATE TYPE member_role AS ENUM ('admin', 'staff', 'client');

-- =====================================================
-- TABLES
-- =====================================================

-- agencies: Root entity for multi-tenancy
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier agency_tier NOT NULL DEFAULT 'base',
  branding_json JSONB NOT NULL DEFAULT '{}',
  custom_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- agency_members: Junction table linking users to agencies with roles
CREATE TABLE public.agency_members (
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, user_id)
);

-- sites: Monitored websites
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  expected_keyword TEXT,
  settings_json JSONB NOT NULL DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, domain)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index on agencies tier for tier-based queries
CREATE INDEX idx_agencies_tier ON agencies(tier);

-- Index on agency_members user_id for user lookup
CREATE INDEX idx_agency_members_user ON agency_members(user_id);

-- Index on sites agency_id for agency-scoped queries
CREATE INDEX idx_sites_agency ON sites(agency_id);

-- Partial index on sites for soft delete queries (only non-deleted)
CREATE INDEX idx_sites_deleted ON sites(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to automatically update updated_at on agencies
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

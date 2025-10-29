-- Migration: Seed Data
-- Description: Populate dev/staging with test agency and demo sites (NOT for production)
-- Author: Dev Agent (James)
-- Date: 2025-10-29

-- =====================================================
-- ENVIRONMENT CHECK
-- =====================================================

-- This seed data should only run in dev/staging environments
-- In production, this will be skipped manually or via deployment config

DO $$
BEGIN
  -- Check if we're in a test/dev environment
  -- This is a safety check - production should have this migration removed or commented out
  RAISE NOTICE 'Running seed data for dev/staging environment';
END $$;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert test agency
INSERT INTO public.agencies (id, name, tier, branding_json, custom_domain, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Test Agency',
  'pro',
  '{"logo_url": "", "primary_color": "#3B82F6", "footer_text": "Powered by Test Agency"}'::jsonb,
  NULL,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Note: agency_member record will be created after first OAuth login
-- The user_id will be populated from auth.users after the user signs in
-- This is a placeholder comment for documentation purposes

-- Insert 3 demo sites
INSERT INTO public.sites (id, agency_id, domain, expected_keyword, settings_json, deleted_at, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'https://example.com',
    'Example Domain',
    '{"check_interval": 300, "alert_recipients": [], "ssl_check_enabled": true}'::jsonb,
    NULL,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'https://test.com',
    'Test Page',
    '{"check_interval": 300, "alert_recipients": [], "ssl_check_enabled": true}'::jsonb,
    NULL,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'https://demo.com',
    'Demo Site',
    '{"check_interval": 300, "alert_recipients": [], "ssl_check_enabled": true}'::jsonb,
    NULL,
    now(),
    now()
  )
ON CONFLICT (agency_id, domain) DO NOTHING;

-- =====================================================
-- POST-SEED NOTES
-- =====================================================

-- After running this migration:
-- 1. Sign in with OAuth (Google/Microsoft/GitHub) to create auth.users record
-- 2. Manually insert agency_member record linking your user_id to test agency:
--    INSERT INTO public.agency_members (agency_id, user_id, role)
--    VALUES ('00000000-0000-0000-0000-000000000001', '<your-user-id>', 'admin');
-- 3. Or create a helper function/API endpoint to auto-create admin membership on first login

DO $$
BEGIN
  RAISE NOTICE 'Seed data completed. Test Agency ID: 00000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'After OAuth login, link your user to test agency with admin role.';
END $$;

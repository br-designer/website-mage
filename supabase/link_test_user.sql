-- Helper Script: Link Test User to Test Agency
-- Run this after your first OAuth login to gain access to the test agency
--
-- Usage:
-- 1. Sign in via OAuth (Google/Microsoft/GitHub) in your app
-- 2. Get your user_id from Supabase Dashboard > Authentication > Users
-- 3. Replace <YOUR-USER-ID> below with your actual user_id
-- 4. Run this SQL in Supabase SQL Editor

INSERT INTO public.agency_members (agency_id, user_id, role, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,  -- Test Agency ID
  '<YOUR-USER-ID>'::uuid,                        -- Replace with your user_id from auth.users
  'admin',
  now()
)
ON CONFLICT (agency_id, user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Verify the link was created
SELECT 
  am.agency_id,
  a.name as agency_name,
  am.user_id,
  u.email,
  am.role
FROM agency_members am
JOIN agencies a ON a.id = am.agency_id
JOIN auth.users u ON u.id = am.user_id
WHERE am.user_id = '<YOUR-USER-ID>'::uuid;

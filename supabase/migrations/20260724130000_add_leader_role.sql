-- Add the Leader role to the hierarchy. super_admin is retained ONLY as a
-- protected internal owner level — it is never shown as a selectable portal
-- role. This runs in its own migration so the new enum value is committed
-- before later migrations/policies reference it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'leader';

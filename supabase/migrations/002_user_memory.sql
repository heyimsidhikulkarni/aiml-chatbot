-- Migration 002: Create user_memory table for cross-chat long-term memory
-- Run this in the Supabase SQL editor for project mykrpktonsjvyzjxdqoc

-- 1. Create table
CREATE TABLE IF NOT EXISTS user_memory (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  summary     text NOT NULL DEFAULT '',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

-- 3. Drop stale policies
DROP POLICY IF EXISTS "Users manage their own memory" ON user_memory;

-- 4. Single policy — users can only read/write their own row
CREATE POLICY "Users manage their own memory"
  ON user_memory FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Also create profiles table if it doesn't exist (used by ChatPanel)
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own profile" ON profiles;

CREATE POLICY "Users manage their own profile"
  ON profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

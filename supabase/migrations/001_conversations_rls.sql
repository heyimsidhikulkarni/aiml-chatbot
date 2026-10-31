-- Migration 001: Enable Row-Level Security on conversations table
-- Run this in the Supabase SQL editor for project mykrpktonsjvyzjxdqoc

-- 1. Ensure the conversations table exists with correct columns
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'A conversation',
  companion   text NOT NULL DEFAULT 'Companion',
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS (idempotent)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 3. Drop any stale / insecure policies before recreating
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

-- 4. Strict per-user policies — auth.uid() is set by Supabase from the JWT,
--    never from a client-supplied value.
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (user_id = auth.uid());

-- 5. Index for fast per-user queries
CREATE INDEX IF NOT EXISTS conversations_user_id_updated_at_idx
  ON conversations (user_id, updated_at DESC);

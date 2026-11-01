-- Migration 003: integrity guards for persistent chat history + long-term memory
-- Run after 001 and 002. Safe to re-run.
-- Policies from 001/002 already enforce ownership (user_id = auth.uid()); this adds
-- defence in depth and data-shape guarantees the backend relies on.

-- 1. conversations.messages must always be a JSON array (backend and frontend both
--    treat it as a list; a stray object/null would break history loading).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_messages_is_array') THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_messages_is_array
      CHECK (jsonb_typeof(messages) = 'array') NOT VALID;
    ALTER TABLE conversations VALIDATE CONSTRAINT conversations_messages_is_array;
  END IF;
END $$;

-- 2. Bound the long-term memory summary so the system prompt cannot grow without limit.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memory_summary_max_len') THEN
    ALTER TABLE user_memory
      ADD CONSTRAINT user_memory_summary_max_len
      CHECK (char_length(summary) <= 4000) NOT VALID;
    ALTER TABLE user_memory VALIDATE CONSTRAINT user_memory_summary_max_len;
  END IF;
END $$;

-- 3. The signed-out (anon) role never needs these tables. RLS already denies it
--    (auth.uid() is NULL); revoking the privilege removes the surface entirely.
REVOKE ALL ON conversations FROM anon;
REVOKE ALL ON user_memory   FROM anon;
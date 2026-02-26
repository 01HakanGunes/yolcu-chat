-- Index for efficient cursor-based pagination of messages within a room
CREATE INDEX IF NOT EXISTS idx_messages_room_id_created_at
ON public.messages (room_id, created_at DESC);

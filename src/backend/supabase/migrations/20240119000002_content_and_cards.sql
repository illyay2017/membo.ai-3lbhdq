-- Enable RLS for content and cards
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content
CREATE POLICY "Users can view own content" ON public.content
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content" ON public.content
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content" ON public.content
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own content" ON public.content
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for cards
CREATE POLICY "Users can view own cards" ON public.cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON public.cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON public.cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards" ON public.cards
    FOR DELETE USING (auth.uid() = user_id);

-- Additional indexes for performance
CREATE INDEX idx_content_processed ON public.content(user_id, processed_at) 
    WHERE status = 'PROCESSED';

CREATE INDEX idx_cards_content ON public.cards(content_id);
CREATE INDEX idx_cards_user ON public.cards(user_id);
CREATE INDEX idx_cards_tags ON public.cards USING GIN(tags);
CREATE INDEX idx_content_full_text ON public.content USING gin(to_tsvector('english', content));

-- Functions for content processing
CREATE OR REPLACE FUNCTION public.update_content_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.processed_at = CASE 
        WHEN NEW.status = 'PROCESSED' THEN now()
        ELSE NULL
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_content_status_change
    BEFORE UPDATE ON public.content
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.update_content_status();

-- Set up realtime
ALTER publication supabase_realtime ADD TABLE public.content;
ALTER publication supabase_realtime ADD TABLE public.cards; 

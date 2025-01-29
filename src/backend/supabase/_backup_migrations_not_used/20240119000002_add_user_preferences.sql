-- Migration: Add structured user preferences
-- Description: Adds comprehensive user preferences structure with validation and indexing
-- Author: membo.ai team

-- Disable triggers temporarily for bulk operation
SET session_replication_role = 'replica';

-- Add structured preferences with comprehensive defaults
ALTER TABLE users 
    DROP COLUMN preferences,
    ADD COLUMN preferences jsonb NOT NULL DEFAULT jsonb_build_object(
        'studyMode', 'STANDARD',
        'voiceEnabled', false,
        'dailyGoal', 20,
        'theme', 'system',
        'language', 'en',
        'notifications', jsonb_build_object(
            'email', true,
            'push', true,
            'studyReminders', true
        )
    );

-- Add comprehensive check constraint for preferences structure validation
ALTER TABLE users 
    ADD CONSTRAINT valid_preferences 
    CHECK (
        jsonb_typeof(preferences) = 'object' 
        AND preferences ? 'studyMode' 
        AND preferences ? 'voiceEnabled' 
        AND preferences ? 'dailyGoal' 
        AND preferences ? 'theme' 
        AND preferences ? 'language' 
        AND preferences ? 'notifications'
        AND (preferences->>'studyMode')::text IN ('STANDARD', 'VOICE', 'QUIZ')
        AND (preferences->>'theme')::text IN ('light', 'dark', 'system')
        AND (preferences->>'language')::text ~ '^[a-z]{2}(-[A-Z]{2})?$'
        AND (preferences->>'dailyGoal')::integer BETWEEN 1 AND 1000
        AND jsonb_typeof(preferences->'notifications') = 'object'
        AND (preferences->'notifications' ? 'email')
        AND (preferences->'notifications' ? 'push')
        AND (preferences->'notifications' ? 'studyReminders')
    );

-- Create GIN index for efficient JSONB querying
CREATE INDEX idx_users_preferences 
    ON users USING GIN (preferences);

-- Add comment explaining preferences structure
COMMENT ON COLUMN users.preferences IS 'User preferences including study settings, theme, language and notifications. Structure:
{
    studyMode: "STANDARD" | "ADVANCED" | "EXPERT",
    voiceEnabled: boolean,
    dailyGoal: number (1-1000),
    theme: "light" | "dark" | "system",
    language: string (ISO language code),
    notifications: {
        email: boolean,
        push: boolean,
        studyReminders: boolean
    }
}';

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Rollback SQL
-- DO NOT REMOVE - Used by migration framework
/*
-- Restore original preferences column
ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS valid_preferences,
    DROP COLUMN preferences,
    ADD COLUMN preferences jsonb DEFAULT '{}'::jsonb;

-- Remove preferences index
DROP INDEX IF EXISTS idx_users_preferences;
*/
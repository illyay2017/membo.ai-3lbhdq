import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Select } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../hooks/useAuth';
import toast from '../../components/ui/toast';
import { put } from '../../lib/api';
import { API_ENDPOINTS } from '../../constants/api';
import { STUDY_MODE_CONFIG } from '../../constants/study';

// Validation schema for preferences form
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  studySessionDuration: z.number()
    .min(5, 'Duration must be at least 5 minutes')
    .max(120, 'Duration cannot exceed 120 minutes'),
  cardsPerSession: z.number()
    .min(STUDY_MODE_CONFIG.standard.minCardsPerSession)
    .max(STUDY_MODE_CONFIG.standard.maxCardsPerSession),
  voiceEnabled: z.boolean(),
  voiceLanguage: z.string().optional(),
  emailNotifications: z.boolean()
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const THEME_OPTIONS = [
  { value: 'light', label: 'Light Theme' },
  { value: 'dark', label: 'Dark Theme' },
  { value: 'system', label: 'System Default' }
];

const VOICE_LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'fr-FR', label: 'French (France)' }
];

const DEFAULT_PREFERENCES: PreferencesFormData = {
  theme: 'system',
  studySessionDuration: 30,
  cardsPerSession: 20,
  voiceEnabled: false,
  voiceLanguage: 'en-US',
  emailNotifications: true
};

export const PreferencesPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useUIStore();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: DEFAULT_PREFERENCES
  });

  const voiceEnabled = watch('voiceEnabled');

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await put<PreferencesFormData>(
          API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
          { userId: user?.id }
        );
        
        Object.entries(response).forEach(([key, value]) => {
          setValue(key as keyof PreferencesFormData, value);
        });

      } catch (error) {
        toast({
          variant: 'error',
          message: 'Failed to load preferences'
        });
      }
    };

    if (user?.id) {
      loadPreferences();
    }
  }, [user?.id, setValue]);

  const onSubmit = async (data: PreferencesFormData) => {
    try {
      // Update theme if changed
      if (data.theme !== theme.mode) {
        setTheme(data.theme);
      }

      // Save preferences to backend
      await put(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        userId: user?.id,
        preferences: data
      });

      toast({
        variant: 'success',
        message: 'Preferences updated successfully'
      });

    } catch (error) {
      toast({
        variant: 'error',
        message: 'Failed to update preferences'
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Preferences</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Theme
          </label>
          <Select
            options={THEME_OPTIONS}
            {...register('theme')}
            error={errors.theme?.message}
          />
        </div>

        {/* Study Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Study Settings</h2>
          
          <Input
            id="studySessionDuration"
            label="Session Duration (minutes)"
            type="number"
            {...register('studySessionDuration', { valueAsNumber: true })}
            error={errors.studySessionDuration?.message}
          />

          <Input
            id="cardsPerSession"
            label="Cards per Session"
            type="number"
            {...register('cardsPerSession', { valueAsNumber: true })}
            error={errors.cardsPerSession?.message}
          />
        </div>

        {/* Voice Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Voice Settings</h2>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="voiceEnabled"
              {...register('voiceEnabled')}
              className="rounded border-gray-300"
            />
            <label htmlFor="voiceEnabled" className="text-sm">
              Enable Voice Mode
            </label>
          </div>

          {voiceEnabled && (
            <Select
              options={VOICE_LANGUAGE_OPTIONS}
              {...register('voiceLanguage')}
              error={errors.voiceLanguage?.message}
              aria-label="Voice Language"
            />
          )}
        </div>

        {/* Notification Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Notifications</h2>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="emailNotifications"
              {...register('emailNotifications')}
              className="rounded border-gray-300"
            />
            <label htmlFor="emailNotifications" className="text-sm">
              Email Notifications
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark 
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>
    </div>
  );
};

export default PreferencesPage;
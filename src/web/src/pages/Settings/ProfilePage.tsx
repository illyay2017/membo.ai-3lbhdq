/**
 * Profile settings page component that allows users to view and update their personal information
 * Implements comprehensive validation, security measures, and accessibility features
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../hooks/useAuth';
import { validateProfileData } from '../../utils/validation';
import { UserRole } from '@shared/types/userRoles';

// Profile form data interface with strict typing
interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  preferences: {
    studyMode: 'standard' | 'voice' | 'quiz';
    notifications: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}

/**
 * Profile settings page component with comprehensive validation and security
 */
const ProfilePage: React.FC = () => {
  const { user, isLoading, updateProfile } = useAuth();

  // Initialize form with react-hook-form and validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
    setValue
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      role: user?.role || UserRole.FREE_USER,
      preferences: {
        studyMode: 'standard',
        notifications: true,
        theme: 'system'
      }
    }
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferences: user.preferences || {
          studyMode: 'standard',
          notifications: true,
          theme: 'system'
        }
      });
    }
  }, [user, reset]);

  // Debounced form submission handler
  const onSubmit = useCallback(
    debounce(async (data: ProfileFormData) => {
      try {
        // Validate form data
        const isValid = validateProfileData(data);
        if (!isValid) {
          throw new Error('Invalid profile data');
        }

        // Update profile with loading state
        await updateProfile(data);

        toast.success('Profile updated successfully', {
          duration: 3000,
          position: 'bottom-right'
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update profile', {
          duration: 5000,
          position: 'bottom-right'
        });
      }
    }, 500),
    [updateProfile]
  );

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your personal information and preferences
        </p>
      </div>

      <form 
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 relative"
        aria-label="Profile settings form"
      >
        {/* Personal Information Section */}
        <section className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Personal Information</h2>
          
          <Input
            id="firstName"
            label="First Name"
            {...register('firstName', {
              required: 'First name is required',
              minLength: { value: 2, message: 'First name is too short' },
              maxLength: { value: 50, message: 'First name is too long' },
              pattern: {
                value: /^[a-zA-Z\s-']+$/,
                message: 'First name contains invalid characters'
              }
            })}
            error={errors.firstName?.message}
            disabled={isSubmitting}
            required
          />

          <Input
            id="lastName"
            label="Last Name"
            {...register('lastName', {
              required: 'Last name is required',
              minLength: { value: 2, message: 'Last name is too short' },
              maxLength: { value: 50, message: 'Last name is too long' },
              pattern: {
                value: /^[a-zA-Z\s-']+$/,
                message: 'Last name contains invalid characters'
              }
            })}
            error={errors.lastName?.message}
            disabled={isSubmitting}
            required
          />

          <Input
            id="email"
            label="Email Address"
            type="email"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: 'Invalid email format'
              }
            })}
            error={errors.email?.message}
            disabled={isSubmitting}
            required
          />
        </section>

        {/* Preferences Section */}
        <section className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Preferences</h2>
          
          {/* Add preference controls here */}
        </section>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isSubmitting}
          >
            Reset Changes
          </Button>
          
          <Button
            type="submit"
            disabled={!isDirty || isSubmitting}
            loading={isSubmitting}
          >
            Save Changes
          </Button>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div 
            className="absolute inset-0 bg-white/50 flex items-center justify-center"
            aria-busy="true"
            aria-label="Loading profile data"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </form>
    </div>
  );
};

export default ProfilePage;
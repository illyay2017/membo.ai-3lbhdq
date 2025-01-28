import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@shared/types/userRoles';

type Permission = 'content:process' | 'content:archive' | UserRole;

/**
 * Hook for checking user role-based permissions
 */
export function useRoleAccess() {
  const user = useAuthStore(state => state.user);

  const hasAccess = useCallback((permission: Permission): boolean => {
    if (!user) return false;

    // Handle role-based checks
    if (Object.values(UserRole).includes(permission as UserRole)) {
      const roleValues = Object.values(UserRole);
      const userRoleIndex = roleValues.indexOf(user.role);
      const requiredRoleIndex = roleValues.indexOf(permission as UserRole);
      return userRoleIndex >= requiredRoleIndex;
    }

    // Handle feature permission checks
    switch (permission) {
      case 'content:process':
        return [
          UserRole.PRO_USER,
          UserRole.POWER_USER,
          UserRole.ENTERPRISE_ADMIN,
          UserRole.SYSTEM_ADMIN
        ].includes(user.role);
      case 'content:archive':
        return [
          UserRole.FREE_USER,
          UserRole.PRO_USER,
          UserRole.POWER_USER,
          UserRole.ENTERPRISE_ADMIN,
          UserRole.SYSTEM_ADMIN
        ].includes(user.role);
      default:
        return false;
    }
  }, [user]);

  return { hasAccess };
}

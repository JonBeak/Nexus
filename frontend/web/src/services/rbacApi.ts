import { apiClient } from './api';

export interface UserPermissions {
  resources: Record<string, string[]>; // resource_name -> [action1, action2]
}

export const getUserPermissionsApi = () =>
  apiClient.get<UserPermissions>('/auth/permissions');

export const checkPermissionApi = (resource: string, action: string) =>
  apiClient.get<{ hasPermission: boolean }>(`/auth/check-permission`, {
    params: { resource, action }
  });
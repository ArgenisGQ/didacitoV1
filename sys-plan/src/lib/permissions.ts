import { jwtDecode } from 'jwt-decode';
import { getAccessToken } from './api-client';

export interface JWTPayload {
  sub: string;
  role: string | null;
  permissions?: string[];
  exp?: number;
  iat?: number;
}

export const getDecodedToken = (): JWTPayload | null => {
  const token = getAccessToken();
  if (!token) return null;
  try {
    return jwtDecode<JWTPayload>(token);
  } catch {
    return null;
  }
};

export const hasPermission = (requiredPermission: string): boolean => {
  const decoded = getDecodedToken();
  if (!decoded) return false;
  
  const permissions = decoded.permissions || [];
  return permissions.includes(requiredPermission);
};

export const hasAnyPermission = (requiredPermissions: string[]): boolean => {
  const decoded = getDecodedToken();
  if (!decoded) return false;
  
  const permissions = decoded.permissions || [];
  return requiredPermissions.some(p => permissions.includes(p));
};

export const hasAllPermissions = (requiredPermissions: string[]): boolean => {
  const decoded = getDecodedToken();
  if (!decoded) return false;
  
  const permissions = decoded.permissions || [];
  return requiredPermissions.every(p => permissions.includes(p));
};

import { SetMetadata } from '@nestjs/common';

import { Permission, RoleName } from './roles';

export const REQUIRED_ROLES = 'iam:roles';
export const REQUIRED_PERMISSIONS = 'iam:permissions';
export const Roles = (...roles: RoleName[]) => SetMetadata(REQUIRED_ROLES, roles);
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

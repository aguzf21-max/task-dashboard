import { MFA_REQUIRED_ROLES, ROLE_PERMISSIONS, ROLES } from '../src/iam/roles';

describe('canonical IAM roles', () => {
  it('does not grant Super Admin or reception clinical-record access', () => {
    expect(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]).not.toContain('clinical:full');
    expect(ROLE_PERMISSIONS[ROLES.RECEPCION_ADMISION]).not.toContain('clinical:record');
    expect(MFA_REQUIRED_ROLES).toEqual([
      ROLES.SUPER_ADMIN,
      ROLES.DIRECTOR_ADMIN,
      ROLES.TERAPEUTA_CLINICO,
    ]);
  });
});

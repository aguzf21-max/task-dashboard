export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR_ADMIN: 'Director / Admin',
  TERAPEUTA_CLINICO: 'Terapeuta Clínico',
  RECEPCION_ADMISION: 'Recepción & Admisión',
  MENTOR_PRO_CLINICO: 'Mentor PRO Clínico',
  EVALUADO_CANDIDATO: 'Evaluado / Candidato',
  FAMILIAR_TUTOR: 'Familiar / Tutor',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
export type Permission =
  | 'tenant:manage'
  | 'platform:configure'
  | 'clinical:full'
  | 'clinical:record'
  | 'agenda:manage'
  | 'teleconsultation:use'
  | 'consent:manage';

export const ROLE_PERMISSIONS: Readonly<Record<RoleName, readonly string[]>> = {
  [ROLES.SUPER_ADMIN]: ['tenant:manage', 'platform:configure'],
  [ROLES.DIRECTOR_ADMIN]: ['clinical:full', 'staff:manage', 'platform:configure'],
  [ROLES.TERAPEUTA_CLINICO]: [
    'clinical:record',
    'agenda:manage',
    'teleconsultation:use',
    'tcc:formulate',
    'nom004:report',
  ],
  [ROLES.RECEPCION_ADMISION]: ['agenda:manage', 'cash:minor', 'intake:minor', 'eni:deliver'],
  [ROLES.MENTOR_PRO_CLINICO]: [
    'mentor:use',
    'assessment:battery',
    'report:pdf',
    'assessment:assigned',
  ],
  [ROLES.EVALUADO_CANDIDATO]: ['results:own:read'],
  [ROLES.FAMILIAR_TUTOR]: ['minor:custody:read', 'consent:manage'],
};

export const MFA_REQUIRED_ROLES: readonly RoleName[] = [
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR_ADMIN,
  ROLES.TERAPEUTA_CLINICO,
];

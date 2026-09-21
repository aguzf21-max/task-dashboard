import { ServiceUnavailableException } from '@nestjs/common';

import { sanitizeAuditMetadata } from '../src/iam/audit.interceptor';

describe('audit metadata sanitization', () => {
  it('preserves simple non-PHI metadata', () => {
    expect(sanitizeAuditMetadata({ route: 'revoke', success: true, count: 1 })).toEqual({
      route: 'revoke',
      success: true,
      count: 1,
    });
  });

  it('rejects secret and PHI-shaped fields', () => {
    expect(() => sanitizeAuditMetadata({ token: 'secret' })).toThrow(ServiceUnavailableException);
    expect(() => sanitizeAuditMetadata({ nested: { value: 'not allowed' } })).toThrow(
      ServiceUnavailableException,
    );
  });
});

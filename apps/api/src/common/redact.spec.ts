import { redact } from './redact';

describe('redact', () => {
  it('removes passwords and tokens from audit payloads', () => {
    expect(redact({ email: 'a@b.c', password: 'secret', nested: { refreshToken: 'abc', apiKey: 'sk-ant-secret' } })).toEqual({
      email: 'a@b.c',
      password: '[redacted]',
      nested: { refreshToken: '[redacted]', apiKey: '[redacted]' },
    });
  });
});

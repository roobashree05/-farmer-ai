const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return EMAIL_PATTERN.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include letters and numbers';
  }
  return null;
}

export function isValidDateRange(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return true;
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return false;
  return endAt.getTime() >= startAt.getTime();
}

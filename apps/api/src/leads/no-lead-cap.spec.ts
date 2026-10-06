import { readFileSync } from 'fs';
import path from 'path';

describe('unlimited lead storage', () => {
  it('does not enforce an application-level lead cap', () => {
    const source = readFileSync(path.join(__dirname, 'leads.service.ts'), 'utf8');
    const importer = readFileSync(path.join(__dirname, 'lead-import.service.ts'), 'utf8');
    const combined = `${source}\n${importer}`;
    expect(combined).not.toMatch(/MAX_LEADS|FREE_LEADS|leadCount\s*>/);
  });
});

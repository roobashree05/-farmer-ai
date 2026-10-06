export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

export const LEAD_IMPORT_FIELDS = [
  'name',
  'phone',
  'whatsappNumber',
  'email',
  'shopName',
  'location',
  'leadSource',
  'status',
  'tags',
  'notes',
  'customerCategory',
  'previousEnquiry',
  'assignedEmail',
] as const;

export type LeadImportField = (typeof LEAD_IMPORT_FIELDS)[number];

export function mapCsvRows(
  rows: string[][],
  mapping?: Partial<Record<LeadImportField, string>>,
): { headers: string[]; records: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.trim());
  const indexByHeader = new Map(headers.map((header, index) => [header.toLowerCase(), index]));

  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    for (const field of LEAD_IMPORT_FIELDS) {
      const headerName = mapping?.[field] ?? field;
      const index = indexByHeader.get(headerName.toLowerCase());
      record[field] = index == null ? '' : (cells[index] ?? '').trim();
    }
    return record;
  });

  return { headers, records };
}

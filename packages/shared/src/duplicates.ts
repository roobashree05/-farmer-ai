export interface ImportRowRef {
  rowNumber: number;
  phone: string | null;
  valid: boolean;
}

export function classifyImportRows(rows: ImportRowRef[], existingPhones: Set<string>) {
  const seen = new Set<string>();
  const validNew: ImportRowRef[] = [];
  const duplicates: ImportRowRef[] = [];
  const invalid: ImportRowRef[] = [];

  for (const row of rows) {
    if (!row.valid || !row.phone) {
      invalid.push(row);
      continue;
    }
    if (existingPhones.has(row.phone) || seen.has(row.phone)) {
      duplicates.push(row);
      continue;
    }
    seen.add(row.phone);
    validNew.push(row);
  }

  return {
    validNew,
    duplicates,
    invalid,
    summary: {
      total: rows.length,
      successful: validNew.length,
      duplicates: duplicates.length,
      invalid: invalid.length,
    },
  };
}

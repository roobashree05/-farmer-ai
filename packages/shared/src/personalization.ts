export const PERSONALIZATION_VARS = [
  'customer_name',
  'shop_name',
  'location',
  'contact_person',
  'previous_interest',
] as const;

export type PersonalizationVar = (typeof PERSONALIZATION_VARS)[number];

export interface PersonalizationInput {
  customer_name?: string | null;
  shop_name?: string | null;
  location?: string | null;
  contact_person?: string | null;
  previous_interest?: string | null;
}

export function renderTemplate(template: string, vars: PersonalizationInput): {
  text: string;
  missing: PersonalizationVar[];
} {
  const missing: PersonalizationVar[] = [];
  const text = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (full, key: string) => {
    if (!PERSONALIZATION_VARS.includes(key as PersonalizationVar)) return full;
    const value = vars[key as PersonalizationVar];
    if (value == null || value.trim() === '') {
      missing.push(key as PersonalizationVar);
      return '';
    }
    return value;
  });
  return { text, missing };
}

export function leadPersonalization(lead: {
  name: string;
  shopName?: string | null;
  location?: string | null;
  previousEnquiry?: string | null;
}): PersonalizationInput {
  return {
    customer_name: lead.name,
    shop_name: lead.shopName,
    location: lead.location,
    contact_person: lead.name,
    previous_interest: lead.previousEnquiry,
  };
}

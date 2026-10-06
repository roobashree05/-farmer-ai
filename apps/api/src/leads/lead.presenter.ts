export function presentLead(lead: {
  id: string;
  displayId: number;
  name: string;
  phone: string;
  whatsappNumber: string | null;
  email: string | null;
  shopName: string | null;
  location: string | null;
  customerCategory: string | null;
  previousEnquiry: string | null;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  whatsappGroupId?: string | null;
  whatsappGroupName?: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: { code: string; name: string };
  leadSource: { code: string; name: string };
  assignedUser: { id: string; firstName: string; lastName: string } | null;
  tags: { tag: { id: string; name: string } }[];
  company?: { id: string; name: string; location: string | null } | null;
  customer?: { id: string } | null;
}) {
  return {
    id: lead.id,
    displayId: lead.displayId,
    name: lead.name,
    phone: lead.phone,
    whatsappNumber: lead.whatsappNumber,
    email: lead.email,
    shopName: lead.shopName,
    location: lead.location,
    customerCategory: lead.customerCategory,
    previousEnquiry: lead.previousEnquiry,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    whatsappGroupId: lead.whatsappGroupId ?? null,
    whatsappGroupName: lead.whatsappGroupName ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    status: lead.status,
    source: lead.leadSource,
    assignedUser: lead.assignedUser,
    tags: lead.tags.map((item) => item.tag),
    company: lead.company ?? null,
    customerId: lead.customer?.id ?? null,
  };
}

export const leadInclude = {
  status: true,
  leadSource: true,
  assignedUser: { select: { id: true, firstName: true, lastName: true } },
  tags: { include: { tag: true } },
  company: { select: { id: true, name: true, location: true } },
  customer: { select: { id: true } },
} as const;

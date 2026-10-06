export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LeadSummary {
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
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: { code: string; name: string };
  source: { code: string; name: string };
  assignedUser: { id: string; firstName: string; lastName: string } | null;
  tags: { id: string; name: string }[];
}

export interface DashboardSnapshot {
  leads: {
    total: number;
    byStatus: { code: string; name: string; count: number }[];
  };
  whatsapp: {
    activeChats: number;
    messages: number;
    responses: number;
    readRate: number;
  };
  marketing: {
    campaigns: number;
    scheduled: number;
    leadsGenerated: number;
    costPerLead: number;
  };
  meetings: {
    upcoming: number;
    completed: number;
    cancelled: number;
  };
  calls: {
    manual: number;
    automated: number;
    answered: number;
    missed: number;
    outcomes: { outcome: string; count: number }[];
  };
  recentActivity: { id: string; type: string; summary: string; createdAt: string; leadName: string }[];
}

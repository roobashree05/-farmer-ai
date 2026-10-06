import type { RoleName } from '@aijewel/shared';

export interface Actor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  permissions: string[];
}

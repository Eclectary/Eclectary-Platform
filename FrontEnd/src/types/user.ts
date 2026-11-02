export type UserRole = 'customer' | 'seller' | 'administrator';

export interface User {
  id: number;
  email: string;
  role: UserRole;
}


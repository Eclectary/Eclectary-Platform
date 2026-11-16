export type UserRole = 'customer' | 'seller' | 'administrator';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  public_name?: string | null;
  specialty?: string | null;
  bio?: string | null;
  image_url?: string | null;
}


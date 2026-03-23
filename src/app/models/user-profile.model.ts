export type AppUserRole = 'user' | 'admin';

export interface AppUserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: AppUserRole;
  status: 'active' | 'inactive';
  birthday?: string;
  gender?: string;
  avatar?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: AppUserRole;
}

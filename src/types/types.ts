export enum UserRole {
  ADMIN = 'Admin',
  VENDOR = 'Vendor',
  CUSTOMER = 'Customer',
}

export interface User {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  signup: (username: string, email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  AdminDashboard: undefined;
  VendorDashboard: undefined;
  CustomerDashboard: undefined;
};

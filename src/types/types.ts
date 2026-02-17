export enum UserRole {
  ADMIN = 'Admin',
  VENDOR = 'Vendor',
  CUSTOMER = 'Customer',
  REALTOR = 'Realtor',
  PROPERTY_MANAGER = 'Property manager',
  BUSINESS = 'Business',
  HOME_OWNER = 'Home Owner',
  LANDLORD = 'Landlord',
  OTHER = 'Other',
}

export interface User {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  name: string;
  address: string;
  phone: string;
  roleOther?: string;
  referralSource: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  signup: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    address: string,
    phone: string,
    referralSource: string,
    roleOther?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export enum JobStatus {
  SUBMITTED = 'Submitted',
  SENT_TO_VENDORS = 'Sent to Vendor(s)',
  RECEIVED = 'Received',
  QUOTED = 'Quoted',
  SCHEDULED = 'Scheduled',
  COMPLETED_AWAITING_PAYMENT = 'Completed/Awaiting payment',
}

export enum Urgency {
  IMMEDIATE = 'Immediate',
  THIS_WEEK = 'This week',
  THIS_MONTH = 'This month',
  NO_RUSH = 'No rush',
}

export interface Contact {
  name: string;
  phone: string;
  email: string;
}

export interface Job {
  id: string;
  customerId: string;
  address: string;
  contacts: Contact[];
  description: string;
  photos: string[];
  urgency: Urgency;
  otherDetails?: string;
  status: JobStatus;
  scheduledDate?: string;
  createdAt: string;
}

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  AdminDashboard: undefined;
  VendorDashboard: undefined;
  CustomerDashboard: undefined;
  JobDetails: { jobId: string };
};

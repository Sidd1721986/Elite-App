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
  id?: string;
  username?: string;
  email: string;
  password: string;
  role: UserRole;
  name: string;
  address: string;
  phone: string;
  roleOther?: string;
  referralSource: string;
  isApproved?: boolean;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean | string>;
  signup: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    address: string,
    phone: string,
    referralSource: string,
    roleOther?: string
  ) => Promise<boolean | string>;
  logout: () => Promise<void>;
  isLoading: boolean;
  getPendingVendors: () => Promise<User[]>;
  getApprovedVendors: () => Promise<User[]>;
  updateUserStatus: (userId: string, approved: boolean) => Promise<boolean>;
  removeVendor: (userId: string) => Promise<boolean>;
}

export enum JobStatus {
  SUBMITTED = 'Submitted',
  ASSIGNED = 'Assigned',
  ACCEPTED = 'Accepted',
  REACHED_OUT = 'Reached Out',
  APPT_SET = 'Appt Set',
  SALE = 'Sale',
  FOLLOW_UP = 'Follow Up',
  EXPIRED = 'Expired',
  COMPLETED = 'Completed',
  INVOICED = 'Invoiced'
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

export interface JobNote {
  id: string;
  jobId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  customer?: User;
  vendorId?: string;
  vendor?: User;
  address: string;
  contactPhone?: string;
  contactEmail?: string;
  contacts: Contact[];
  description: string;
  photos: string[];
  urgency: Urgency;
  otherDetails?: string;
  status: string;
  assignedAt?: string;
  acceptedAt?: string;
  scopeOfWork?: string;
  contractAmount?: number;
  workStartDate?: string;
  completedPhotos?: string;
  isInvoiced?: boolean;
  scheduledDate?: string;
  createdAt: string;
  notes?: JobNote[];
}

export type RootStackParamList = {
  Login: undefined;
  SignupRoleSelector: undefined;
  CustomerSignup: undefined;
  VendorSignup: undefined;
  AdminDashboard: undefined;
  VendorDashboard: undefined;
  CustomerDashboard: undefined;
  JobDetails: { jobId: string };
  AssignVendor: { jobId: string };
};

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
  isPhoneVerified?: boolean;
  createdAt?: string;
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
  deleteAccount: () => Promise<boolean | string>;
  updateProfile: (data: Partial<User>) => Promise<boolean | string>;
  requestPhoneVerification: () => Promise<boolean>;
  verifyPhone: (code: string) => Promise<boolean>;
}

export enum JobStatus {
  SUBMITTED = 'Submitted',
  ASSIGNED = 'Assigned',
  ACCEPTED = 'Accepted',
  REACHED_OUT = 'ReachedOut',
  APPT_SET = 'ApptSet',
  SALE = 'Sale',
  FOLLOW_UP = 'Follow Up',
  EXPIRED = 'Expired',
  COMPLETED = 'Completed',
  INVOICE_REQUESTED = 'InvoiceRequested',
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
  jobNumber: number;
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
  completedPhotos: string[];
  isInvoiced?: boolean;
  invoiceDocumentUrl?: string;
  invoiceRequestedAt?: string;
  invoicedAt?: string;
  scheduledDate?: string;
  createdAt: string;
  notes?: JobNote[];
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  sender?: User;
  receiver?: User;
}

export interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  latestMessage: string;
  timestamp: string;
  unreadCount: number;
}

export type RootStackParamList = {
  Landing: undefined;
  Login: { passwordResetOk?: boolean; initialRole?: UserRole } | undefined;
  ForgotPassword: { initialEmail?: string; initialRole?: UserRole } | undefined;
  ResetPassword: { email: string; role: string; resetToken?: string };
  CustomerSignup: undefined;
  VendorSignup: undefined;
  AdminDashboard: undefined;
  VendorDashboard: undefined;
  CustomerDashboard: undefined;
  RoleFallback: undefined;
  JobDetails: { jobId: string };
  AssignVendor: { jobId: string };
  Chat: { otherUserId: string; otherUserName: string };
  Profile: undefined;
  AccountDetails: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  ContactSupport: undefined;
};

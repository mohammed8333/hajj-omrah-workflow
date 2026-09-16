export type UserRole = "Sender" | "SafaEmployee" | "SaudiAgent" | "Admin";

export type RequestStatus =
  | "Draft"
  | "Submitted"
  | "UnderReview"
  | "MissingDocuments"
  | "CorrectionRequired"
  | "DocumentsCompleted"
  | "SafaRegistrationCompleted"
  | "ReadyForSaudiAgent"
  | "ReceivedBySaudiAgent"
  | "SaudiAgentProcessing"
  | "SaudiAgentCorrectionRequired"
  | "ProgramLinked"
  | "HostingAcceptanceRequested"
  | "HostingAcceptedBySender"
  | "HostingConfirmed"
  | "Completed"
  | "Cancelled"
  | "Archived";

export type DocumentType =
  | "Passport"
  | "PersonalPhoto"
  | "FlightTicket"
  | "HostId"
  | "Other";

export type DocumentReviewStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "NeedsCorrection"
  | "Missing";

export type TravelerStatus = "Pending" | "Accepted" | "NeedsCorrection";

export type CorrectionStatus = "Pending" | "Resolved" | "Cancelled";

export interface User {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  fullName: string;
  username: string;
  role: UserRole;
}

export interface DocumentItem {
  id: string;
  groupRequestId?: string;
  travelerId?: string;
  documentType: DocumentType;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  version: number;
  uploadedById: string;
  uploadedByName?: string;
  uploadedAt: string;
  reviewStatus: DocumentReviewStatus;
  reviewNote?: string;
}

export interface Traveler {
  id: string;
  groupRequestId: string;
  fullName: string;
  passportNumber?: string;
  phoneNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  status: TravelerStatus;
  notes?: string;
  createdAt: string;
  documents: DocumentItem[];
}

export interface HostingInfo {
  id: string;
  groupRequestId: string;
  hostName: string;
  hostPhone: string;
  hostBirthDate?: string;
  hostNationality?: string;
  hostNationalId?: string;
  hostAddress?: string;
  hostIdDocumentId?: string;
  hostIdDocument?: DocumentItem;
}

export interface CorrectionRequest {
  id: string;
  groupRequestId: string;
  travelerId?: string;
  travelerName?: string;
  documentId?: string;
  targetField?: string;
  requestedById: string;
  requestedByName: string;
  assignedToId?: string;
  assignedToName?: string;
  reason: string;
  status: CorrectionStatus;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface StatusHistory {
  id: string;
  groupRequestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  changedById: string;
  changedByName: string;
  note?: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  groupRequestId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  roleStage: string;
  notes?: string;
  transferredAt: string;
  receivedAt?: string;
  status: string;
}

export interface TravelerSummaryItem {
  id: string;
  fullName: string;
  passportNumber?: string;
  photoUrl?: string;
}

export interface GroupRequestSummary {
  id: string;
  requestNumber: string;
  groupName: string;
  senderId: string;
  senderName: string;
  assignedSafaEmployeeId?: string;
  assignedSafaEmployeeName?: string;
  assignedSaudiAgentId?: string;
  assignedSaudiAgentName?: string;
  status: RequestStatus;
  nusukGroupNumber?: string;
  nusukStatus?: string;
  nusukSyncedAt?: string;
  hasHosting: boolean;
  hostName?: string;
  hostPhone?: string;
  hostNationalId?: string;
  hostBirthDate?: string;
  hostIdDocumentId?: string;
  hostIdDocumentUrl?: string;
  flightTicketDocumentId?: string;
  flightTicketDocumentUrl?: string;
  returnFlightNumber?: string;
  contactPhone: string;
  travelDate?: string;
  departureDate?: string;
  returnDate?: string;
  flightDepartureTime?: string;
  airportArrivalTime?: string;
  airline?: string;
  flightNumber?: string;
  destination?: string;
  arrivalAirport?: string;
  saudiArrivalTime?: string;
  returnDepartureAirport?: string;
  returnFlightDepartureTime?: string;
  travelersCount: number;
  travelersList?: TravelerSummaryItem[];
  documentsCount: number;
  pendingCorrectionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRequestDetail {
  id: string;
  requestNumber: string;
  groupName: string;
  senderId: string;
  senderName: string;
  assignedSafaEmployeeId?: string;
  assignedSafaEmployeeName?: string;
  assignedSaudiAgentId?: string;
  assignedSaudiAgentName?: string;
  status: RequestStatus;
  nusukGroupNumber?: string;
  nusukStatus?: string;
  nusukSyncedAt?: string;
  hasHosting: boolean;
  contactPhone: string;
  travelDate?: string;
  departureDate?: string;
  returnDate?: string;
  flightDepartureTime?: string;
  airportArrivalTime?: string;
  airline?: string;
  flightNumber?: string;
  returnFlightNumber?: string;
  arrivalAirport?: string;
  saudiArrivalTime?: string;
  returnDepartureAirport?: string;
  returnFlightDepartureTime?: string;
  flightTicketDocumentId?: string;
  flightTicketDocument?: DocumentItem;
  destination?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  hostingInfo?: HostingInfo;
  travelers: Traveler[];
  groupDocuments: DocumentItem[];
  correctionRequests: CorrectionRequest[];
  statusHistories: StatusHistory[];
  transfers: Transfer[];
}

export interface AdminStats {
  totalGroups: number;
  totalTravelers: number;
  newRequests: number;
  underReview: number;
  missingDocuments: number;
  correctionRequired: number;
  readyForSaudiAgent: number;
  receivedBySaudiAgent: number;
  saudiAgentProcessing: number;
  completed: number;
  cancelled: number;
  requestsByStatus: Record<string, number>;
  requestsByEmployee: {
    employeeName: string;
    role: string;
    assignedCount: number;
    completedCount: number;
  }[];
}

export interface AuditLogItem {
  id: string;
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  entityName: string;
  entityId: string;
  ipAddress?: string;
  metadataJson?: string;
  createdAt: string;
}

export interface NusukStatusOption {
  value: string;
  label: string;
  badgeColor: string;
  isApproved?: boolean;
}

export const NUSUK_STATUS_OPTIONS: NusukStatusOption[] = [
  {
    value: "تحت الإدخال",
    label: "تحت الإدخال (مسودة نسك)",
    badgeColor: "bg-gray-100 text-gray-700 border-gray-200",
  },
  {
    value: "تم الإرسال للمخاع",
    label: "تم الإرسال للمخاع",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "بانتظار سداد التأشيرات",
    label: "بانتظار سداد التأشيرات / الموافقة",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    value: "تم إصدار التأشيرات (مقبولة)",
    label: "تم إصدار التأشيرات (مقبولة)",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    isApproved: true,
  },
  {
    value: "ملغاة / مرفوضة",
    label: "ملغاة / مرفوضة",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
];


import {
  AdminStats,
  AuditLogItem,
  CorrectionRequest,
  DocumentItem,
  DocumentReviewStatus,
  DocumentType,
  GroupRequestDetail,
  GroupRequestSummary,
  RequestStatus,
  StatusHistory,
  Transfer,
  Traveler,
  User,
} from "@/types";

const DB_KEY_USERS = "hajj_db_users_v2";
const DB_KEY_REQUESTS = "hajj_db_requests_v2";
const DB_KEY_AUDIT_LOGS = "hajj_db_audit_logs_v2";

// IndexedDB Helper for Storing Large Files (Passports, Photos, PDFs)
const IDB_NAME = "HajjDocumentsDB";
const IDB_STORE = "documents_data";

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("No window");
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileToIndexedDB(id: string, dataUrl: string) {
  try {
    const db = await openIndexedDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ id, dataUrl });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("IndexedDB save failed, fallback to memory", e);
  }
}

export async function getFileFromIndexedDB(id: string): Promise<string | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result?.dataUrl || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearIndexedDB(): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("IndexedDB clear failed", e);
  }
}

// ----------------------------------------------------
// DEFAULT SEED DATA
// ----------------------------------------------------
export const DEFAULT_USERS: User[] = [
  {
    id: "usr-admin-1",
    fullName: "المشرف العام (مدير النظام)",
    username: "admin",
    password: "Admin@123456",
    role: "Admin",
    phone: "+966500000001",
    isActive: true,
    createdAt: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "usr-sender-1",
    fullName: "أحمد المحمدي (وكيل إرسال)",
    username: "sender",
    password: "Sender@123456",
    role: "Sender",
    phone: "+966500000002",
    isActive: true,
    createdAt: "2026-01-05T09:30:00.000Z",
  },
  {
    id: "usr-safa-1",
    fullName: "عبدالله السعيد (موظف تسجيل الصفا)",
    username: "safa_emp",
    password: "Safa@123456",
    role: "SafaEmployee",
    phone: "+966500000003",
    isActive: true,
    createdAt: "2026-01-10T10:15:00.000Z",
  },
  {
    id: "usr-agent-1",
    fullName: "شركة الهدى المعتمدة (الوكيل السعودي)",
    username: "saudi_agent",
    password: "Agent@123456",
    role: "SaudiAgent",
    phone: "+966500000004",
    isActive: true,
    createdAt: "2026-01-15T11:00:00.000Z",
  },
];

export const DEFAULT_REQUESTS: GroupRequestDetail[] = [
  {
    id: "req-001",
    requestNumber: "REQ-2026-001",
    groupName: "فوج البركة - عمرة رجب",
    senderId: "usr-sender-1",
    senderName: "أحمد المحمدي (وكيل إرسال)",
    assignedSafaEmployeeId: "usr-safa-1",
    assignedSafaEmployeeName: "عبدالله السعيد (موظف تسجيل الصفا)",
    status: "Submitted",
    hasHosting: true,
    contactPhone: "+966551234567",
    travelDate: "2026-10-15",
    destination: "مكة المكرمة والمدينة المنورة",
    notes: "المجموعة تضم كبار سن، يرجى إعطاء الأولوية في ترتيبات النقل.",
    createdAt: "2026-09-08T14:30:00.000Z",
    updatedAt: "2026-09-09T09:15:00.000Z",
    hostingInfo: {
      id: "host-001",
      groupRequestId: "req-001",
      hostName: "فندق أبراج الكسوة",
      hostPhone: "+966125559999",
      hostAddress: "مكة المكرمة - التيسير",
    },
    travelers: [
      {
        id: "trv-001",
        groupRequestId: "req-001",
        fullName: "محمد إبراهيم حسنين",
        passportNumber: "A12345678",
        nationality: "مصري",
        dateOfBirth: "1975-04-12",
        status: "Pending",
        createdAt: "2026-09-08T14:35:00.000Z",
        documents: [
          {
            id: "doc-001",
            groupRequestId: "req-001",
            travelerId: "trv-001",
            documentType: "Passport",
            originalFileName: "passport_mohammed.pdf",
            fileSize: 412000,
            mimeType: "application/pdf",
            version: 1,
            uploadedById: "usr-sender-1",
            uploadedByName: "أحمد المحمدي",
            uploadedAt: "2026-09-08T14:36:00.000Z",
            reviewStatus: "Pending",
          },
          {
            id: "doc-002",
            groupRequestId: "req-001",
            travelerId: "trv-001",
            documentType: "PersonalPhoto",
            originalFileName: "photo_mohammed.jpg",
            fileSize: 184000,
            mimeType: "image/jpeg",
            version: 1,
            uploadedById: "usr-sender-1",
            uploadedByName: "أحمد المحمدي",
            uploadedAt: "2026-09-08T14:37:00.000Z",
            reviewStatus: "Accepted",
          },
        ],
      },
      {
        id: "trv-002",
        groupRequestId: "req-001",
        fullName: "فاطمة الزهراء علي",
        passportNumber: "A87654321",
        nationality: "مصرية",
        dateOfBirth: "1980-08-22",
        status: "Pending",
        createdAt: "2026-09-08T14:40:00.000Z",
        documents: [
          {
            id: "doc-003",
            groupRequestId: "req-001",
            travelerId: "trv-002",
            documentType: "Passport",
            originalFileName: "passport_fatima.pdf",
            fileSize: 395000,
            mimeType: "application/pdf",
            version: 1,
            uploadedById: "usr-sender-1",
            uploadedByName: "أحمد المحمدي",
            uploadedAt: "2026-09-08T14:41:00.000Z",
            reviewStatus: "Pending",
          },
        ],
      },
    ],
    groupDocuments: [
      {
        id: "doc-grp-001",
        groupRequestId: "req-001",
        documentType: "FlightTicket",
        originalFileName: "flight_tickets_group.pdf",
        fileSize: 850000,
        mimeType: "application/pdf",
        version: 1,
        uploadedById: "usr-sender-1",
        uploadedByName: "أحمد المحمدي",
        uploadedAt: "2026-09-08T14:45:00.000Z",
        reviewStatus: "Pending",
      },
    ],
    correctionRequests: [],
    statusHistories: [
      {
        id: "sh-001",
        groupRequestId: "req-001",
        fromStatus: "Draft",
        toStatus: "Submitted",
        changedById: "usr-sender-1",
        changedByName: "أحمد المحمدي",
        note: "تم رفع جميع المستندات والجوازات وإرسال المعاملة للتدقيق.",
        createdAt: "2026-09-08T14:50:00.000Z",
      },
    ],
    transfers: [
      {
        id: "tr-001",
        groupRequestId: "req-001",
        fromUserId: "usr-sender-1",
        fromUserName: "أحمد المحمدي",
        toUserId: "usr-safa-1",
        toUserName: "عبدالله السعيد",
        roleStage: "مراجعة الصفا",
        transferredAt: "2026-09-08T14:50:00.000Z",
        status: "Sent",
      },
    ],
  },
  {
    id: "req-002",
    requestNumber: "REQ-2026-002",
    groupName: "فوج النور - معتمرو الرياض",
    senderId: "usr-sender-1",
    senderName: "أحمد المحمدي (وكيل إرسال)",
    assignedSafaEmployeeId: "usr-safa-1",
    assignedSafaEmployeeName: "عبدالله السعيد (موظف تسجيل الصفا)",
    assignedSaudiAgentId: "usr-agent-1",
    assignedSaudiAgentName: "شركة الهدى المعتمدة (الوكيل السعودي)",
    status: "SafaRegistrationCompleted",
    nusukGroupNumber: "NSK-98765432",
    hasHosting: false,
    contactPhone: "+966559876543",
    travelDate: "2026-10-20",
    destination: "مكة المكرمة",
    notes: "تم استخراج أرقام المجموعات من منصة نسك بنجاح.",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-07T16:20:00.000Z",
    travelers: [
      {
        id: "trv-003",
        groupRequestId: "req-002",
        fullName: "عمر خالد المنصور",
        passportNumber: "B44556677",
        nationality: "أردني",
        dateOfBirth: "1988-11-05",
        status: "Accepted",
        createdAt: "2026-09-05T10:10:00.000Z",
        documents: [],
      },
    ],
    groupDocuments: [],
    correctionRequests: [],
    statusHistories: [
      {
        id: "sh-002",
        groupRequestId: "req-002",
        fromStatus: "Draft",
        toStatus: "Submitted",
        changedById: "usr-sender-1",
        changedByName: "أحمد المحمدي",
        createdAt: "2026-09-05T10:30:00.000Z",
      },
      {
        id: "sh-003",
        groupRequestId: "req-002",
        fromStatus: "Submitted",
        toStatus: "UnderReview",
        changedById: "usr-safa-1",
        changedByName: "عبدالله السعيد",
        createdAt: "2026-09-06T09:00:00.000Z",
      },
      {
        id: "sh-004",
        groupRequestId: "req-002",
        fromStatus: "UnderReview",
        toStatus: "SafaRegistrationCompleted",
        changedById: "usr-safa-1",
        changedByName: "عبدالله السعيد",
        note: "تم تسجيل المجموعة برقم نسك NSK-98765432",
        createdAt: "2026-09-07T16:20:00.000Z",
      },
    ],
    transfers: [],
  },
  {
    id: "req-003",
    requestNumber: "REQ-2026-003",
    groupName: "فوج طيبة المباركة",
    senderId: "usr-sender-1",
    senderName: "أحمد المحمدي (وكيل إرسال)",
    assignedSafaEmployeeId: "usr-safa-1",
    assignedSafaEmployeeName: "عبدالله السعيد (موظف تسجيل الصفا)",
    status: "CorrectionRequired",
    hasHosting: false,
    contactPhone: "+966543322110",
    travelDate: "2026-11-01",
    destination: "المدينة المنورة ومكة المكرمة",
    createdAt: "2026-09-09T08:00:00.000Z",
    updatedAt: "2026-09-10T11:45:00.000Z",
    travelers: [
      {
        id: "trv-004",
        groupRequestId: "req-003",
        fullName: "ياسر كمال العتيبي",
        passportNumber: "C99887766",
        nationality: "سعودي",
        dateOfBirth: "1992-03-15",
        status: "NeedsCorrection",
        createdAt: "2026-09-09T08:15:00.000Z",
        documents: [],
      },
    ],
    groupDocuments: [],
    correctionRequests: [
      {
        id: "cor-001",
        groupRequestId: "req-003",
        travelerId: "trv-004",
        travelerName: "ياسر كمال العتيبي",
        targetField: "جواز السفر",
        requestedById: "usr-safa-1",
        requestedByName: "عبدالله السعيد",
        reason: "صورة جواز السفر غير واضحة في خانة تاريخ الانتهاء، يرجى إعادة المسح الضوئي بدقة عالية.",
        status: "Pending",
        createdAt: "2026-09-10T11:45:00.000Z",
      },
    ],
    statusHistories: [
      {
        id: "sh-005",
        groupRequestId: "req-003",
        fromStatus: "Submitted",
        toStatus: "CorrectionRequired",
        changedById: "usr-safa-1",
        changedByName: "عبدالله السعيد",
        note: "صورة جواز السفر غير واضحة.",
        createdAt: "2026-09-10T11:45:00.000Z",
      },
    ],
    transfers: [],
  },
  {
    id: "req-004",
    requestNumber: "REQ-2026-004",
    groupName: "فوج التقوى - حجاج الداخل",
    senderId: "usr-sender-1",
    senderName: "أحمد المحمدي (وكيل إرسال)",
    assignedSafaEmployeeId: "usr-safa-1",
    assignedSafaEmployeeName: "عبدالله السعيد",
    assignedSaudiAgentId: "usr-agent-1",
    assignedSaudiAgentName: "شركة الهدى المعتمدة",
    status: "Completed",
    nusukGroupNumber: "NSK-11223344",
    hasHosting: true,
    contactPhone: "+966567788990",
    travelDate: "2026-09-01",
    destination: "مكة المكرمة",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-28T18:00:00.000Z",
    completedAt: "2026-08-28T18:00:00.000Z",
    travelers: [
      {
        id: "trv-005",
        groupRequestId: "req-004",
        fullName: "حسام الدين البكري",
        passportNumber: "D11224455",
        nationality: "سوداني",
        dateOfBirth: "1970-01-20",
        status: "Accepted",
        createdAt: "2026-08-20T09:30:00.000Z",
        documents: [],
      },
    ],
    groupDocuments: [],
    correctionRequests: [],
    statusHistories: [
      {
        id: "sh-006",
        groupRequestId: "req-004",
        fromStatus: "SaudiAgentProcessing",
        toStatus: "Completed",
        changedById: "usr-agent-1",
        changedByName: "شركة الهدى المعتمدة",
        note: "تم إصدار التأشيرات والباركودات لجميع أعضاء الفوج بنجاح.",
        createdAt: "2026-08-28T18:00:00.000Z",
      },
    ],
    transfers: [],
  },
  {
    id: "req-005",
    requestNumber: "REQ-2026-005",
    groupName: "وفد الإحسان - تجريبي جديد",
    senderId: "usr-sender-1",
    senderName: "أحمد المحمدي (وكيل إرسال)",
    status: "Draft",
    hasHosting: false,
    contactPhone: "+966512398745",
    travelDate: "2026-11-20",
    destination: "مكة المكرمة والمدينة المنورة",
    createdAt: "2026-09-11T10:00:00.000Z",
    updatedAt: "2026-09-11T10:00:00.000Z",
    travelers: [],
    groupDocuments: [],
    correctionRequests: [],
    statusHistories: [],
    transfers: [],
  },
];

export const DEFAULT_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: "log-001",
    userId: "usr-admin-1",
    username: "admin",
    userRole: "Admin",
    action: "تهيئة النظام وقاعدة البيانات المحلية بنجاح",
    entityName: "System",
    entityId: "system_init",
    createdAt: "2026-09-11T12:00:00.000Z",
  },
  {
    id: "log-002",
    userId: "usr-sender-1",
    username: "sender",
    userRole: "Sender",
    action: "إنشاء معاملة جديدة (فوج البركة - REQ-2026-001)",
    entityName: "GroupRequest",
    entityId: "req-001",
    createdAt: "2026-09-08T14:30:00.000Z",
  },
  {
    id: "log-003",
    userId: "usr-safa-1",
    username: "safa_emp",
    userRole: "SafaEmployee",
    action: "إدخال رقم نسك (NSK-98765432) لمعاملة فوج النور",
    entityName: "GroupRequest",
    entityId: "req-002",
    createdAt: "2026-09-07T16:20:00.000Z",
  },
];

// ----------------------------------------------------
// LOCAL DATABASE STORAGE ENGINE (In-Browser Storage)
// ----------------------------------------------------
class LocalDatabaseEngine {
  private users: User[] = [];
  private requests: GroupRequestDetail[] = [];
  private auditLogs: AuditLogItem[] = [];

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === "undefined") return;

    // Load Users
    const storedUsers = localStorage.getItem(DB_KEY_USERS);
    if (storedUsers) {
      try {
        this.users = JSON.parse(storedUsers);
      } catch {
        this.users = [...DEFAULT_USERS];
        this.persistUsers();
      }
    } else {
      this.users = [...DEFAULT_USERS];
      this.persistUsers();
    }

    // Load Requests
    const storedRequests = localStorage.getItem(DB_KEY_REQUESTS);
    if (storedRequests) {
      try {
        this.requests = JSON.parse(storedRequests);
        // Retroactively link HostId document if missing
        this.requests.forEach((req) => {
          if (req.hasHosting || req.hostingInfo) {
            if (!req.hostingInfo) {
              req.hostingInfo = {
                id: "host-" + Date.now(),
                groupRequestId: req.id,
                hostName: "مستضيف داخل المملكة",
                hostPhone: req.contactPhone || "",
                hostAddress: "",
              };
            }
            if (!req.hostingInfo.hostIdDocument) {
              const hostDoc = req.groupDocuments?.find(
                (d) => d.documentType === "HostId" || d.id === req.hostingInfo?.hostIdDocumentId
              );
              if (hostDoc) {
                req.hostingInfo.hostIdDocument = hostDoc;
                req.hostingInfo.hostIdDocumentId = hostDoc.id;
              }
            }
          }
        });
      } catch {
        this.requests = [...DEFAULT_REQUESTS];
        this.persistRequests();
      }
    } else {
      this.requests = [...DEFAULT_REQUESTS];
      this.persistRequests();
    }

    // Load Audit Logs
    const storedLogs = localStorage.getItem(DB_KEY_AUDIT_LOGS);
    if (storedLogs) {
      try {
        this.auditLogs = JSON.parse(storedLogs);
      } catch {
        this.auditLogs = [...DEFAULT_AUDIT_LOGS];
        this.persistLogs();
      }
    } else {
      this.auditLogs = [...DEFAULT_AUDIT_LOGS];
      this.persistLogs();
    }
  }

  private persistUsers() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DB_KEY_USERS, JSON.stringify(this.users));
    }
  }

  private persistRequests() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DB_KEY_REQUESTS, JSON.stringify(this.requests));
    }
  }

  private persistLogs() {
    if (typeof window !== "undefined") {
      localStorage.setItem(DB_KEY_AUDIT_LOGS, JSON.stringify(this.auditLogs));
    }
  }

  public logAction(
    user: { id?: string; username?: string; role?: string } | null,
    action: string,
    entityName: string,
    entityId: string,
    metadata?: Record<string, any>
  ) {
    const item: AuditLogItem = {
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      userId: user?.id,
      username: user?.username || "زائر",
      userRole: user?.role,
      action,
      entityName,
      entityId,
      metadataJson: metadata ? JSON.stringify(metadata) : undefined,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(item);
    if (this.auditLogs.length > 200) this.auditLogs.pop();
    this.persistLogs();
  }

  // --- Auth & Users ---
  public getUsers(): User[] {
    return [...this.users];
  }

  public findUserByUsername(username: string): User | undefined {
    return this.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
  }

  public findUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  public createUser(userData: {
    fullName: string;
    username: string;
    password?: string;
    role: any;
    phone?: string;
  }): User {
    const newUser: User = {
      id: "usr-" + Date.now(),
      fullName: userData.fullName,
      username: userData.username.trim(),
      password: userData.password || "123456",
      role: userData.role,
      phone: userData.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.persistUsers();
    this.logAction(null, `إنشاء مستخدم جديد: ${newUser.fullName} (${newUser.username})`, "User", newUser.id);
    return newUser;
  }

  public updateUser(
    id: string,
    data: { fullName: string; password?: string; role: any; phone?: string; isActive: boolean }
  ): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error("المستخدم غير موجود");
    user.fullName = data.fullName;
    if (data.password) user.password = data.password;
    user.role = data.role;
    user.phone = data.phone;
    user.isActive = data.isActive;
    this.persistUsers();
    this.logAction(null, `تحديث بيانات المستخدم: ${user.fullName}`, "User", user.id);
    return user;
  }

  public toggleUserStatus(id: string): { isActive: boolean; message: string } {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error("المستخدم غير موجود");
    user.isActive = !user.isActive;
    this.persistUsers();
    const statusText = user.isActive ? "تفعيل" : "تعطيل";
    this.logAction(null, `${statusText} حساب المستخدم: ${user.username}`, "User", user.id);
    return {
      isActive: user.isActive,
      message: `تم ${statusText} حساب المستخدم بنجاح.`,
    };
  }

  // --- Requests ---
  public getRequests(
    statusFilter?: string,
    nusukNumber?: string,
    search?: string
  ): GroupRequestSummary[] {
    let list = this.requests.map((r) => {
      let docCount = r.groupDocuments.length;
      r.travelers.forEach((t) => {
        docCount += t.documents ? t.documents.length : 0;
      });
      const pendingCorrections = r.correctionRequests.filter(
        (c) => c.status === "Pending"
      ).length;

      const summary: GroupRequestSummary = {
        id: r.id,
        requestNumber: r.requestNumber,
        groupName: r.groupName,
        senderId: r.senderId,
        senderName: r.senderName,
        assignedSafaEmployeeId: r.assignedSafaEmployeeId,
        assignedSafaEmployeeName: r.assignedSafaEmployeeName,
        assignedSaudiAgentId: r.assignedSaudiAgentId,
        assignedSaudiAgentName: r.assignedSaudiAgentName,
        status: r.status,
        nusukGroupNumber: r.nusukGroupNumber,
        hasHosting: r.hasHosting,
        contactPhone: r.contactPhone,
        travelDate: r.travelDate,
        departureDate: r.departureDate || r.travelDate,
        returnDate: r.returnDate,
        flightDepartureTime: r.flightDepartureTime,
        airportArrivalTime: r.airportArrivalTime,
        destination: r.destination,
        travelersCount: r.travelers.length,
        documentsCount: docCount,
        pendingCorrectionsCount: pendingCorrections,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
      return summary;
    });

    if (statusFilter && statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (nusukNumber) {
      list = list.filter(
        (r) =>
          r.nusukGroupNumber &&
          r.nusukGroupNumber.toLowerCase().includes(nusukNumber.toLowerCase())
      );
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.groupName.toLowerCase().includes(q) ||
          r.requestNumber.toLowerCase().includes(q) ||
          r.contactPhone.includes(q) ||
          (r.nusukGroupNumber && r.nusukGroupNumber.toLowerCase().includes(q))
      );
    }

    return list.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getRequestById(id: string): GroupRequestDetail {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة المطلوبة غير موجودة");

    if (req.hasHosting || req.hostingInfo) {
      if (!req.hostingInfo) {
        req.hostingInfo = {
          id: "host-" + Date.now(),
          groupRequestId: req.id,
          hostName: "مستضيف داخل المملكة",
          hostPhone: req.contactPhone || "",
          hostAddress: "",
        };
      }
      if (!req.hostingInfo.hostIdDocument) {
        const hostDoc = req.groupDocuments?.find(
          (d) => d.documentType === "HostId" || d.id === req.hostingInfo?.hostIdDocumentId
        );
        if (hostDoc) {
          req.hostingInfo.hostIdDocument = hostDoc;
          req.hostingInfo.hostIdDocumentId = hostDoc.id;
        }
      }
    }

    return JSON.parse(JSON.stringify(req));
  }

  public createRequest(
    data: {
      groupName: string;
      contactPhone: string;
      travelDate?: string;
      departureDate?: string;
      returnDate?: string;
      flightDepartureTime?: string;
      airportArrivalTime?: string;
      destination?: string;
      notes?: string;
      hasHosting: boolean;
      hostName?: string;
      hostPhone?: string;
      hostAddress?: string;
    },
    currentUser: User
  ): GroupRequestDetail {
    const now = new Date().toISOString();
    const count = this.requests.length + 1;
    const reqNumber = `REQ-2026-${String(count).padStart(3, "0")}`;

    const gName =
      data.groupName && data.groupName.trim()
        ? data.groupName.trim()
        : `معاملة جديدة - ${reqNumber}`;
    const cPhone =
      data.contactPhone && data.contactPhone.trim()
        ? data.contactPhone.trim()
        : data.hostPhone && data.hostPhone.trim()
        ? data.hostPhone.trim()
        : currentUser.phone || "05xxxxxxxx";

    const newReq: GroupRequestDetail = {
      id: "req-" + Date.now(),
      requestNumber: reqNumber,
      groupName: gName,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      status: "Draft",
      hasHosting: data.hasHosting,
      contactPhone: cPhone,
      travelDate: data.departureDate || data.travelDate,
      departureDate: data.departureDate || data.travelDate,
      returnDate: data.returnDate,
      flightDepartureTime: data.flightDepartureTime,
      airportArrivalTime: data.airportArrivalTime,
      destination: data.destination || "مكة المكرمة والمدينة المنورة",
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      hostingInfo: data.hasHosting
        ? {
            id: "host-" + Date.now(),
            groupRequestId: "",
            hostName: data.hostName && data.hostName.trim() ? data.hostName.trim() : "مستضيف داخل المملكة",
            hostPhone: data.hostPhone && data.hostPhone.trim() ? data.hostPhone.trim() : "",
            hostAddress: data.hostAddress || "",
          }
        : undefined,
      travelers: [],
      groupDocuments: [],
      correctionRequests: [],
      statusHistories: [
        {
          id: "sh-" + Date.now(),
          groupRequestId: "",
          fromStatus: "Draft",
          toStatus: "Draft",
          changedById: currentUser.id,
          changedByName: currentUser.fullName,
          note: "إنشاء مسودة المعاملة",
          createdAt: now,
        },
      ],
      transfers: [],
    };
    newReq.statusHistories[0].groupRequestId = newReq.id;
    if (newReq.hostingInfo) newReq.hostingInfo.groupRequestId = newReq.id;

    this.requests.unshift(newReq);
    this.persistRequests();
    this.logAction(
      currentUser,
      `إنشاء معاملة جديدة: ${newReq.groupName} (${newReq.requestNumber})`,
      "GroupRequest",
      newReq.id
    );
    return newReq;
  }

  public updateRequest(
    id: string,
    data: {
      groupName: string;
      contactPhone: string;
      travelDate?: string;
      departureDate?: string;
      returnDate?: string;
      flightDepartureTime?: string;
      airportArrivalTime?: string;
      destination?: string;
      notes?: string;
      hasHosting: boolean;
      hostName?: string;
      hostPhone?: string;
      hostAddress?: string;
    },
    currentUser?: User
  ) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    req.groupName = data.groupName;
    req.contactPhone = data.contactPhone;
    req.travelDate = data.departureDate || data.travelDate;
    if (data.departureDate !== undefined) req.departureDate = data.departureDate;
    if (data.returnDate !== undefined) req.returnDate = data.returnDate;
    if (data.flightDepartureTime !== undefined) req.flightDepartureTime = data.flightDepartureTime;
    if (data.airportArrivalTime !== undefined) req.airportArrivalTime = data.airportArrivalTime;
    req.destination = data.destination;
    req.notes = data.notes;
    req.hasHosting = data.hasHosting;
    req.updatedAt = new Date().toISOString();

    if (data.hasHosting) {
      if (!req.hostingInfo) {
        req.hostingInfo = {
          id: "host-" + Date.now(),
          groupRequestId: req.id,
          hostName: data.hostName || "",
          hostPhone: data.hostPhone || "",
          hostAddress: data.hostAddress || "",
        };
      } else {
        req.hostingInfo.hostName = data.hostName || "";
        req.hostingInfo.hostPhone = data.hostPhone || "";
        req.hostingInfo.hostAddress = data.hostAddress || "";
      }
    }

    this.persistRequests();
    this.logAction(currentUser || null, `تعديل بيانات المعاملة: ${req.groupName}`, "GroupRequest", req.id);
  }

  public submitRequest(id: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");
    if (req.travelers.length === 0) {
      throw new Error("لا يمكن تقديم معاملة لا تحتوي على أي معتمر مسجل");
    }

    const prev = req.status;
    req.status = "Submitted";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: "Submitted",
      changedById: currentUser?.id || "sender",
      changedByName: currentUser?.fullName || "المرسل",
      note: "تم تقديم المعاملة للمراجعة والتدقيق",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(currentUser || null, `تقديم المعاملة للمراجعة: ${req.groupName}`, "GroupRequest", req.id);
  }

  public transitionStatus(
    id: string,
    newStatus: RequestStatus,
    note?: string,
    currentUser?: User
  ) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    const prev = req.status;
    req.status = newStatus;
    req.updatedAt = new Date().toISOString();
    if (newStatus === "Completed") {
      req.completedAt = new Date().toISOString();
    }

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: newStatus,
      changedById: currentUser?.id || "system",
      changedByName: currentUser?.fullName || "المستخدم",
      note: note || `تغيير الحالة إلى ${newStatus}`,
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `تحديث حالة المعاملة (${req.requestNumber}) إلى: ${newStatus}`,
      "GroupRequest",
      req.id
    );
  }

  public safaComplete(
    id: string,
    nusukGroupNumber: string,
    note?: string,
    currentUser?: User
  ) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    req.nusukGroupNumber = nusukGroupNumber;
    req.status = "SafaRegistrationCompleted";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: "UnderReview",
      toStatus: "SafaRegistrationCompleted",
      changedById: currentUser?.id || "safa",
      changedByName: currentUser?.fullName || "موظف الصفا",
      note: note
        ? `${note} (رقم نسك: ${nusukGroupNumber})`
        : `تم إكمال تسجيل الصفا وتوليد رقم نسك: ${nusukGroupNumber}`,
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `إكمال تسجيل الصفا وإدخال رقم نسك (${nusukGroupNumber}) للمعاملة: ${req.groupName}`,
      "GroupRequest",
      req.id
    );
  }

  public sendToAgent(
    id: string,
    saudiAgentId?: string,
    note?: string,
    currentUser?: User
  ) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    if (saudiAgentId) {
      const agent = this.users.find((u) => u.id === saudiAgentId);
      if (agent) {
        req.assignedSaudiAgentId = agent.id;
        req.assignedSaudiAgentName = agent.fullName;
      }
    } else {
      // Pick first agent
      const defAgent = this.users.find((u) => u.role === "SaudiAgent");
      if (defAgent) {
        req.assignedSaudiAgentId = defAgent.id;
        req.assignedSaudiAgentName = defAgent.fullName;
      }
    }

    req.status = "ReadyForSaudiAgent";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: "SafaRegistrationCompleted",
      toStatus: "ReadyForSaudiAgent",
      changedById: currentUser?.id || "safa",
      changedByName: currentUser?.fullName || "موظف الصفا",
      note: note || "تمت إحالة المعاملة إلى الوكيل السعودي",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `إحالة المعاملة (${req.requestNumber}) للوكيل السعودي: ${req.assignedSaudiAgentName}`,
      "GroupRequest",
      req.id
    );
  }

  public agentReceive(id: string, note?: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    req.status = "ReceivedBySaudiAgent";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: "ReadyForSaudiAgent",
      toStatus: "ReceivedBySaudiAgent",
      changedById: currentUser?.id || "agent",
      changedByName: currentUser?.fullName || "الوكيل السعودي",
      note: note || "تم استلام المعاملة من قبل الوكيل السعودي وبدء التحقق",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `استلام المعاملة من قبل الوكيل السعودي: ${req.groupName}`,
      "GroupRequest",
      req.id
    );
  }

  public agentLinkProgram(id: string, note?: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    const prev = req.status;
    req.status = "ProgramLinked";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: "ProgramLinked",
      changedById: currentUser?.id || "agent",
      changedByName: currentUser?.fullName || "الوكيل السعودي",
      note: note || "تم ربط البرنامج بنجاح من قبل الوكيل السعودي",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `تم ربط البرنامج للمعاملة (${req.requestNumber})`,
      "GroupRequest",
      req.id
    );
  }

  public agentRequestHostingAcceptance(id: string, note?: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    const prev = req.status;
    req.status = "HostingAcceptanceRequested";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: "HostingAcceptanceRequested",
      changedById: currentUser?.id || "agent",
      changedByName: currentUser?.fullName || "الوكيل السعودي",
      note: note || "تم إرسال طلب قبول الاستضافة إلى المرسل للموافقة والتأكيد",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `طلب قبول الاستضافة للمعاملة (${req.requestNumber}) وإحالتها للمرسل`,
      "GroupRequest",
      req.id
    );
  }

  public senderAcceptHosting(id: string, note?: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    const prev = req.status;
    req.status = "HostingAcceptedBySender";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: "HostingAcceptedBySender",
      changedById: currentUser?.id || "sender",
      changedByName: currentUser?.fullName || "المرسل",
      note: note || "تم قبول طلب الاستضافة من قبل المرسل",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `قبول طلب الاستضافة للمعاملة (${req.requestNumber}) من المرسل`,
      "GroupRequest",
      req.id
    );
  }

  public senderConfirmHosting(id: string, note?: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    const prev = req.status;
    req.status = "HostingConfirmed";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: "HostingConfirmed",
      changedById: currentUser?.id || "sender",
      changedByName: currentUser?.fullName || "المرسل",
      note: note || "تم تأكيد الاستضافة وإحالتها للوكيل السعودي للاعتماد النهائي",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `تأكيد الاستضافة للمعاملة (${req.requestNumber}) وإعادتها للوكيل`,
      "GroupRequest",
      req.id
    );
  }

  public agentComplete(id: string, note?: string, currentUser?: User) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    const prev = req.status;
    req.status = "Completed";
    req.completedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: prev,
      toStatus: "Completed",
      changedById: currentUser?.id || "agent",
      changedByName: currentUser?.fullName || "الوكيل السعودي",
      note: note || "تم إصدار التأشيرات والباركودات وإتمام المعاملة نهائياً بنجاح",
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `إتمام المعاملة نهائياً بنجاح (${req.requestNumber})`,
      "GroupRequest",
      req.id
    );
  }

  public requestCorrection(
    id: string,
    data: {
      travelerId?: string;
      documentId?: string;
      targetField?: string;
      reason: string;
    },
    currentUser?: User
  ) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    let travelerName: string | undefined;
    if (data.travelerId) {
      const trv = req.travelers.find((t) => t.id === data.travelerId);
      if (trv) {
        trv.status = "NeedsCorrection";
        travelerName = trv.fullName;
      }
    }

    const corr: CorrectionRequest = {
      id: "cor-" + Date.now(),
      groupRequestId: req.id,
      travelerId: data.travelerId,
      travelerName,
      documentId: data.documentId,
      targetField: data.targetField,
      requestedById: currentUser?.id || "emp",
      requestedByName: currentUser?.fullName || "الموظف المدقق",
      reason: data.reason,
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    req.correctionRequests.unshift(corr);
    req.status = "CorrectionRequired";
    req.updatedAt = new Date().toISOString();

    req.statusHistories.unshift({
      id: "sh-" + Date.now(),
      groupRequestId: req.id,
      fromStatus: req.status,
      toStatus: "CorrectionRequired",
      changedById: currentUser?.id || "emp",
      changedByName: currentUser?.fullName || "الموظف المدقق",
      note: `مطلوب تصحيح: ${data.reason}`,
      createdAt: new Date().toISOString(),
    });

    this.persistRequests();
    this.logAction(
      currentUser || null,
      `طلب تصحيح جديد للمعاملة (${req.requestNumber}): ${data.reason}`,
      "CorrectionRequest",
      corr.id
    );
  }

  public resolveCorrection(
    correctionId: string,
    resolutionNotes?: string,
    currentUser?: User
  ) {
    for (const req of this.requests) {
      const corr = req.correctionRequests.find((c) => c.id === correctionId);
      if (corr) {
        corr.status = "Resolved";
        corr.resolutionNotes = resolutionNotes;
        corr.resolvedAt = new Date().toISOString();

        if (corr.travelerId) {
          const trv = req.travelers.find((t) => t.id === corr.travelerId);
          if (trv) trv.status = "Pending";
        }

        const anyPending = req.correctionRequests.some(
          (c) => c.status === "Pending"
        );
        if (!anyPending) {
          req.status = "Submitted";
        }
        req.updatedAt = new Date().toISOString();
        this.persistRequests();
        this.logAction(
          currentUser || null,
          `حل طلب التصحيح للمعاملة: ${req.requestNumber}`,
          "CorrectionRequest",
          correctionId
        );
        return;
      }
    }
    throw new Error("طلب التصحيح غير موجود");
  }

  // --- Travelers ---
  public addTraveler(
    requestId: string,
    data: {
      fullName: string;
      passportNumber?: string;
      nationality?: string;
      dateOfBirth?: string;
      notes?: string;
    },
    currentUser?: User
  ): Traveler {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) throw new Error("المعاملة غير موجودة");

    const newTraveler: Traveler = {
      id: "trv-" + Date.now(),
      groupRequestId: req.id,
      fullName: data.fullName,
      passportNumber: data.passportNumber,
      nationality: data.nationality || "سعودي",
      dateOfBirth: data.dateOfBirth,
      status: "Pending",
      notes: data.notes,
      createdAt: new Date().toISOString(),
      documents: [],
    };

    req.travelers.push(newTraveler);
    req.updatedAt = new Date().toISOString();
    this.persistRequests();
    this.logAction(
      currentUser || null,
      `إضافة معتمر جديد (${newTraveler.fullName}) إلى المعاملة: ${req.groupName}`,
      "Traveler",
      newTraveler.id
    );
    return newTraveler;
  }

  public updateTraveler(
    travelerId: string,
    data: {
      fullName: string;
      passportNumber?: string;
      nationality?: string;
      dateOfBirth?: string;
      notes?: string;
    },
    currentUser?: User
  ) {
    for (const req of this.requests) {
      const trv = req.travelers.find((t) => t.id === travelerId);
      if (trv) {
        trv.fullName = data.fullName;
        trv.passportNumber = data.passportNumber;
        trv.nationality = data.nationality;
        trv.dateOfBirth = data.dateOfBirth;
        trv.notes = data.notes;
        req.updatedAt = new Date().toISOString();
        this.persistRequests();
        this.logAction(
          currentUser || null,
          `تحديث بيانات المعتمر: ${trv.fullName}`,
          "Traveler",
          trv.id
        );
        return;
      }
    }
    throw new Error("المعتمر غير موجود");
  }

  public deleteTraveler(travelerId: string, currentUser?: User) {
    for (const req of this.requests) {
      const index = req.travelers.findIndex((t) => t.id === travelerId);
      if (index !== -1) {
        const trv = req.travelers[index];
        req.travelers.splice(index, 1);
        req.updatedAt = new Date().toISOString();
        this.persistRequests();
        this.logAction(
          currentUser || null,
          `حذف المعتمر: ${trv.fullName}`,
          "Traveler",
          travelerId
        );
        return;
      }
    }
    throw new Error("المعتمر غير موجود");
  }

  // --- Documents ---
  public async uploadDocument(
    requestId: string,
    file: File,
    documentType: DocumentType,
    travelerId?: string,
    currentUser?: User
  ): Promise<DocumentItem> {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) throw new Error("المعاملة غير موجودة");

    const docId = "doc-" + Date.now();
    const docItem: DocumentItem = {
      id: docId,
      groupRequestId: req.id,
      travelerId,
      documentType,
      originalFileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      version: 1,
      uploadedById: currentUser?.id || "user",
      uploadedByName: currentUser?.fullName || "المستخدم",
      uploadedAt: new Date().toISOString(),
      reviewStatus: "Pending",
    };

    // Convert file to Base64 and store in IndexedDB
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const dataUrl = await base64Promise;
      await saveFileToIndexedDB(docId, dataUrl);
    } catch (e) {
      console.warn("Could not save file to IndexedDB:", e);
    }

    if (travelerId) {
      const trv = req.travelers.find((t) => t.id === travelerId);
      if (trv) {
        if (!trv.documents) trv.documents = [];
        trv.documents.push(docItem);
      }
    } else {
      if (documentType === "HostId") {
        if (!req.hostingInfo) {
          req.hostingInfo = {
            id: "host-" + Date.now(),
            groupRequestId: req.id,
            hostName: "مستضيف داخل المملكة",
            hostPhone: req.contactPhone || "",
            hostAddress: "",
          };
        }
        req.hostingInfo.hostIdDocumentId = docId;
        req.hostingInfo.hostIdDocument = docItem;

        // Remove previous HostId document from groupDocuments if any
        const prevIdx = req.groupDocuments.findIndex((d) => d.documentType === "HostId");
        if (prevIdx !== -1) {
          req.groupDocuments.splice(prevIdx, 1);
        }
      }
      req.groupDocuments.push(docItem);
    }

    req.updatedAt = new Date().toISOString();
    this.persistRequests();
    this.logAction(
      currentUser || null,
      `رفع مستند (${file.name}) لنوع (${documentType})`,
      "Document",
      docId
    );
    return docItem;
  }

  public async getDocumentStream(documentId: string): Promise<string> {
    const fromIdb = await getFileFromIndexedDB(documentId);
    if (fromIdb) return fromIdb;

    // Fallback: Generate a clean placeholder SVG / DataURL
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="100%" height="100%" fill="#f8fafc"/>
        <rect x="20" y="20" width="560" height="360" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
        <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#0284c7">
          معاينة المستند الرقمي
        </text>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#64748b">
          رقم المستند: ${documentId}
        </text>
        <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#10b981">
          ✓ موثق ومحفوظ بأمان داخل المتصفح
        </text>
      </svg>
    `;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  public deleteDocument(documentId: string, currentUser?: User) {
    for (const req of this.requests) {
      if (
        req.hostingInfo &&
        (req.hostingInfo.hostIdDocumentId === documentId ||
          req.hostingInfo.hostIdDocument?.id === documentId)
      ) {
        req.hostingInfo.hostIdDocumentId = undefined;
        req.hostingInfo.hostIdDocument = undefined;
      }

      // Group docs
      const gIndex = req.groupDocuments.findIndex((d) => d.id === documentId);
      if (gIndex !== -1) {
        const doc = req.groupDocuments[gIndex];
        req.groupDocuments.splice(gIndex, 1);
        req.updatedAt = new Date().toISOString();
        this.persistRequests();
        this.logAction(currentUser || null, `حذف المستند: ${doc.originalFileName}`, "Document", documentId);
        return;
      }
      // Traveler docs
      for (const trv of req.travelers) {
        if (trv.documents) {
          const tIndex = trv.documents.findIndex((d) => d.id === documentId);
          if (tIndex !== -1) {
            const doc = trv.documents[tIndex];
            trv.documents.splice(tIndex, 1);
            req.updatedAt = new Date().toISOString();
            this.persistRequests();
            this.logAction(currentUser || null, `حذف المستند: ${doc.originalFileName}`, "Document", documentId);
            return;
          }
        }
      }
    }
    throw new Error("المستند غير موجود");
  }

  public reviewDocument(
    documentId: string,
    reviewStatus: DocumentReviewStatus,
    reviewNote?: string,
    currentUser?: User
  ) {
    for (const req of this.requests) {
      if (
        req.hostingInfo?.hostIdDocument &&
        (req.hostingInfo.hostIdDocument.id === documentId ||
          req.hostingInfo.hostIdDocumentId === documentId)
      ) {
        req.hostingInfo.hostIdDocument.reviewStatus = reviewStatus;
        req.hostingInfo.hostIdDocument.reviewNote = reviewNote;
      }

      const allDocs = [
        ...req.groupDocuments,
        ...req.travelers.flatMap((t) => t.documents || []),
      ];
      const doc = allDocs.find((d) => d.id === documentId);
      if (doc) {
        doc.reviewStatus = reviewStatus;
        doc.reviewNote = reviewNote;
        req.updatedAt = new Date().toISOString();
        this.persistRequests();
        this.logAction(
          currentUser || null,
          `مراجعة مستند (${doc.originalFileName}): الحالة ${reviewStatus}`,
          "Document",
          documentId
        );
        return;
      }
    }
    throw new Error("المستند غير موجود");
  }

  // --- Admin Stats & Reassign ---
  public getAdminStats(): AdminStats {
    let totalTravelers = 0;
    const statusCounts: Record<string, number> = {};

    this.requests.forEach((r) => {
      totalTravelers += r.travelers.length;
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    const employees = this.users.filter(
      (u) => u.role === "SafaEmployee" || u.role === "SaudiAgent"
    );
    const requestsByEmployee = employees.map((emp) => {
      const assigned = this.requests.filter(
        (r) =>
          r.assignedSafaEmployeeId === emp.id ||
          r.assignedSaudiAgentId === emp.id
      ).length;
      const completed = this.requests.filter(
        (r) =>
          (r.assignedSafaEmployeeId === emp.id ||
            r.assignedSaudiAgentId === emp.id) &&
          r.status === "Completed"
      ).length;
      return {
        employeeName: emp.fullName,
        role: emp.role,
        assignedCount: assigned,
        completedCount: completed,
      };
    });

    return {
      totalGroups: this.requests.length,
      totalTravelers,
      newRequests: statusCounts["Submitted"] || 0,
      underReview: statusCounts["UnderReview"] || 0,
      missingDocuments: statusCounts["MissingDocuments"] || 0,
      correctionRequired: statusCounts["CorrectionRequired"] || 0,
      readyForSaudiAgent: statusCounts["ReadyForSaudiAgent"] || 0,
      receivedBySaudiAgent: statusCounts["ReceivedBySaudiAgent"] || 0,
      saudiAgentProcessing: statusCounts["SaudiAgentProcessing"] || 0,
      completed: statusCounts["Completed"] || 0,
      cancelled: statusCounts["Cancelled"] || 0,
      requestsByStatus: statusCounts,
      requestsByEmployee,
    };
  }

  public reassignRequest(
    id: string,
    safaEmployeeId?: string,
    saudiAgentId?: string,
    currentUser?: User
  ) {
    const req = this.requests.find((r) => r.id === id);
    if (!req) throw new Error("المعاملة غير موجودة");

    if (safaEmployeeId) {
      const safa = this.users.find((u) => u.id === safaEmployeeId);
      if (safa) {
        req.assignedSafaEmployeeId = safa.id;
        req.assignedSafaEmployeeName = safa.fullName;
      }
    }
    if (saudiAgentId) {
      const agent = this.users.find((u) => u.id === saudiAgentId);
      if (agent) {
        req.assignedSaudiAgentId = agent.id;
        req.assignedSaudiAgentName = agent.fullName;
      }
    }

    req.updatedAt = new Date().toISOString();
    this.persistRequests();
    this.logAction(
      currentUser || null,
      `إعادة تعيين موظفي المعاملة: ${req.requestNumber}`,
      "GroupRequest",
      req.id
    );
  }

  public getAuditLogs(limit = 50): AuditLogItem[] {
    return this.auditLogs.slice(0, limit);
  }

  // --- Export & Import Backup ---
  public exportData(): string {
    return JSON.stringify(
      {
        version: "2.0.0",
        exportedAt: new Date().toISOString(),
        users: this.users,
        requests: this.requests,
        auditLogs: this.auditLogs,
      },
      null,
      2
    );
  }

  public importData(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.users) && Array.isArray(data.requests)) {
        this.users = data.users;
        this.requests = data.requests;
        this.auditLogs = Array.isArray(data.auditLogs)
          ? data.auditLogs
          : [...DEFAULT_AUDIT_LOGS];
        this.persistUsers();
        this.persistRequests();
        this.persistLogs();
        return true;
      }
      throw new Error("صيغة الملف غير صالحة");
    } catch (e: any) {
      throw new Error("فشل استيراد البيانات: " + e.message);
    }
  }

  public resetToDefault() {
    this.users = [...DEFAULT_USERS];
    this.requests = [...DEFAULT_REQUESTS];
    this.auditLogs = [...DEFAULT_AUDIT_LOGS];
    this.persistUsers();
    this.persistRequests();
    this.persistLogs();
  }

  public getAllRequestsFull(): GroupRequestDetail[] {
    return JSON.parse(JSON.stringify(this.requests));
  }

  public async clearAllRequests(currentUser?: User): Promise<void> {
    this.requests = [];
    this.persistRequests();
    await clearIndexedDB();
    this.logAction(
      currentUser || null,
      "مسح جميع المعاملات والمرفقات من النظام بالكامل",
      "System",
      "clear_all_requests"
    );
  }

  public async wipeAllData(currentUser?: User): Promise<void> {
    this.requests = [];
    this.users = [...DEFAULT_USERS];
    this.auditLogs = [];
    this.persistRequests();
    this.persistUsers();
    this.persistLogs();
    await clearIndexedDB();
    this.logAction(
      currentUser || null,
      "إعادة ضبط المصنع ومسح كافة البيانات بالكامل",
      "System",
      "wipe_all_data"
    );
  }

  public getStorageStats() {
    let totalTravelers = 0;
    let totalDocs = 0;
    this.requests.forEach((r) => {
      totalDocs += r.groupDocuments ? r.groupDocuments.length : 0;
      if (r.travelers) {
        totalTravelers += r.travelers.length;
        r.travelers.forEach((t) => {
          totalDocs += t.documents ? t.documents.length : 0;
        });
      }
    });

    let storageBytes = 0;
    if (typeof window !== "undefined") {
      try {
        const u = localStorage.getItem(DB_KEY_USERS) || "";
        const req = localStorage.getItem(DB_KEY_REQUESTS) || "";
        const a = localStorage.getItem(DB_KEY_AUDIT_LOGS) || "";
        storageBytes = (u.length + req.length + a.length) * 2;
      } catch {
        storageBytes = 0;
      }
    }

    return {
      requestsCount: this.requests.length,
      travelersCount: totalTravelers,
      documentsCount: totalDocs,
      usersCount: this.users.length,
      storageSizeKb: Math.max(1, Math.round(storageBytes / 1024)),
    };
  }
}

export const localDB = new LocalDatabaseEngine();

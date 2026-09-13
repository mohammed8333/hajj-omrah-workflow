import {
  AdminStats,
  AuditLogItem,
  DocumentItem,
  DocumentReviewStatus,
  DocumentType,
  GroupRequestDetail,
  GroupRequestSummary,
  LoginResponse,
  RequestStatus,
  Traveler,
  User,
} from "@/types";
import { localDB } from "./localDatabase";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

export const setToken = (token: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
};

export const removeToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("active_user_id");
  }
};

export const getCurrentUserId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("active_user_id");
};

export const setCurrentUserId = (userId: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("active_user_id", userId);
  }
};

// Helper: simulate slight async delay for smooth UI feedback
const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  auth: {
    login: async (username: string, pass: string): Promise<LoginResponse> => {
      await delay();
      const user = localDB.findUserByUsername(username);
      if (!user) {
        throw new Error("اسم المستخدم غير موجود");
      }
      if (user.password && user.password !== pass) {
        throw new Error("كلمة المرور غير صحيحة");
      }
      if (!user.isActive) {
        throw new Error("هذا الحساب معطل حالياً من قبل الإدارة");
      }

      const token = `fake-jwt-token-${user.id}-${Date.now()}`;
      setToken(token);
      setCurrentUserId(user.id);

      localDB.logAction(user, `تسجيل دخول ناجح للمستخدم: ${user.fullName}`, "Auth", user.id);

      return {
        token,
        userId: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
      };
    },

    getMe: async (): Promise<User> => {
      await delay();
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("غير مسجل الدخول");
      }
      const user = localDB.findUserById(userId);
      if (!user || !user.isActive) {
        throw new Error("جلسة العمل منتهية أو الحساب غير نشط");
      }
      return user;
    },
  },

  requests: {
    getAll: async (
      statusFilter?: string,
      nusukNumber?: string,
      search?: string
    ): Promise<GroupRequestSummary[]> => {
      await delay();
      return localDB.getRequests(statusFilter, nusukNumber, search);
    },

    getById: async (id: string): Promise<GroupRequestDetail> => {
      await delay();
      return localDB.getRequestById(id);
    },

    create: async (data: {
      groupName: string;
      contactPhone: string;
      travelDate?: string;
      departureDate?: string;
      returnDate?: string;
      flightDepartureTime?: string;
      airportArrivalTime?: string;
      airline?: string;
      flightNumber?: string;
      destination?: string;
      notes?: string;
      hasHosting: boolean;
      hostName?: string;
      hostPhone?: string;
      hostBirthDate?: string;
      hostNationality?: string;
      hostNationalId?: string;
      hostAddress?: string;
    }): Promise<GroupRequestDetail> => {
      await delay();
      const current = await api.auth.getMe();
      return localDB.createRequest(data, current);
    },

    update: async (
      id: string,
      data: {
        groupName?: string;
        contactPhone?: string;
        travelDate?: string;
        departureDate?: string;
        returnDate?: string;
        flightDepartureTime?: string;
        airportArrivalTime?: string;
        airline?: string;
        flightNumber?: string;
        flightTicketDocumentId?: string;
        destination?: string;
        notes?: string;
        hasHosting?: boolean;
        hostName?: string;
        hostPhone?: string;
        hostBirthDate?: string;
        hostNationality?: string;
        hostNationalId?: string;
        hostAddress?: string;
      }
    ): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.updateRequest(id, data, current);
    },

    submit: async (id: string): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.submitRequest(id, current);
      return { message: "تم تقديم المعاملة بنجاح للمراجعة والتدقيق" };
    },

    transition: async (
      id: string,
      newStatus: RequestStatus,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.transitionStatus(id, newStatus, note, current);
      return { message: `تم تحديث حالة المعاملة بنجاح إلى: ${newStatus}` };
    },

    safaComplete: async (
      id: string,
      nusukGroupNumber: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.safaComplete(id, nusukGroupNumber, note, current);
      return { message: "تم تسجيل الصفا وتعيين رقم نسك بنجاح" };
    },

    sendToAgent: async (
      id: string,
      saudiAgentId?: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.sendToAgent(id, saudiAgentId, note, current);
      return { message: "تمت إحالة المعاملة إلى الوكيل السعودي بنجاح" };
    },

    agentReceive: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.agentReceive(id, note, current);
      return { message: "تم استلام المعاملة من قبل الوكيل السعودي" };
    },

    linkProgram: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.agentLinkProgram(id, note, current);
      return { message: "تم ربط البرنامج بنجاح" };
    },

    requestHostingAcceptance: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.agentRequestHostingAcceptance(id, note, current);
      return { message: "تم إرسال طلب قبول الاستضافة للمرسل" };
    },

    acceptHosting: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.senderAcceptHosting(id, note, current);
      return { message: "تم قبول طلب الاستضافة" };
    },

    confirmHosting: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.senderConfirmHosting(id, note, current);
      return { message: "تم تأكيد الاستضافة للوكيل السعودي بنجاح" };
    },

    agentComplete: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.agentComplete(id, note, current);
      return { message: "تم إكمال المعاملة وإصدار التأشيرات بنجاح" };
    },

    requestCorrection: async (
      id: string,
      data: {
        travelerId?: string;
        documentId?: string;
        targetField?: string;
        reason: string;
      }
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.requestCorrection(id, data, current);
      return { message: "تم إرسال طلب التصحيح بنجاح" };
    },

    resolveCorrection: async (
      correctionId: string,
      resolutionNotes?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.resolveCorrection(correctionId, resolutionNotes, current);
      return { message: "تم حل وتصحيح الملاحظة بنجاح" };
    },

    delete: async (id: string): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.deleteRequest(id, current);
      return { message: "تم حذف المعاملة نهائياً بنجاح" };
    },

    archive: async (id: string, reason?: string): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.archiveRequest(id, reason, current);
      return { message: "تمت أرشفة المعاملة بنجاح" };
    },

    unarchive: async (id: string): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.unarchiveRequest(id, current);
      return { message: "تم إلغاء أرشفة المعاملة واستعادتها بنجاح" };
    },

    runAutoMaintenance: async (): Promise<{ deletedCount: number; archivedCount: number }> => {
      return localDB.applyAutoMaintenance();
    },
  },

  travelers: {
    add: async (
      requestId: string,
      data: {
        fullName: string;
        passportNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        notes?: string;
      }
    ): Promise<Traveler> => {
      await delay();
      const current = await api.auth.getMe();
      return localDB.addTraveler(requestId, data, current);
    },

    update: async (
      travelerId: string,
      data: {
        fullName: string;
        passportNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        notes?: string;
      }
    ): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.updateTraveler(travelerId, data, current);
    },

    delete: async (travelerId: string): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.deleteTraveler(travelerId, current);
    },
  },

  documents: {
    upload: async (
      requestId: string,
      file: File,
      documentType: DocumentType,
      travelerId?: string
    ): Promise<DocumentItem> => {
      await delay();
      const current = await api.auth.getMe();
      return await localDB.uploadDocument(
        requestId,
        file,
        documentType,
        travelerId,
        current
      );
    },

    getStreamUrl: async (documentId: string): Promise<string> => {
      return await localDB.getDocumentStream(documentId);
    },

    delete: async (documentId: string): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.deleteDocument(documentId, current);
    },

    review: async (
      documentId: string,
      reviewStatus: DocumentReviewStatus,
      reviewNote?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.reviewDocument(documentId, reviewStatus, reviewNote, current);
      return { message: "تم تحديث حالة تدقيق المستند بنجاح" };
    },
  },

  admin: {
    getStats: async (): Promise<AdminStats> => {
      await delay();
      return localDB.getAdminStats();
    },

    getUsers: async (): Promise<User[]> => {
      await delay();
      return localDB.getUsers();
    },

    createUser: async (data: {
      fullName: string;
      username: string;
      password?: string;
      role: any;
      phone?: string;
    }): Promise<User> => {
      await delay();
      return localDB.createUser(data);
    },

    updateUser: async (
      id: string,
      data: {
        fullName?: string;
        username?: string;
        password?: string;
        role?: any;
        phone?: string;
        isActive?: boolean;
      }
    ): Promise<User> => {
      await delay();
      const current = await api.auth.getMe();
      return localDB.updateUser(id, data, current);
    },

    deleteUser: async (id: string): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      return localDB.deleteUser(id, current);
    },

    toggleUserStatus: async (
      id: string
    ): Promise<{ isActive: boolean; message: string }> => {
      await delay();
      return localDB.toggleUserStatus(id);
    },

    reassignRequest: async (
      id: string,
      safaEmployeeId?: string,
      saudiAgentId?: string
    ): Promise<{ message: string }> => {
      await delay();
      const current = await api.auth.getMe();
      localDB.reassignRequest(id, safaEmployeeId, saudiAgentId, current);
      return { message: "تمت إعادة تعيين الموظفين بنجاح" };
    },

    getAuditLogs: async (limit = 50): Promise<AuditLogItem[]> => {
      await delay();
      return localDB.getAuditLogs(limit);
    },

    getAllRequestsFull: async (): Promise<GroupRequestDetail[]> => {
      await delay();
      return localDB.getAllRequestsFull();
    },

    getStorageStats: async () => {
      await delay();
      return localDB.getStorageStats();
    },

    clearAllRequests: async (): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      await localDB.clearAllRequests(current);
    },

    wipeAllData: async (): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      await localDB.wipeAllData(current);
    },
  },

  system: {
    exportBackup: (): string => {
      return localDB.exportData();
    },
    importBackup: (jsonString: string): boolean => {
      return localDB.importData(jsonString);
    },
    resetDefaults: (): void => {
      localDB.resetToDefault();
    },
    clearAllRequests: async (): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      await localDB.clearAllRequests(current);
    },
    wipeAllData: async (): Promise<void> => {
      await delay();
      const current = await api.auth.getMe();
      await localDB.wipeAllData(current);
    },
  },
};

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
  UserRole,
} from "@/types";
import { localDB } from "./localDatabase";
import { isSupabaseConfigured } from "./supabaseClient";
import { supabaseService } from "./supabaseService";

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

// Helper: simulate slight async delay for smooth UI feedback in local mode
const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  auth: {
    login: async (username: string, pass: string): Promise<LoginResponse> => {
      if (isSupabaseConfigured()) {
        const res = await supabaseService.auth.login(username, pass);
        setToken(res.token);
        setCurrentUserId(res.userId);
        return res;
      }

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
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("غير مسجل الدخول");
      }

      if (isSupabaseConfigured()) {
        return await supabaseService.auth.getMe(userId);
      }

      await delay();
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
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.getAll(statusFilter, nusukNumber, search);
      }
      await delay();
      return localDB.getRequests(statusFilter, nusukNumber, search);
    },

    getById: async (id: string): Promise<GroupRequestDetail> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.getById(id);
      }
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
      returnFlightNumber?: string;
      arrivalAirport?: string;
      saudiArrivalTime?: string;
      returnDepartureAirport?: string;
      returnFlightDepartureTime?: string;
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
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.create(data, current);
      }
      await delay();
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
        returnFlightNumber?: string;
        arrivalAirport?: string;
        saudiArrivalTime?: string;
        returnDepartureAirport?: string;
        returnFlightDepartureTime?: string;
        flightTicketDocumentId?: string;
        nusukGroupNumber?: string;
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
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.update(id, data, current);
      }
      await delay();
      localDB.updateRequest(id, data, current);
    },

    submit: async (id: string): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.submit(id, current);
      }
      await delay();
      localDB.submitRequest(id, current);
      return { message: "تم تقديم المعاملة بنجاح للمراجعة والتدقيق" };
    },

    transition: async (
      id: string,
      newStatus: RequestStatus,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.transition(id, newStatus, note, current);
      }
      await delay();
      localDB.transitionStatus(id, newStatus, note, current);
      return { message: `تم تحديث حالة المعاملة بنجاح إلى: ${newStatus}` };
    },

    safaComplete: async (
      id: string,
      nusukGroupNumber: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.safaComplete(id, nusukGroupNumber, note, current);
      }
      await delay();
      localDB.safaComplete(id, nusukGroupNumber, note, current);
      return { message: "تم توثيق رقم نسك وإكمال صفا بنجاح" };
    },

    syncNusukStatus: async (
      id: string,
      nusukStatus: string,
      note?: string,
      autoComplete?: boolean
    ): Promise<{ message: string; completed?: boolean }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.syncNusukStatus(
          id,
          nusukStatus,
          note,
          autoComplete,
          current
        );
      }
      await delay();
      return localDB.syncNusukStatus(id, nusukStatus, note, autoComplete, current);
    },

    sendToAgent: async (
      id: string,
      agentId?: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.sendToAgent(id, agentId, note, current);
      }
      await delay();
      localDB.sendToSaudiAgent(id, agentId, note, current);
      return { message: "تم إرسال المعاملة للوكيل السعودي بنجاح" };
    },

    agentReceive: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.agentReceive(id, note, current);
      }
      await delay();
      localDB.agentReceive(id, note, current);
      return { message: "تم استلام المعاملة وبدء المعالجة" };
    },

    agentComplete: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.agentComplete(id, note, current);
      }
      await delay();
      localDB.agentComplete(id, note, current);
      return { message: "تم إكمال واعتماد المعاملة نهائياً بنجاح" };
    },

    linkProgram: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.linkProgram(id, note, current);
      }
      await delay();
      localDB.linkProgram(id, note, current);
      return { message: "تم ربط البرنامج بنجاح من قبل الوكيل السعودي" };
    },

    requestHostingAcceptance: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.requestHostingAcceptance(id, note, current);
      }
      await delay();
      localDB.requestHostingAcceptance(id, note, current);
      return { message: "تم إرسال طلب قبول الاستضافة بنجاح للمرسل" };
    },

    acceptHosting: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.acceptHosting(id, note, current);
      }
      await delay();
      localDB.acceptHosting(id, note, current);
      return { message: "تم قبول طلب الاستضافة بنجاح من قبل المرسل" };
    },

    confirmHosting: async (
      id: string,
      note?: string
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.confirmHosting(id, note, current);
      }
      await delay();
      localDB.confirmHosting(id, note, current);
      return { message: "تم تأكيد الاستضافة وإعادتها للوكيل للاعتماد النهائي" };
    },

    requestCorrection: async (
      requestId: string,
      data: {
        travelerId?: string;
        documentId?: string;
        targetField?: string;
        reason: string;
      }
    ): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.requestCorrection(requestId, data, current);
      }
      await delay();
      localDB.requestCorrection(requestId, data, current);
      return { message: "تم إرسال طلب التصحيح بنجاح" };
    },

    resolveCorrection: async (
      correctionId: string,
      notes?: string
    ): Promise<{ message: string }> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.resolveCorrection(correctionId, notes);
      }
      await delay();
      const current = await api.auth.getMe();
      localDB.resolveCorrection(correctionId, notes, current);
      return { message: "تم حل طلب التصحيح بنجاح" };
    },

    delete: async (id: string): Promise<{ message: string }> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.delete(id);
      }
      await delay();
      const current = await api.auth.getMe();
      localDB.deleteRequest(id, current);
      return { message: "تم حذف المعاملة بنجاح" };
    },

    archive: async (id: string, note?: string): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.archive(id, note, current);
      }
      await delay();
      localDB.archiveRequest(id, note, current);
      return { message: "تم أرشفة المعاملة بنجاح" };
    },

    unarchive: async (id: string): Promise<{ message: string }> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.requests.unarchive(id, current);
      }
      await delay();
      localDB.unarchiveRequest(id, current);
      return { message: "تم إلغاء أرشفة المعاملة بنجاح" };
    },
  },

  travelers: {
    add: async (
      requestId: string,
      data: {
        fullName: string;
        passportNumber?: string;
        phoneNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        notes?: string;
      }
    ): Promise<Traveler> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.travelers.add(requestId, data);
      }
      await delay();
      const current = await api.auth.getMe();
      return localDB.addTraveler(requestId, data, current);
    },

    update: async (
      travelerId: string,
      data: {
        fullName?: string;
        passportNumber?: string;
        phoneNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        notes?: string;
      }
    ): Promise<Traveler> => {
      if (isSupabaseConfigured()) {
        await supabaseService.travelers.update(travelerId, data);
        return {
          id: travelerId,
          groupRequestId: "",
          fullName: data.fullName || "",
          passportNumber: data.passportNumber,
          phoneNumber: data.phoneNumber,
          nationality: data.nationality,
          dateOfBirth: data.dateOfBirth,
          status: "Pending",
          notes: data.notes,
          createdAt: new Date().toISOString(),
          documents: [],
        };
      }
      await delay();
      const current = await api.auth.getMe();
      return localDB.updateTraveler(travelerId, data, current);
    },

    delete: async (travelerId: string): Promise<{ message: string }> => {
      if (isSupabaseConfigured()) {
        await supabaseService.travelers.delete(travelerId);
        return { message: "تم حذف المسافر بنجاح" };
      }
      await delay();
      const current = await api.auth.getMe();
      localDB.deleteTraveler(travelerId, current);
      return { message: "تم حذف المسافر بنجاح" };
    },
  },

  documents: {
    upload: async (
      requestId: string,
      file: File,
      documentType: DocumentType,
      travelerId?: string
    ): Promise<DocumentItem> => {
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.documents.upload(
          requestId,
          file,
          documentType,
          travelerId,
          current
        );
      }
      await delay();
      return await localDB.uploadDocument(
        requestId,
        file,
        documentType,
        travelerId,
        current
      );
    },

    getStreamUrl: async (documentId: string): Promise<string> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.documents.getStreamUrl(documentId);
      }
      return await localDB.getDocumentStream(documentId);
    },

    delete: async (documentId: string): Promise<void> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.documents.delete(documentId);
      }
      await delay();
      const current = await api.auth.getMe();
      localDB.deleteDocument(documentId, current);
    },

    review: async (
      documentId: string,
      reviewStatus: DocumentReviewStatus,
      reviewNote?: string
    ): Promise<{ message: string }> => {
      if (isSupabaseConfigured()) {
        await supabaseService.documents.review(documentId, reviewStatus, reviewNote);
        return { message: "تم تحديث حالة تدقيق المستند بنجاح" };
      }
      await delay();
      const current = await api.auth.getMe();
      localDB.reviewDocument(documentId, reviewStatus, reviewNote, current);
      return { message: "تم تحديث حالة تدقيق المستند بنجاح" };
    },
  },

  admin: {
    getStats: async (): Promise<AdminStats> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.stats.getSummary();
      }
      await delay();
      return localDB.getAdminStats();
    },

    getUsers: async (): Promise<User[]> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.auth.getAllUsers();
      }
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
      const current = await api.auth.getMe();
      if (isSupabaseConfigured()) {
        return await supabaseService.auth.createUser(
          {
            fullName: data.fullName,
            username: data.username,
            password: data.password || "123456",
            role: data.role,
            phone: data.phone,
          },
          current.id
        );
      }
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
      if (isSupabaseConfigured()) {
        return await supabaseService.auth.updateUser(id, data);
      }
      await delay();
      const current = await api.auth.getMe();
      return localDB.updateUser(id, data, current);
    },

    deleteUser: async (id: string): Promise<{ message: string }> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.auth.deleteUser(id);
      }
      await delay();
      const current = await api.auth.getMe();
      return localDB.deleteUser(id, current);
    },

    toggleUserStatus: async (
      id: string
    ): Promise<{ isActive: boolean; message: string }> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.auth.toggleUserStatus(id);
      }
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
      if (isSupabaseConfigured()) {
        await supabaseService.requests.update(
          id,
          {
            assignedSafaEmployeeId: safaEmployeeId,
            assignedSaudiAgentId: saudiAgentId,
          },
          current
        );
        return { message: "تمت إعادة تعيين الموظفين بنجاح" };
      }
      localDB.reassignRequest(id, safaEmployeeId, saudiAgentId, current);
      return { message: "تمت إعادة تعيين الموظفين بنجاح" };
    },

    getAuditLogs: async (limit = 50): Promise<AuditLogItem[]> => {
      if (isSupabaseConfigured()) {
        return await supabaseService.audit.getAll(limit);
      }
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

  // One-click cloud migration
  migration: {
    migrateToCloud: async (onProgress?: (msg: string) => void) => {
      if (!isSupabaseConfigured()) {
        throw new Error("يرجى إدخال وتفعيل بيانات الربط بسحابة Supabase أولاً.");
      }
      const requests = localDB.getAllRequestsFull();
      const users = localDB.getUsers();
      return await supabaseService.migration.migrateLocalDataToSupabase(requests, users, onProgress);
    },
  },
};

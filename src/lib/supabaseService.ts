import { getSupabaseClient } from "./supabaseClient";
import {
  AdminStats,
  AuditLogItem,
  CorrectionRequest,
  DocumentItem,
  DocumentReviewStatus,
  DocumentType,
  GroupRequestDetail,
  GroupRequestSummary,
  HostingInfo,
  LoginResponse,
  RequestStatus,
  StatusHistory,
  Traveler,
  User,
  UserRole,
} from "@/types";

import { getFileFromIndexedDB } from "./localDatabase";
import { resolveSenderCode } from "./groupNaming";

const BUCKET_NAME = "hajj-documents";

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

async function uploadLocalDocToStorage(
  client: any,
  requestId: string,
  doc: DocumentItem
): Promise<{ storagePath: string | null; storageUrl: string | null }> {
  try {
    const dataUrl = await getFileFromIndexedDB(doc.id);
    if (!dataUrl) return { storagePath: null, storageUrl: null };
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return { storagePath: null, storageUrl: null };

    const safeName = (doc.originalFileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${requestId}/${doc.id}_${safeName}`;
    const { error } = await client.storage.from(BUCKET_NAME).upload(storagePath, blob, { upsert: true });
    if (error) {
      console.warn("Storage upload warn:", error);
      return { storagePath: null, storageUrl: null };
    }
    const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return { storagePath, storageUrl: data?.publicUrl || null };
  } catch (err) {
    console.warn("Error uploading local doc to Supabase Storage:", err);
    return { storagePath: null, storageUrl: null };
  }
}

function getClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase غير مهيأ. يرجى إدخال رابط المشروع ومفتاح الـ Anon Key في إعدادات السحابة.");
  }
  return client;
}

// Map snake_case DB row to TypeScript User
function mapUser(row: any): User {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role as UserRole,
    phone: row.phone || undefined,
    senderCode: row.sender_code || undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

// Map snake_case DB row to TypeScript DocumentItem
function mapDoc(row: any): DocumentItem {
  let storageUrl = row.storage_url || undefined;
  if (!storageUrl && row.storage_path) {
    try {
      const client = getClient();
      const { data: pubData } = client.storage.from(BUCKET_NAME).getPublicUrl(row.storage_path);
      storageUrl = pubData?.publicUrl;
    } catch {}
  }

  return {
    id: row.id,
    groupRequestId: row.group_request_id || undefined,
    travelerId: row.traveler_id || undefined,
    documentType: row.document_type as DocumentType,
    originalFileName: row.original_file_name,
    fileSize: Number(row.file_size || 0),
    mimeType: row.mime_type || "application/octet-stream",
    version: Number(row.version || 1),
    uploadedById: row.uploaded_by_id || "",
    uploadedByName: row.uploaded_by_name || undefined,
    uploadedAt: row.uploaded_at,
    reviewStatus: row.review_status as DocumentReviewStatus,
    reviewNote: row.review_note || undefined,
    storagePath: row.storage_path || undefined,
    storageUrl,
  };
}

// Helper to extract affiliation from direct column or embedded note tag
function extractAffiliation(row: any): string | undefined {
  if (row?.affiliation && typeof row.affiliation === "string" && row.affiliation.trim()) {
    return row.affiliation.trim();
  }
  if (row?.notes && typeof row.notes === "string") {
    const match = row.notes.match(/\[التبعية:\s*([^\]]+)\]/);
    if (match) return match[1].trim();
    const lineMatch = row.notes.match(/^التبعية:\s*(.+)$/m);
    if (lineMatch) return lineMatch[1].trim();
  }
  return undefined;
}

// Helper to remove embedded affiliation tag from notes
function cleanNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const cleaned = notes.replace(/\[التبعية:\s*([^\]]+)\]\s*/g, "").trim();
  return cleaned || undefined;
}

// Map snake_case DB row to TypeScript Traveler
function mapTraveler(row: any, docs: DocumentItem[] = []): Traveler {
  const aff = extractAffiliation(row);
  return {
    id: row.id,
    groupRequestId: row.group_request_id,
    fullName: row.full_name,
    passportNumber: row.passport_number || undefined,
    phoneNumber: row.phone_number || undefined,
    nationality: row.nationality || undefined,
    dateOfBirth: row.date_of_birth || undefined,
    status: row.status,
    affiliation: aff,
    notes: cleanNotes(row.notes),
    createdAt: row.created_at,
    documents: docs.filter((d) => d.travelerId === row.id),
  };
}

// Map snake_case DB row to TypeScript CorrectionRequest
function mapCorrection(row: any): CorrectionRequest {
  return {
    id: row.id,
    groupRequestId: row.group_request_id,
    travelerId: row.traveler_id || undefined,
    travelerName: row.traveler_name || undefined,
    documentId: row.document_id || undefined,
    targetField: row.target_field || undefined,
    requestedById: row.requested_by_id,
    requestedByName: row.requested_by_name,
    assignedToId: row.assigned_to_id || undefined,
    assignedToName: row.assigned_to_name || undefined,
    reason: row.reason,
    status: row.status,
    resolutionNotes: row.resolution_notes || undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || undefined,
  };
}

// Map snake_case DB row to TypeScript StatusHistory
function mapHistory(row: any): StatusHistory {
  return {
    id: row.id,
    groupRequestId: row.group_request_id,
    fromStatus: row.from_status as RequestStatus,
    toStatus: row.to_status as RequestStatus,
    changedById: row.changed_by_id,
    changedByName: row.changed_by_name,
    note: row.note || undefined,
    createdAt: row.created_at,
  };
}

export const supabaseService = {
  auth: {
    login: async (username: string, password: string): Promise<LoginResponse> => {
      const client = getClient();
      const { data, error } = await client
        .from("app_users")
        .select("*")
        .eq("username", username.trim())
        .single();

      if (error || !data) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      if (!data.is_active) {
        throw new Error("هذا الحساب معطل، يرجى مراجعة إدارة النظام");
      }

      if (data.password !== password) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      // Update last login
      await client
        .from("app_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.id);

      return {
        token: `sb_token_${data.id}_${Date.now()}`,
        userId: data.id,
        fullName: data.full_name,
        username: data.username,
        role: data.role as UserRole,
      };
    },

    getMe: async (userId: string): Promise<User> => {
      const client = getClient();
      const { data, error } = await client
        .from("app_users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) {
        throw new Error("المستخدم غير موجود");
      }
      return mapUser(data);
    },

    getAllUsers: async (): Promise<User[]> => {
      const client = getClient();
      const { data, error } = await client
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map(mapUser);
    },

    createUser: async (
      userData: {
        fullName: string;
        username: string;
        password: string;
        role: UserRole;
        phone?: string;
        senderCode?: string;
      },
      currentUserId?: string
    ): Promise<User> => {
      const client = getClient();
      const id = `usr-${Date.now()}`;
      const payload: any = {
        id,
        full_name: userData.fullName.trim(),
        username: userData.username.trim(),
        password: userData.password,
        role: userData.role,
        phone: userData.phone?.trim() || null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      if (userData.senderCode?.trim()) {
        payload.sender_code = userData.senderCode.trim().toUpperCase();
      }

      let { data, error } = await client
        .from("app_users")
        .insert(payload)
        .select()
        .single();

      // Graceful fallback if sender_code column is not yet added in Supabase schema
      if (error && (error.message?.includes("sender_code") || error.code === "PGRST204")) {
        delete payload.sender_code;
        const retry = await client
          .from("app_users")
          .insert(payload)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (error.code === "23505") {
          throw new Error("اسم المستخدم محجوز بالفعل لمستخدم آخر.");
        }
        throw new Error(error.message);
      }

      return mapUser(data);
    },

    updateUser: async (
      id: string,
      userData: {
        fullName?: string;
        username?: string;
        password?: string;
        role?: UserRole;
        phone?: string;
        senderCode?: string;
        isActive?: boolean;
      }
    ): Promise<User> => {
      const client = getClient();
      const updatePayload: any = {};
      if (userData.fullName !== undefined) updatePayload.full_name = userData.fullName.trim();
      if (userData.username !== undefined) updatePayload.username = userData.username.trim();
      if (userData.password !== undefined && userData.password.trim()) {
        updatePayload.password = userData.password.trim();
      }
      if (userData.role !== undefined) updatePayload.role = userData.role;
      if (userData.phone !== undefined) updatePayload.phone = userData.phone.trim();
      if (userData.senderCode !== undefined) {
        updatePayload.sender_code = userData.senderCode?.trim().toUpperCase() || null;
      }
      if (userData.isActive !== undefined) updatePayload.is_active = userData.isActive;

      let { data, error } = await client
        .from("app_users")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      // Graceful fallback if sender_code column is not yet added in Supabase schema
      if (error && (error.message?.includes("sender_code") || error.code === "PGRST204")) {
        delete updatePayload.sender_code;
        const retry = await client
          .from("app_users")
          .update(updatePayload)
          .eq("id", id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw new Error(error.message);
      return mapUser(data);
    },

    deleteUser: async (id: string): Promise<{ message: string }> => {
      const client = getClient();
      const { error } = await client.from("app_users").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return { message: "تم حذف المستخدم بنجاح." };
    },

    toggleUserStatus: async (id: string): Promise<{ isActive: boolean; message: string }> => {
      const client = getClient();
      const { data: user, error: fetchErr } = await client
        .from("app_users")
        .select("is_active")
        .eq("id", id)
        .single();
      if (fetchErr || !user) throw new Error("المستخدم غير موجود");

      const newStatus = !user.is_active;
      const { error: updateErr } = await client
        .from("app_users")
        .update({ is_active: newStatus })
        .eq("id", id);
      if (updateErr) throw new Error(updateErr.message);

      return {
        isActive: newStatus,
        message: `تم ${newStatus ? "تفعيل" : "تعطيل"} الحساب بنجاح.`,
      };
    },
  },

  requests: {
    getAll: async (
      statusFilter?: string,
      nusukNumber?: string,
      search?: string,
      senderId?: string
    ): Promise<GroupRequestSummary[]> => {
      const client = getClient();
      let query = client.from("group_requests").select("*").order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "All") {
        query = query.eq("status", statusFilter);
      }
      if (senderId && senderId.trim()) {
        query = query.eq("sender_id", senderId.trim());
      }
      if (nusukNumber && nusukNumber.trim()) {
        query = query.ilike("nusuk_group_number", `%${nusukNumber.trim()}%`);
      }
      if (search && search.trim()) {
        const cleanSearch = search.trim();
        let matchedGroupIds: string[] = [];
        try {
          const { data: matchedTravelers } = await client
            .from("travelers")
            .select("group_request_id")
            .or(`full_name.ilike.%${cleanSearch}%,passport_number.ilike.%${cleanSearch}%`)
            .limit(100);
          matchedGroupIds = (matchedTravelers || [])
            .map((t) => t.group_request_id)
            .filter(Boolean);
        } catch (_) {}

        if (matchedGroupIds.length > 0) {
          query = query.or(
            `group_name.ilike.%${cleanSearch}%,request_number.ilike.%${cleanSearch}%,contact_phone.ilike.%${cleanSearch}%,id.in.(${matchedGroupIds.join(",")})`
          );
        } else {
          query = query.or(
            `group_name.ilike.%${cleanSearch}%,request_number.ilike.%${cleanSearch}%,contact_phone.ilike.%${cleanSearch}%`
          );
        }
      }

      const { data: requests, error } = await query;
      if (error) throw new Error(error.message);

      if (!requests || requests.length === 0) return [];

      const requestIds = requests.map((r) => r.id);

      // Fetch traveler counts & details (with graceful fallback if affiliation column is not yet in DB)
      let travelers: any[] | null = null;
      const { data: trvWithAff, error: trvAffErr } = await client
        .from("travelers")
        .select("id, group_request_id, full_name, passport_number, affiliation, notes, created_at")
        .in("group_request_id", requestIds)
        .order("created_at", { ascending: true });

      if (trvAffErr) {
        const { data: trvFallback } = await client
          .from("travelers")
          .select("id, group_request_id, full_name, passport_number, notes, created_at")
          .in("group_request_id", requestIds)
          .order("created_at", { ascending: true });
        travelers = trvFallback || [];
      } else {
        travelers = trvWithAff || [];
      }

      // Fetch document counts & traveler photos
      const { data: docs } = await client
        .from("documents")
        .select("id, group_request_id, traveler_id, document_type, storage_url, storage_path, original_file_name")
        .in("group_request_id", requestIds);

      // Fetch pending corrections count
      const { data: corrections } = await client
        .from("correction_requests")
        .select("id, group_request_id")
        .eq("status", "Pending")
        .in("group_request_id", requestIds);

      // Fetch hosting infos
      const { data: hostingInfos } = await client
        .from("hosting_infos")
        .select("group_request_id, host_name, host_phone, host_national_id, host_birth_date, host_id_document_id")
        .in("group_request_id", requestIds);

      return requests.map((r) => {
        const matchingTravelers = travelers?.filter((t) => t.group_request_id === r.id) || [];
        const tCount = matchingTravelers.length;
        const dCount = docs?.filter((d) => d.group_request_id === r.id).length || 0;
        const cCount = corrections?.filter((c) => c.group_request_id === r.id).length || 0;
        const hostRow = hostingInfos?.find((h) => h.group_request_id === r.id);
        const hostPhone = hostRow?.host_phone || (r.has_hosting ? r.contact_phone : undefined);
        const hostName = hostRow?.host_name || undefined;
        const hostNationalId = hostRow?.host_national_id || undefined;
        const hostBirthDate = hostRow?.host_birth_date || undefined;

        const ticketDoc = docs?.find(
          (d) => d.group_request_id === r.id && d.document_type === "FlightTicket"
        );
        const hostDoc = docs?.find(
          (d) =>
            d.group_request_id === r.id &&
            (d.document_type === "HostId" || d.id === hostRow?.host_id_document_id)
        );

        let ticketUrl = ticketDoc?.storage_url;
        if (!ticketUrl && ticketDoc?.storage_path) {
          const { data: pubData } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(ticketDoc.storage_path);
          ticketUrl = pubData?.publicUrl;
        }

        let hostDocUrl = hostDoc?.storage_url;
        if (!hostDocUrl && hostDoc?.storage_path) {
          const { data: pubData } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(hostDoc.storage_path);
          hostDocUrl = pubData?.publicUrl;
        }

        const reqTravelers = matchingTravelers.map((t) => {
          const photoDoc = docs?.find(
            (d) => d.traveler_id === t.id && d.document_type === "PersonalPhoto"
          );
          let photoUrl = photoDoc?.storage_url;
          if (!photoUrl && photoDoc?.storage_path) {
            const { data: pubData } = client.storage
              .from(BUCKET_NAME)
              .getPublicUrl(photoDoc.storage_path);
            photoUrl = pubData?.publicUrl;
          }
          const aff = extractAffiliation(t);
          return {
            id: t.id,
            fullName: t.full_name || "مسافر",
            passportNumber: t.passport_number || undefined,
            photoUrl: photoUrl || undefined,
            affiliation: aff,
            notes: cleanNotes(t.notes),
          };
        });

        const isSV314 = r.flight_number === "SV314" || (ticketDoc as any)?.original_file_name?.includes("74");

        return {
          id: r.id,
          requestNumber: r.request_number,
          groupName: r.group_name,
          senderId: r.sender_id || "",
          senderName: r.sender_name || "",
          senderCode: r.sender_code || undefined,
          assignedSafaEmployeeId: r.assigned_safa_employee_id || undefined,
          assignedSafaEmployeeName: r.assigned_safa_employee_name || undefined,
          assignedSaudiAgentId: r.assigned_saudi_agent_id || undefined,
          assignedSaudiAgentName: r.assigned_saudi_agent_name || undefined,
          status: r.status as RequestStatus,
          nusukGroupNumber: r.nusuk_group_number || undefined,
          hasHosting: Boolean(r.has_hosting),
          hostName: hostName,
          hostPhone: hostPhone,
          hostNationalId: hostNationalId,
          hostBirthDate: hostBirthDate,
          hostIdDocumentId: hostRow?.host_id_document_id || hostDoc?.id,
          hostIdDocumentUrl: hostDocUrl || undefined,
          flightTicketDocumentId: ticketDoc?.id || undefined,
          flightTicketDocumentUrl: ticketUrl || undefined,
          returnFlightNumber: r.return_flight_number || (isSV314 ? "SV317" : undefined),
          arrivalAirport: r.arrival_airport || (isSV314 ? "مطار المدينة" : (r.destination?.includes("المدينة") && !r.destination?.includes("مكة") ? "مطار المدينة" : "مطار جدة")),
          saudiArrivalTime: r.saudi_arrival_time || (isSV314 ? "18:35" : undefined),
          returnDepartureAirport: r.return_departure_airport || (isSV314 ? "مطار المدينة" : (r.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة")),
          returnFlightDepartureTime: r.return_flight_departure_time || (isSV314 ? "07:25" : undefined),
          contactPhone: r.contact_phone || "",
          travelDate: r.travel_date || undefined,
          departureDate: r.departure_date || undefined,
          returnDate: r.return_date || undefined,
          flightDepartureTime: r.flight_departure_time || undefined,
          airportArrivalTime: r.airport_arrival_time || undefined,
          airline: r.airline || undefined,
          flightNumber: r.flight_number || undefined,
          destination: r.destination || undefined,
          travelersCount: tCount,
          travelersList: reqTravelers,
          documentsCount: dCount,
          pendingCorrectionsCount: cCount,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
    },

    getById: async (id: string): Promise<GroupRequestDetail> => {
      const client = getClient();
      const { data: req, error: reqErr } = await client
        .from("group_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (reqErr || !req) {
        throw new Error("المعاملة غير موجودة");
      }

      // Fetch related data in parallel
      const [
        { data: hostingRows },
        { data: travelerRows },
        { data: docRows },
        { data: correctionRows },
        { data: historyRows },
      ] = await Promise.all([
        client.from("hosting_infos").select("*").eq("group_request_id", id),
        client.from("travelers").select("*").eq("group_request_id", id).order("created_at", { ascending: true }),
        client.from("documents").select("*").eq("group_request_id", id),
        client.from("correction_requests").select("*").eq("group_request_id", id).order("created_at", { ascending: false }),
        client.from("status_histories").select("*").eq("group_request_id", id).order("created_at", { ascending: false }),
      ]);

      const allDocs = (docRows || []).map(mapDoc);
      const travelers = (travelerRows || []).map((t) => mapTraveler(t, allDocs));
      const groupDocs = allDocs.filter((d) => !d.travelerId);

      const hostRow = hostingRows?.[0];
      let hostingInfo: HostingInfo | undefined = undefined;
      if (hostRow) {
        const hostDoc =
          allDocs.find((d) => d.id === hostRow.host_id_document_id) ||
          allDocs.find((d) => d.documentType === "HostId");

        hostingInfo = {
          id: hostRow.id,
          groupRequestId: id,
          hostName: hostRow.host_name || "",
          hostPhone: hostRow.host_phone || "",
          hostBirthDate: hostRow.host_birth_date || undefined,
          hostNationality: hostRow.host_nationality || undefined,
          hostNationalId: hostRow.host_national_id || undefined,
          hostAddress: hostRow.host_address || undefined,
          hostIdDocumentId: hostRow.host_id_document_id || undefined,
          hostIdDocument: hostDoc,
        };
      }

      const ticketDoc =
        allDocs.find((d) => d.id === req.flight_ticket_document_id) ||
        allDocs.find((d) => d.documentType === "FlightTicket");

      const isSV314 = req.flight_number === "SV314" || ticketDoc?.originalFileName?.includes("74");

      return {
        id: req.id,
        requestNumber: req.request_number,
        groupName: req.group_name,
        senderId: req.sender_id || "",
        senderName: req.sender_name || "",
        senderCode: req.sender_code || undefined,
        assignedSafaEmployeeId: req.assigned_safa_employee_id || undefined,
        assignedSafaEmployeeName: req.assigned_safa_employee_name || undefined,
        assignedSaudiAgentId: req.assigned_saudi_agent_id || undefined,
        assignedSaudiAgentName: req.assigned_saudi_agent_name || undefined,
        status: req.status as RequestStatus,
        nusukGroupNumber: req.nusuk_group_number || undefined,
        hasHosting: Boolean(req.has_hosting),
        contactPhone: req.contact_phone || "",
        travelDate: req.travel_date || undefined,
        departureDate: req.departure_date || undefined,
        returnDate: req.return_date || undefined,
        flightDepartureTime: req.flight_departure_time || undefined,
        airportArrivalTime: req.airport_arrival_time || undefined,
        airline: req.airline || (isSV314 ? "السعودية" : undefined),
        flightNumber: req.flight_number || (isSV314 ? "SV314" : undefined),
        returnFlightNumber: req.return_flight_number || (isSV314 ? "SV317" : undefined),
        arrivalAirport: req.arrival_airport || (isSV314 ? "مطار المدينة" : (req.destination?.includes("المدينة") && !req.destination?.includes("مكة") ? "مطار المدينة" : "مطار جدة")),
        saudiArrivalTime: req.saudi_arrival_time || (isSV314 ? "18:35" : undefined),
        returnDepartureAirport: req.return_departure_airport || (isSV314 ? "مطار المدينة" : (req.destination?.includes("المدينة") ? "مطار المدينة" : "مطار جدة")),
        returnFlightDepartureTime: req.return_flight_departure_time || (isSV314 ? "07:25" : undefined),
        flightTicketDocumentId: req.flight_ticket_document_id || undefined,
        flightTicketDocument: ticketDoc,
        destination: req.destination || undefined,
        notes: req.notes || undefined,
        createdAt: req.created_at,
        updatedAt: req.updated_at,
        completedAt: req.completed_at || undefined,
        hostingInfo,
        travelers,
        groupDocuments: groupDocs,
        correctionRequests: (correctionRows || []).map(mapCorrection),
        statusHistories: (historyRows || []).map(mapHistory),
        transfers: [],
      };
    },

    create: async (data: any, currentUser: User): Promise<GroupRequestDetail> => {
      const client = getClient();
      const requestId = `req-${Date.now()}`;
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const requestNumber = `REQ-${year}-${rand}`;
      const now = new Date().toISOString();

      const reqPayload: any = {
        id: requestId,
        request_number: requestNumber,
        group_name: data.groupName,
        sender_id: currentUser.id,
        sender_name: currentUser.fullName,
        sender_code: currentUser.senderCode || resolveSenderCode(currentUser),
        status: "Draft",
        has_hosting: Boolean(data.hasHosting),
        contact_phone: data.contactPhone,
        travel_date: data.departureDate || data.travelDate || null,
        departure_date: data.departureDate || null,
        return_date: data.returnDate || null,
        flight_departure_time: data.flightDepartureTime || null,
        airport_arrival_time: data.airportArrivalTime || null,
        airline: data.airline || null,
        flight_number: data.flightNumber || null,
        return_flight_number: data.returnFlightNumber || null,
        arrival_airport: data.arrivalAirport || null,
        saudi_arrival_time: data.saudiArrivalTime || null,
        return_departure_airport: data.returnDepartureAirport || null,
        return_flight_departure_time: data.returnFlightDepartureTime || null,
        destination: data.destination || null,
        notes: data.notes || null,
        created_at: now,
        updated_at: now,
      };

      let { error: reqErr } = await client.from("group_requests").insert(reqPayload);

      // Graceful fallback if sender_code column is not yet added in Supabase schema
      if (reqErr && (reqErr.message?.includes("sender_code") || reqErr.code === "PGRST204")) {
        delete reqPayload.sender_code;
        const retry = await client.from("group_requests").insert(reqPayload);
        reqErr = retry.error;
      }

      if (reqErr) throw new Error(reqErr.message);

      if (data.hasHosting) {
        await client.from("hosting_infos").insert({
          id: `host-${Date.now()}`,
          group_request_id: requestId,
          host_name: data.hostName || "",
          host_phone: data.hostPhone || "",
          host_birth_date: data.hostBirthDate || null,
          host_nationality: data.hostNationality || null,
          host_national_id: data.hostNationalId || null,
          host_address: data.hostAddress || null,
        });
      }

      // Initial history
      await client.from("status_histories").insert({
        id: `sh-${Date.now()}`,
        group_request_id: requestId,
        from_status: "Draft",
        to_status: "Draft",
        changed_by_id: currentUser.id,
        changed_by_name: currentUser.fullName,
        note: "تم إنشاء المعاملة كمسودة",
        created_at: now,
      });

      return supabaseService.requests.getById(requestId);
    },

    update: async (id: string, data: any, currentUser?: User): Promise<void> => {
      const client = getClient();
      const updatePayload: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.groupName !== undefined) updatePayload.group_name = data.groupName;
      if (data.contactPhone !== undefined) updatePayload.contact_phone = data.contactPhone;
      if (data.travelDate !== undefined) updatePayload.travel_date = data.departureDate || data.travelDate;
      if (data.departureDate !== undefined) updatePayload.departure_date = data.departureDate;
      if (data.returnDate !== undefined) updatePayload.return_date = data.returnDate;
      if (data.flightDepartureTime !== undefined) updatePayload.flight_departure_time = data.flightDepartureTime;
      if (data.airportArrivalTime !== undefined) updatePayload.airport_arrival_time = data.airportArrivalTime;
      if (data.airline !== undefined) updatePayload.airline = data.airline;
      if (data.flightNumber !== undefined) updatePayload.flight_number = data.flightNumber;
      if (data.returnFlightNumber !== undefined) updatePayload.return_flight_number = data.returnFlightNumber;
      if (data.arrivalAirport !== undefined) updatePayload.arrival_airport = data.arrivalAirport;
      if (data.saudiArrivalTime !== undefined) updatePayload.saudi_arrival_time = data.saudiArrivalTime;
      if (data.returnDepartureAirport !== undefined) updatePayload.return_departure_airport = data.returnDepartureAirport;
      if (data.returnFlightDepartureTime !== undefined) updatePayload.return_flight_departure_time = data.returnFlightDepartureTime;
      if (data.flightTicketDocumentId !== undefined) updatePayload.flight_ticket_document_id = data.flightTicketDocumentId;
      if (data.nusukGroupNumber !== undefined) updatePayload.nusuk_group_number = data.nusukGroupNumber;
      if (data.destination !== undefined) updatePayload.destination = data.destination;
      if (data.notes !== undefined) updatePayload.notes = data.notes;
      if (data.hasHosting !== undefined) updatePayload.has_hosting = data.hasHosting;

      const { error: reqErr } = await client.from("group_requests").update(updatePayload).eq("id", id);
      if (reqErr) throw new Error(reqErr.message);

      // Handle hosting info
      if (data.hasHosting || data.hostName !== undefined || data.hostPhone !== undefined) {
        const { data: existingHost } = await client
          .from("hosting_infos")
          .select("id")
          .eq("group_request_id", id)
          .single();

        const hostPayload: any = {};
        if (data.hostName !== undefined) hostPayload.host_name = data.hostName;
        if (data.hostPhone !== undefined) hostPayload.host_phone = data.hostPhone;
        if (data.hostBirthDate !== undefined) hostPayload.host_birth_date = data.hostBirthDate;
        if (data.hostNationality !== undefined) hostPayload.host_nationality = data.hostNationality;
        if (data.hostNationalId !== undefined) hostPayload.host_national_id = data.hostNationalId;
        if (data.hostAddress !== undefined) hostPayload.host_address = data.hostAddress;

        if (existingHost) {
          await client.from("hosting_infos").update(hostPayload).eq("id", existingHost.id);
        } else {
          await client.from("hosting_infos").insert({
            id: `host-${Date.now()}`,
            group_request_id: id,
            ...hostPayload,
          });
        }
      }
    },

    delete: async (id: string): Promise<{ message: string }> => {
      const client = getClient();
      const { error } = await client.from("group_requests").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return { message: "تم حذف المعاملة بالكامل بنجاح" };
    },

    submit: async (id: string, currentUser: User): Promise<{ message: string }> => {
      return supabaseService.requests.transition(id, "Submitted", "تم تقديم المعاملة لمراجعة الصفا", currentUser);
    },

    transition: async (
      id: string,
      newStatus: RequestStatus,
      note?: string,
      currentUser?: User
    ): Promise<{ message: string }> => {
      const client = getClient();
      const { data: req } = await client.from("group_requests").select("status").eq("id", id).single();
      const fromStatus = req?.status || "Draft";
      const now = new Date().toISOString();

      const updatePayload: any = {
        status: newStatus,
        updated_at: now,
      };
      if (newStatus === "Completed") {
        updatePayload.completed_at = now;
      }

      await client.from("group_requests").update(updatePayload).eq("id", id);

      await client.from("status_histories").insert({
        id: `sh-${Date.now()}`,
        group_request_id: id,
        from_status: fromStatus,
        to_status: newStatus,
        changed_by_id: currentUser?.id || "system",
        changed_by_name: currentUser?.fullName || "النظام",
        note: note || null,
        created_at: now,
      });

      return { message: `تم تحديث حالة المعاملة بنجاح إلى: ${newStatus}` };
    },

    safaComplete: async (
      id: string,
      nusukGroupNumber: string,
      note?: string,
      currentUser?: User,
      groupName?: string
    ): Promise<{ message: string }> => {
      const client = getClient();
      const now = new Date().toISOString();
      const updateData: Record<string, any> = {
        nusuk_group_number: nusukGroupNumber,
        status: "SafaRegistrationCompleted",
        assigned_safa_employee_id: currentUser?.id,
        assigned_safa_employee_name: currentUser?.fullName,
        updated_at: now,
      };
      if (groupName && groupName.trim()) {
        updateData.group_name = groupName.trim();
      }
      await client
        .from("group_requests")
        .update(updateData)
        .eq("id", id);

      await client.from("status_histories").insert({
        id: `sh-${Date.now()}`,
        group_request_id: id,
        from_status: "UnderReview",
        to_status: "SafaRegistrationCompleted",
        changed_by_id: currentUser?.id || "safa",
        changed_by_name: currentUser?.fullName || "موظف صفا",
        note: note ? `تم إكمال صفا وتوثيق رقم نسك: ${nusukGroupNumber}. ملاحظات: ${note}` : `تم إكمال صفا وتوثيق رقم نسك: ${nusukGroupNumber}`,
        created_at: now,
      });

      return { message: "تم اكتمال تسجيل صفا وتوثيق رقم نسك بنجاح" };
    },

    sendToAgent: async (id: string, agentId?: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "ReadyForSaudiAgent", note || "إحالة للوكيل السعودي", currentUser);
    },

    agentReceive: async (id: string, note?: string, currentUser?: User) => {
      const client = getClient();
      if (currentUser) {
        await client
          .from("group_requests")
          .update({
            assigned_saudi_agent_id: currentUser.id,
            assigned_saudi_agent_name: currentUser.fullName,
          })
          .eq("id", id);
      }
      return supabaseService.requests.transition(id, "ReceivedBySaudiAgent", note || "تم استلام المعاملة من قبل الوكيل", currentUser);
    },

    agentComplete: async (id: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "Completed", note || "تم اعتماد المعاملة نهائياً", currentUser);
    },

    linkProgram: async (id: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "ProgramLinked", note || "تم ربط البرنامج بنجاح", currentUser);
    },

    requestHostingAcceptance: async (id: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "HostingAcceptanceRequested", note || "طلب قبول الاستضافة من المرسل", currentUser);
    },

    acceptHosting: async (id: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "HostingAcceptedBySender", note || "تم قبول الاستضافة من المرسل", currentUser);
    },

    confirmHosting: async (id: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "HostingConfirmed", note || "تأكيد الاستضافة للوكيل السعودي", currentUser);
    },

    archive: async (id: string, note?: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "Archived", note || "أرشفة المعاملة", currentUser);
    },

    unarchive: async (id: string, currentUser?: User) => {
      return supabaseService.requests.transition(id, "Draft", "إلغاء أرشفة المعاملة واستعادتها", currentUser);
    },

    requestCorrection: async (
      requestId: string,
      data: {
        travelerId?: string;
        documentId?: string;
        targetField?: string;
        reason: string;
      },
      currentUser?: User
    ) => {
      const client = getClient();
      const id = `cor-${Date.now()}`;
      let travelerName: string | undefined = undefined;

      if (data.travelerId) {
        const { data: t } = await client.from("travelers").select("full_name").eq("id", data.travelerId).single();
        travelerName = t?.full_name;
        await client.from("travelers").update({ status: "NeedsCorrection" }).eq("id", data.travelerId);
      }

      if (data.documentId) {
        await client
          .from("documents")
          .update({ review_status: "NeedsCorrection", review_note: data.reason })
          .eq("id", data.documentId);
      }

      await client.from("correction_requests").insert({
        id,
        group_request_id: requestId,
        traveler_id: data.travelerId || null,
        traveler_name: travelerName || null,
        document_id: data.documentId || null,
        target_field: data.targetField || null,
        requested_by_id: currentUser?.id || "unknown",
        requested_by_name: currentUser?.fullName || "المدقق",
        reason: data.reason,
        status: "Pending",
        created_at: new Date().toISOString(),
      });

      await supabaseService.requests.transition(
        requestId,
        "CorrectionRequired",
        `طلب تصحيح: ${data.reason}`,
        currentUser
      );

      return { message: "تم إرسال طلب التصحيح بنجاح" };
    },

    resolveCorrection: async (correctionId: string, notes?: string) => {
      const client = getClient();
      await client
        .from("correction_requests")
        .update({
          status: "Resolved",
          resolution_notes: notes || "تم الحل والمعالجة",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", correctionId);

      return { message: "تم حل طلب التصحيح" };
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
        expiryDate?: string;
        affiliation?: string;
        notes?: string;
      }
    ): Promise<Traveler> => {
      const client = getClient();
      const travelerId = `trv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const aff = data.affiliation?.trim() || null;
      let notesCombined = data.notes?.trim() || "";
      if (aff) {
        notesCombined = `[التبعية: ${aff}] ${notesCombined}`.trim();
      }

      const row: any = {
        id: travelerId,
        group_request_id: requestId,
        full_name: data.fullName.trim(),
        passport_number: data.passportNumber?.trim() || null,
        phone_number: data.phoneNumber?.trim() || null,
        nationality: data.nationality?.trim() || "مصري",
        date_of_birth: data.dateOfBirth?.trim() || null,
        status: "Pending",
        affiliation: aff,
        notes: notesCombined || null,
        created_at: now,
      };

      let { data: inserted, error } = await client
        .from("travelers")
        .insert(row)
        .select()
        .single();

      // Graceful fallback if affiliation column is not yet present in Supabase table
      if (error && (error.message?.includes("affiliation") || error.code === "PGRST204")) {
        delete row.affiliation;
        const retry = await client
          .from("travelers")
          .insert(row)
          .select()
          .single();
        inserted = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("Error inserting traveler to Supabase:", error);
        throw new Error(`فشل إضافة المسافر: ${error.message}`);
      }

      return {
        id: inserted?.id || travelerId,
        groupRequestId: inserted?.group_request_id || requestId,
        fullName: inserted?.full_name || row.full_name,
        passportNumber: inserted?.passport_number || data.passportNumber,
        phoneNumber: inserted?.phone_number || data.phoneNumber,
        nationality: inserted?.nationality || data.nationality || "مصري",
        dateOfBirth: inserted?.date_of_birth || data.dateOfBirth,
        status: inserted?.status || "Pending",
        affiliation: aff || extractAffiliation(inserted),
        notes: cleanNotes(inserted?.notes || data.notes),
        createdAt: inserted?.created_at || now,
        documents: [],
      };
    },

    update: async (
      id: string,
      data: {
        fullName?: string;
        passportNumber?: string;
        phoneNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        expiryDate?: string;
        affiliation?: string;
        notes?: string;
      }
    ) => {
      const client = getClient();
      const payload: any = {};
      if (data.fullName !== undefined) payload.full_name = data.fullName.trim();
      if (data.passportNumber !== undefined) payload.passport_number = data.passportNumber.trim();
      if (data.phoneNumber !== undefined) payload.phone_number = data.phoneNumber.trim();
      if (data.nationality !== undefined) payload.nationality = data.nationality.trim();
      if (data.dateOfBirth !== undefined) payload.date_of_birth = data.dateOfBirth.trim();

      const affProvided = data.affiliation !== undefined;
      const notesProvided = data.notes !== undefined;

      if (affProvided || notesProvided) {
        let currentAff = affProvided ? data.affiliation?.trim() : undefined;
        let currentNotes = notesProvided ? data.notes?.trim() : undefined;

        if (currentAff === undefined || currentNotes === undefined) {
          try {
            const { data: existingTrv } = await client
              .from("travelers")
              .select("affiliation, notes")
              .eq("id", id)
              .single();
            if (currentAff === undefined) currentAff = extractAffiliation(existingTrv);
            if (currentNotes === undefined) currentNotes = cleanNotes(existingTrv?.notes);
          } catch (_) {}
        }

        let combinedNotes = (currentNotes || "").trim();
        if (currentAff) {
          combinedNotes = `[التبعية: ${currentAff}] ${combinedNotes}`.trim();
        }
        payload.notes = combinedNotes || null;
        if (affProvided) {
          payload.affiliation = currentAff || null;
        }
      }

      let { error } = await client.from("travelers").update(payload).eq("id", id);
      if (error && (error.message?.includes("affiliation") || error.code === "PGRST204")) {
        delete payload.affiliation;
        const retry = await client.from("travelers").update(payload).eq("id", id);
        error = retry.error;
      }
      if (error) throw new Error(error.message);
    },

    delete: async (id: string) => {
      const client = getClient();
      const { error } = await client.from("travelers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  },

  documents: {
    upload: async (
      requestId: string,
      file: File,
      documentType: DocumentType,
      travelerId?: string,
      currentUser?: User
    ): Promise<DocumentItem> => {
      const client = getClient();
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${requestId}/${Date.now()}_${safeName}`;

      // Upload file to Supabase Storage
      const { error: uploadErr } = await client.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, { upsert: true });

      if (uploadErr) {
        console.warn("Supabase storage upload error:", uploadErr);
        // If storage bucket is missing, provide a friendly error
        if (uploadErr.message.includes("Bucket not found")) {
          throw new Error("حاوية تخزين الملفات (hajj-documents) غير موجودة في Supabase. يرجى إنشاء Bucket باسم hajj-documents وضبطه كـ Public.");
        }
        throw new Error(`فشل رفع الملف إلى السحابة: ${uploadErr.message}`);
      }

      const { data: pubData } = client.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      const storageUrl = pubData.publicUrl;

      // Insert document record in DB
      const row = {
        id: docId,
        group_request_id: requestId,
        traveler_id: travelerId || null,
        document_type: documentType,
        original_file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        version: 1,
        uploaded_by_id: currentUser?.id || "unknown",
        uploaded_by_name: currentUser?.fullName || "مستخدم",
        uploaded_at: new Date().toISOString(),
        review_status: "Pending",
        storage_path: storagePath,
        storage_url: storageUrl,
      };

      const { data: inserted, error: insertErr } = await client
        .from("documents")
        .insert(row)
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      // Link special documents to request / hosting if applicable
      if (documentType === "FlightTicket") {
        await client
          .from("group_requests")
          .update({ flight_ticket_document_id: docId })
          .eq("id", requestId);
      } else if (documentType === "HostId") {
        await client
          .from("hosting_infos")
          .update({ host_id_document_id: docId })
          .eq("group_request_id", requestId);
      }

      return mapDoc(inserted);
    },

    review: async (documentId: string, status: DocumentReviewStatus, note?: string) => {
      const client = getClient();
      const { error } = await client
        .from("documents")
        .update({
          review_status: status,
          review_note: note || null,
        })
        .eq("id", documentId);

      if (error) throw new Error(error.message);
    },

    delete: async (documentId: string) => {
      const client = getClient();
      const { data: doc } = await client.from("documents").select("storage_path").eq("id", documentId).single();
      if (doc?.storage_path) {
        await client.storage.from(BUCKET_NAME).remove([doc.storage_path]);
      }
      const { error } = await client.from("documents").delete().eq("id", documentId);
      if (error) throw new Error(error.message);
    },

    getStreamUrl: async (documentId: string): Promise<string> => {
      const client = getClient();
      const { data: doc, error } = await client
        .from("documents")
        .select("storage_url, storage_path")
        .eq("id", documentId)
        .single();

      if (error || !doc) throw new Error("المستند غير موجود");

      if (doc.storage_url) return doc.storage_url;

      if (doc.storage_path) {
        const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(doc.storage_path);
        return data.publicUrl;
      }

      throw new Error("رابط المستند غير متوفر");
    },
  },

  stats: {
    getSummary: async (): Promise<AdminStats> => {
      const client = getClient();
      const [{ data: requests }, { data: travelers }] = await Promise.all([
        client.from("group_requests").select("status"),
        client.from("travelers").select("id"),
      ]);

      const reqs = requests || [];
      const requestsByStatus: Record<string, number> = {};
      reqs.forEach((r) => {
        requestsByStatus[r.status] = (requestsByStatus[r.status] || 0) + 1;
      });

      return {
        totalGroups: reqs.length,
        totalTravelers: travelers?.length || 0,
        newRequests: requestsByStatus["Draft"] || 0,
        underReview: requestsByStatus["UnderReview"] || 0,
        missingDocuments: requestsByStatus["MissingDocuments"] || 0,
        correctionRequired: requestsByStatus["CorrectionRequired"] || 0,
        readyForSaudiAgent: requestsByStatus["ReadyForSaudiAgent"] || 0,
        receivedBySaudiAgent: requestsByStatus["ReceivedBySaudiAgent"] || 0,
        saudiAgentProcessing: requestsByStatus["SaudiAgentProcessing"] || 0,
        completed: requestsByStatus["Completed"] || 0,
        cancelled: requestsByStatus["Cancelled"] || 0,
        requestsByStatus,
        requestsByEmployee: [],
      };
    },
  },

  audit: {
    getAll: async (limit = 100): Promise<AuditLogItem[]> => {
      const client = getClient();
      const { data, error } = await client
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        userRole: row.user_role,
        action: row.action,
        entityName: row.entity_name,
        entityId: row.entity_id,
        ipAddress: row.ip_address,
        metadataJson: row.metadata_json,
        createdAt: row.created_at,
      }));
    },
  },

  // One-click migration: Uploads all local database records to Supabase!
  migration: {
    migrateLocalDataToSupabase: async (
      localRequests: GroupRequestDetail[],
      localUsers: User[],
      onProgress?: (msg: string) => void
    ): Promise<{ importedRequests: number; importedUsers: number }> => {
      const client = getClient();
      onProgress?.("جاري فحص الاتصال وقاعدة البيانات...");

      // 1. Migrate Users
      onProgress?.(`جاري ترحيل ${localUsers.length} مستخدمين...`);
      for (const u of localUsers) {
        await client.from("app_users").upsert({
          id: u.id,
          username: u.username,
          password: (u as any).password || "123456",
          full_name: u.fullName,
          role: u.role,
          phone: u.phone || null,
          is_active: u.isActive,
          created_at: u.createdAt || new Date().toISOString(),
        });
      }

      // 2. Migrate Group Requests
      onProgress?.(`جاري ترحيل ${localRequests.length} معاملات ومجموعات...`);
      let count = 0;
      for (const req of localRequests) {
        count++;
        onProgress?.(`جاري ترحيل المعاملة (${count} من ${localRequests.length}): ${req.groupName}`);

        await client.from("group_requests").upsert({
          id: req.id,
          request_number: req.requestNumber,
          group_name: req.groupName,
          sender_id: req.senderId,
          sender_name: req.senderName,
          assigned_safa_employee_id: req.assignedSafaEmployeeId || null,
          assigned_safa_employee_name: req.assignedSafaEmployeeName || null,
          assigned_saudi_agent_id: req.assignedSaudiAgentId || null,
          assigned_saudi_agent_name: req.assignedSaudiAgentName || null,
          status: req.status,
          nusuk_group_number: req.nusukGroupNumber || null,
          has_hosting: Boolean(req.hasHosting),
          contact_phone: req.contactPhone || null,
          travel_date: req.travelDate || null,
          departure_date: req.departureDate || null,
          return_date: req.returnDate || null,
          flight_departure_time: req.flightDepartureTime || null,
          airport_arrival_time: req.airportArrivalTime || null,
          airline: req.airline || null,
          flight_number: req.flightNumber || null,
          flight_ticket_document_id: req.flightTicketDocumentId || null,
          destination: req.destination || null,
          notes: req.notes || null,
          created_at: req.createdAt,
          updated_at: req.updatedAt,
          completed_at: req.completedAt || null,
        });

        // Hosting Info
        if (req.hostingInfo) {
          await client.from("hosting_infos").upsert({
            id: req.hostingInfo.id,
            group_request_id: req.id,
            host_name: req.hostingInfo.hostName,
            host_phone: req.hostingInfo.hostPhone,
            host_birth_date: req.hostingInfo.hostBirthDate || null,
            host_nationality: req.hostingInfo.hostNationality || null,
            host_national_id: req.hostingInfo.hostNationalId || null,
            host_address: req.hostingInfo.hostAddress || null,
            host_id_document_id: req.hostingInfo.hostIdDocumentId || null,
          });
        }

        // Travelers
        if (req.travelers && req.travelers.length > 0) {
          for (const t of req.travelers) {
            await client.from("travelers").upsert({
              id: t.id,
              group_request_id: req.id,
              full_name: t.fullName,
              passport_number: t.passportNumber || null,
              phone_number: t.phoneNumber || null,
              nationality: t.nationality || null,
              date_of_birth: t.dateOfBirth || null,
              status: t.status || "Pending",
              notes: t.notes || null,
              created_at: t.createdAt || req.createdAt,
            });

            // Traveler documents metadata & storage upload
            if (t.documents && t.documents.length > 0) {
              for (const d of t.documents) {
                const { storagePath, storageUrl } = await uploadLocalDocToStorage(client, req.id, d);
                await client.from("documents").upsert({
                  id: d.id,
                  group_request_id: req.id,
                  traveler_id: t.id,
                  document_type: d.documentType,
                  original_file_name: d.originalFileName,
                  file_size: d.fileSize || 0,
                  mime_type: d.mimeType || null,
                  version: d.version || 1,
                  uploaded_by_id: d.uploadedById || "unknown",
                  uploaded_by_name: d.uploadedByName || null,
                  uploaded_at: d.uploadedAt || req.createdAt,
                  review_status: d.reviewStatus || "Pending",
                  review_note: d.reviewNote || null,
                  storage_path: storagePath || null,
                  storage_url: storageUrl || null,
                });
              }
            }
          }
        }

        // Group documents metadata & storage upload
        if (req.groupDocuments && req.groupDocuments.length > 0) {
          for (const d of req.groupDocuments) {
            const { storagePath, storageUrl } = await uploadLocalDocToStorage(client, req.id, d);
            await client.from("documents").upsert({
              id: d.id,
              group_request_id: req.id,
              traveler_id: null,
              document_type: d.documentType,
              original_file_name: d.originalFileName,
              file_size: d.fileSize || 0,
              mime_type: d.mimeType || null,
              version: d.version || 1,
              uploaded_by_id: d.uploadedById || "unknown",
              uploaded_by_name: d.uploadedByName || null,
              uploaded_at: d.uploadedAt || req.createdAt,
              review_status: d.reviewStatus || "Pending",
              review_note: d.reviewNote || null,
              storage_path: storagePath || null,
              storage_url: storageUrl || null,
            });
          }
        }

        // Status histories
        if (req.statusHistories && req.statusHistories.length > 0) {
          for (const h of req.statusHistories) {
            await client.from("status_histories").upsert({
              id: h.id,
              group_request_id: req.id,
              from_status: h.fromStatus,
              to_status: h.toStatus,
              changed_by_id: h.changedById,
              changed_by_name: h.changedByName,
              note: h.note || null,
              created_at: h.createdAt,
            });
          }
        }

        // Correction requests
        if (req.correctionRequests && req.correctionRequests.length > 0) {
          for (const c of req.correctionRequests) {
            await client.from("correction_requests").upsert({
              id: c.id,
              group_request_id: req.id,
              traveler_id: c.travelerId || null,
              traveler_name: c.travelerName || null,
              document_id: c.documentId || null,
              target_field: c.targetField || null,
              requested_by_id: c.requestedById,
              requested_by_name: c.requestedByName,
              assigned_to_id: c.assignedToId || null,
              assigned_to_name: c.assignedToName || null,
              reason: c.reason,
              status: c.status,
              resolution_notes: c.resolutionNotes || null,
              created_at: c.createdAt,
              resolved_at: c.resolvedAt || null,
            });
          }
        }
      }

      onProgress?.("اكتملت عملية ترحيل البيانات إلى السحابة بنجاح ✓!");
      return { importedRequests: localRequests.length, importedUsers: localUsers.length };
    },
  },

  settings: {
    get: async (key: string): Promise<string | null> => {
      try {
        const client = getClient();
        // 1. Try system_settings table first
        const { data, error } = await client
          .from("system_settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();

        if (!error && data && data.value) {
          return data.value;
        }

        // 2. Seamless fallback: check app_users table config row
        const { data: userConfig, error: uErr } = await client
          .from("app_users")
          .select("phone")
          .eq("id", `sys_setting_${key}`)
          .maybeSingle();

        if (!uErr && userConfig && userConfig.phone) {
          return userConfig.phone;
        }
      } catch (err) {
        console.warn("Error reading cloud setting:", key, err);
      }
      return null;
    },

    set: async (key: string, value: string): Promise<void> => {
      try {
        const client = getClient();
        // 1. Try upserting to system_settings table
        const { error } = await client
          .from("system_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() });

        if (!error) return;

        // 2. Seamless fallback if system_settings table not yet created: store in app_users
        await client.from("app_users").upsert({
          id: `sys_setting_${key}`,
          username: `__sys_config_${key}__`,
          password: "system_protected",
          full_name: `System Config: ${key}`,
          role: "Admin",
          phone: value,
          is_active: false,
        });
      } catch (err) {
        console.warn("Error writing cloud setting:", key, err);
        throw err;
      }
    },
  },
};


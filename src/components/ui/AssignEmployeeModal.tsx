"use client";

import React, { useState, useEffect } from "react";
import { User } from "@/types";
import { api } from "@/lib/api";
import { notificationsService } from "@/lib/notificationsService";
import { X, UserCheck, Shield, Users, Check, AlertCircle, Loader2 } from "lucide-react";
import { useDialog } from "@/lib/dialog-context";

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  requestNumber: string;
  groupName: string;
  currentSafaEmployeeId?: string;
  currentSaudiAgentId?: string;
  onAssigned?: () => void;
}

export function AssignEmployeeModal({
  isOpen,
  onClose,
  requestId,
  requestNumber,
  groupName,
  currentSafaEmployeeId,
  currentSaudiAgentId,
  onAssigned,
}: AssignEmployeeModalProps) {
  const { alert } = useDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedSafaId, setSelectedSafaId] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setSelectedSafaId(currentSafaEmployeeId || "");
      setSelectedAgentId(currentSaudiAgentId || "");
      loadUsers();
    }
  }, [isOpen, currentSafaEmployeeId, currentSaudiAgentId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await api.admin.getUsers();
      setUsers(allUsers.filter((u) => u.isActive));
    } catch (err) {
      console.warn("Could not load users for assignment:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const safaEmployees = users.filter((u) => u.role === "SafaEmployee" || u.role === "Admin");
  const saudiAgents = users.filter((u) => u.role === "SaudiAgent");

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.admin.reassignRequest(
        requestId,
        selectedSafaId || undefined,
        selectedAgentId || undefined
      );

      // Create notification for the assigned employee
      if (selectedSafaId) {
        const emp = safaEmployees.find((u) => u.id === selectedSafaId);
        notificationsService.add({
          title: "تم إسناد معاملة جديدة لك 📋",
          message: `تم إسناد المعاملة "${requestNumber}" (فوج: ${groupName}) إليك لمتابعتها وإنجازها.`,
          type: "info",
          requestId,
          requestNumber,
          targetUserId: selectedSafaId,
          linkUrl: `/requests/${requestId}`,
        });
      }

      await alert({
        title: "تم التعيين بنجاح",
        message: `تم إسناد المعاملة رقم ${requestNumber} بنجاح.`,
        variant: "success",
      });

      onAssigned?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل إسناد المعاملة";
      await alert({
        title: "خطأ",
        message: msg,
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">إسناد وتوزيع المعاملة</h3>
              <p className="text-xs text-blue-100">
                المعاملة: {requestNumber} ({groupName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-right">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <span className="text-xs font-medium">جاري تحميل قائمة الموظفين...</span>
            </div>
          ) : (
            <>
              {/* Safa Employee Assignment */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>موظف شركة صفا المسؤول عن المعاملة:</span>
                </label>
                <select
                  value={selectedSafaId}
                  onChange={(e) => setSelectedSafaId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  <option value="">-- غير مسند (متاح للجميع) --</option>
                  {safaEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.role === "Admin" ? "مدير النظام" : "موظف صفا"})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  الموظف المسند إليه سيظهر اسمه في كرت المعاملة وسيتلقى إشعاراً فورياً لمتابعتها.
                </p>
              </div>

              {/* Saudi Agent Assignment */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>الوكيل السعودي / المستضيف (اختياري):</span>
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                >
                  <option value="">-- الافتراضي أو غير محدد --</option>
                  {saudiAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-xl text-xs font-bold hover:from-blue-800 hover:to-indigo-800 transition-all shadow-md shadow-blue-700/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>حفظ الإسناد</span>
          </button>
        </div>
      </div>
    </div>
  );
}

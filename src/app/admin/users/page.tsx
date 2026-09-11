"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { User, UserRole } from "@/types";
import { ROLE_LABELS } from "@/lib/constants";
import {
  Users,
  UserPlus,
  Shield,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  Power,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function UsersManagementPage() {
  const { user: currentUser, role } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("Sender");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getUsers();
      setUsers(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role && role !== "Admin") {
      router.push("/dashboard");
      return;
    }
    loadUsers();
  }, [role, router]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password) {
      alert("يرجى ملء جميع الحقول الإلزامية.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.admin.createUser({
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        role: userRole,
        phone: phone.trim() || undefined,
      });

      setSuccess("تم إنشاء المستخدم الجديد بنجاح.");
      setShowCreateModal(false);
      setFullName("");
      setUsername("");
      setPassword("");
      setPhone("");
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const res = await api.admin.toggleUserStatus(userId);
      setSuccess(res.message);
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            <span>إدارة المستخدمين والصلاحيات</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            إدارة حسابات المرسلين، موظفي الصفا، والوكلاء السعوديين والمشرفين.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-green-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <tr>
                <th className="py-3.5 px-4">الاسم الكامل</th>
                <th className="py-3.5 px-4">اسم الدخول</th>
                <th className="py-3.5 px-4">الدور الوظيفي</th>
                <th className="py-3.5 px-4">الهاتف</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">آخر دخول</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="py-3.5 px-4 font-bold text-gray-900">
                    {u.fullName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-gray-600">
                    {u.username}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        ROLE_LABELS[u.role]?.color
                      }`}
                    >
                      {ROLE_LABELS[u.role]?.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-gray-500" dir="ltr">
                    {u.phone || "-"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        u.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {u.isActive ? "نشط" : "معطل"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-400 whitespace-nowrap">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString("ar-SA")
                      : "لم يسجل"}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleToggleStatus(u.id)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                          u.isActive
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{u.isActive ? "تعطيل الحساب" : "تفعيل"}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">
                إضافة مستخدم جديد
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  اسم المستخدم (للدخول) *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ahmed123"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  الدور الوظيفي *
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
                >
                  <option value="Sender">مرسل المعاملات (Sender)</option>
                  <option value="SafaEmployee">موظف تسجيل الصفا (Safa Employee)</option>
                  <option value="SaudiAgent">الوكيل السعودي (Saudi Agent)</option>
                  <option value="Admin">مدير النظام (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm text-right"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs"
                >
                  حفظ المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

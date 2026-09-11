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
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UsersManagementPage() {
  const { user: currentUser, role } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
      navigate("/dashboard");
      return;
    }
    loadUsers();
  }, [role, navigate]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password) {
      setError("يرجى ملء جميع الحقول الإلزامية.");
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

      setSuccess("تم إنشاء حساب المستخدم بنجاح.");
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

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? "تعطيل" : "تفعيل";
    if (!confirm(`هل أنت متأكد من رغبتك في ${action} هذا المستخدم؟`)) return;

    try {
      setError(null);
      const res = await api.admin.toggleUserStatus(userId);
      setSuccess(res.message);
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين والصلاحيات</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            إضافة مستخدمين جدد، وتحديد أدوارهم في النظام وتفعيل أو تعطيل الحسابات
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors text-sm self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 text-red-800 text-xs flex items-center justify-between border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Filter */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، اسم المستخدم، الهاتف..."
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
        </div>
        <span className="text-xs text-gray-500 font-medium px-2">
          {filteredUsers.length} مستخدم
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            جاري تحميل قائمة المستخدمين...
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((u) => {
              const roleMeta = ROLE_LABELS[u.role];
              return (
                <div
                  key={u.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-base shrink-0">
                      {u.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">
                          {u.fullName}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          @{u.username}
                        </span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${roleMeta?.color}`}
                        >
                          {roleMeta?.label}
                        </span>
                        {!u.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                            معطل
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                        {u.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{u.phone}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            تاريخ التسجيل:{" "}
                            {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleToggleStatus(u.id, u.isActive)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          u.isActive
                            ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-gray-900 text-sm">إضافة مستخدم جديد</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: عبدالله السعيد"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  اسم المستخدم (تسجيل الدخول) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: safa_emp2"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  كلمة المرور <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  الدور والصلاحية <span className="text-red-500">*</span>
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white"
                >
                  <option value="Sender">مرسل المعاملات (Sender)</option>
                  <option value="SafaEmployee">موظف تسجيل الصفا (SafaEmployee)</option>
                  <option value="SaudiAgent">الوكيل السعودي (SaudiAgent)</option>
                  <option value="Admin">مدير النظام (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "جاري الحفظ..." : "إنشاء المستخدم"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

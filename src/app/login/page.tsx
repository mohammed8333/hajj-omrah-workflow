import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, UserCheck, AlertCircle, KeyRound, User, Cloud, CloudOff } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { CloudSettingsModal } from "@/components/ui/CloudSettingsModal";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCloud, setIsCloud] = useState(false);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  useEffect(() => {
    setIsCloud(isSupabaseConfigured());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(username.trim(), password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (!isCloud && err.message.includes("غير موجود")) {
          setError(
            `${err.message} (أنت تعمل حالياً في الوضع المحلي دون اتصال بالسحابة. إذا كانت حساباتك في سحابة Supabase، اضغط على زر "وضع محلي" بالأعلى لربط السحابة).`
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("فشل تسجيل الدخول. تحقق من صحة البيانات.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-50 via-gray-50 to-teal-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        {/* Connection status bar */}
        <div className="flex items-center justify-between pb-3 mb-6 border-b border-gray-100">
          <span className="text-xs text-gray-400 font-medium">حالة الاتصال:</span>
          <button
            type="button"
            onClick={() => setCloudModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
              isCloud
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            }`}
          >
            {isCloud ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>🟢 متصل بالسحابة (أونلاين)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                <span>⚪ وضع محلي (اضغط للربط بالسحابة)</span>
              </>
            )}
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-sky-600 to-teal-500 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold mx-auto shadow-md mb-4">
            ح
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            تسجيل الدخول للنظام
          </h1>
          <p className="text-sm text-gray-500">
            نظام إدارة سير وثائق ومعاملات الحج والعمرة
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              اسم المستخدم
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-sm"
                required
              />
              <User className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-sm"
                required
              />
              <KeyRound className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                <span>دخول</span>
              </>
            )}
          </button>
        </form>


        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>منظومة آمنة ومحمية بسجل تدقيق رقمي</span>
        </div>
      </div>

      {/* Cloud Settings Modal */}
      <CloudSettingsModal
        isOpen={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        onConnectionChanged={(connected) => setIsCloud(connected)}
      />
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, UserCheck, AlertCircle, KeyRound, User } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        setError(err.message);
      } else {
        setError("فشل تسجيل الدخول. تحقق من صحة البيانات.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-50 via-gray-50 to-teal-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
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

        {/* Quick Test Accounts */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3 text-center">
            حسابات الاختبار السريع (انقر للتعبئة الفورية):
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin("sender", "Sender@123456")}
              className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-right font-medium transition-colors border border-blue-100 cursor-pointer"
            >
              <div className="font-bold">مرسل المعاملات</div>
              <div className="text-[11px] text-blue-600">sender</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("safa_emp", "Safa@123456")}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-right font-medium transition-colors border border-emerald-100 cursor-pointer"
            >
              <div className="font-bold">موظف الصفا</div>
              <div className="text-[11px] text-emerald-600">safa_emp</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("saudi_agent", "Agent@123456")}
              className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-right font-medium transition-colors border border-amber-100 cursor-pointer"
            >
              <div className="font-bold">الوكيل السعودي</div>
              <div className="text-[11px] text-amber-600">saudi_agent</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("admin", "Admin@123456")}
              className="p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-right font-medium transition-colors border border-purple-100 cursor-pointer"
            >
              <div className="font-bold">مدير النظام</div>
              <div className="text-[11px] text-purple-600">admin</div>
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>منظومة آمنة ومحمية بسجل تدقيق رقمي</span>
        </div>
      </div>
    </div>
  );
}

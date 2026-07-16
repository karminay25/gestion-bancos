"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertCircle, Loader2, Lock } from "lucide-react";

// Login shows a friendly username instead of an email — Supabase Auth still
// needs an email under the hood, so we map the typed username to one here.
const USERNAME_TO_EMAIL: Record<string, string> = {
  admin: "admin@sistema.local",
  lector: "lector@sistema.local",
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const email = USERNAME_TO_EMAIL[username.trim().toLowerCase()];
    if (!email) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 space-y-6 border border-zinc-100 dark:border-zinc-800"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">BANCOS LBO</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Inicia sesión para continuar.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-zinc-900 dark:bg-primary text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import { signIn } from "@/lib/client/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError("Email ou mot de passe incorrect.");
      } else {
        router.push("/personnes-physiques");
        router.refresh();
      }
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center shadow mb-3">
            <Scale size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">LexCRM</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Gestion juridique</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-800 mb-6">Connexion</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                placeholder="vous@lx.legal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

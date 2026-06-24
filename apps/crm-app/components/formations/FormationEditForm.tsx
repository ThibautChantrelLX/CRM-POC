"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FormField, inputCls } from "@/components/ui/form-field";
import type { FormationDetail } from "@/lib/server/modules/formations/dto";

function splitDatetime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = d.toISOString().split("T")[0];
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const time = h === 0 && min === 0 ? "" : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return { date, time };
}

function joinDatetime(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}:00.000Z` : `${date}T00:00:00.000Z`;
}

interface Props {
  formation: FormationDetail;
}

export function FormationEditForm({ formation }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debut = splitDatetime(formation.dateDebut);
  const fin = splitDatetime(formation.dateFin);

  const [form, setForm] = useState({
    intitule: formation.intitule,
    intituleCourt: formation.intituleCourt ?? "",
    dateDebutDate: debut.date,
    dateDebutTime: debut.time,
    dateFinDate: fin.date,
    dateFinTime: fin.time,
    dureeHeures: formation.dureeHeures?.toString() ?? "",
    dureeJours: formation.dureeJours?.toString() ?? "",
    lieu: formation.lieu ?? "",
    modeOrganisation: formation.modeOrganisation ?? "",
    categorie: formation.categorie ?? "",
    nature: formation.nature ?? "",
    avancement: formation.avancement ?? "",
    responsable: formation.responsable ?? "",
    formateurs: formation.formateurs ?? "",
  });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const body = {
        intitule: form.intitule.trim(),
        intituleCourt: form.intituleCourt.trim() || null,
        dateDebut: joinDatetime(form.dateDebutDate, form.dateDebutTime),
        dateFin: joinDatetime(form.dateFinDate, form.dateFinTime),
        dureeHeures: form.dureeHeures ? Number(form.dureeHeures) : null,
        dureeJours: form.dureeJours ? Number(form.dureeJours) : null,
        lieu: form.lieu.trim() || null,
        modeOrganisation: form.modeOrganisation.trim() || null,
        categorie: form.categorie.trim() || null,
        nature: form.nature.trim() || null,
        avancement: form.avancement.trim() || null,
        responsable: form.responsable.trim() || null,
        formateurs: form.formateurs.trim() || null,
      };
      const res = await fetch(`/api/formations/${formation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      router.push(`/admin/formations/${formation.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

      {/* Titre */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/60">
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Titre</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <FormField label="Intitulé *">
            <input className={inputCls} value={form.intitule} onChange={set("intitule")} required />
          </FormField>
          <FormField label="Intitulé court">
            <input className={inputCls} value={form.intituleCourt} onChange={set("intituleCourt")} />
          </FormField>
        </div>
      </div>

      {/* Dates & horaires */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/60">
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Dates &amp; horaires</h3>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-4 gap-3">
            <FormField label="Date de début">
              <input type="date" className={inputCls} value={form.dateDebutDate} onChange={set("dateDebutDate")} />
            </FormField>
            <FormField label="Heure de début">
              <input type="time" className={inputCls} value={form.dateDebutTime} onChange={set("dateDebutTime")} />
            </FormField>
            <FormField label="Date de fin">
              <input type="date" className={inputCls} value={form.dateFinDate} onChange={set("dateFinDate")} />
            </FormField>
            <FormField label="Heure de fin">
              <input type="time" className={inputCls} value={form.dateFinTime} onChange={set("dateFinTime")} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <FormField label="Durée (heures)">
              <input type="number" min={0} step={0.5} className={inputCls} value={form.dureeHeures} onChange={set("dureeHeures")} />
            </FormField>
            <FormField label="Durée (jours)">
              <input type="number" min={0} step={0.5} className={inputCls} value={form.dureeJours} onChange={set("dureeJours")} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Logistique */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/60">
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Logistique</h3>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          <FormField label="Lieu">
            <input className={inputCls} value={form.lieu} onChange={set("lieu")} />
          </FormField>
          <FormField label="Mode d'organisation">
            <input className={inputCls} value={form.modeOrganisation} onChange={set("modeOrganisation")} />
          </FormField>
          <FormField label="Catégorie">
            <input className={inputCls} value={form.categorie} onChange={set("categorie")} />
          </FormField>
          <FormField label="Nature">
            <input className={inputCls} value={form.nature} onChange={set("nature")} />
          </FormField>
          <FormField label="Avancement" className="col-span-2">
            <input className={inputCls} value={form.avancement} onChange={set("avancement")} />
          </FormField>
        </div>
      </div>

      {/* Intervenants */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/60">
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Intervenants</h3>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          <FormField label="Responsable">
            <input className={inputCls} value={form.responsable} onChange={set("responsable")} />
          </FormField>
          <FormField label="Formateurs">
            <input className={inputCls} value={form.formateurs} onChange={set("formateurs")} placeholder="Nom 1, Nom 2…" />
          </FormField>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Enregistrer les modifications
        </button>
      </div>
    </form>
  );
}

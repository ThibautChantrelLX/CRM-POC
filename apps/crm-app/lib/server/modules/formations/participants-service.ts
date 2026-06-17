import { prisma } from "@/lib/server/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PPCandidate = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  barreau: string | null;
  entreprise: string | null;
};

export type MatchStatus = "exact" | "partial" | "multi" | "none";

export type MatchDetail = {
  nomMatch: boolean;
  prenomMatch: boolean;
  emailMatch: boolean;
};

export type ParticipantMatchInput = {
  idInscription: number;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  barreau: string | null;
};

export type ParticipantMatchResult = {
  idInscription: number;
  existing: boolean;
  status: MatchStatus;
  candidates: PPCandidate[];
  matchDetail?: MatchDetail;
};

export type ParticipantCreateInput = {
  idInscription: number;
  personnePhysiqueId: string | null;
  updatePpEmail: boolean;
  nomAffiche: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  entreprise: string | null;
  barreau: string | null;
  present: boolean;
  satisfaction: number | null;
  dateInscription: string | null;
  prixParticipant: number | null;
};

export type ParticipantListItem = {
  id: number;
  idInscription: number;
  nomAffiche: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  entreprise: string | null;
  barreau: string | null;
  present: boolean;
  satisfaction: number | null;
  prixParticipant: number | null;
  personnePhysiqueId: string | null;
  ppNom: string | null;
  ppPrenom: string | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const PP_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  profilAvocat: { select: { barreau: true } },
  rattachements: {
    take: 1,
    select: { personneMorale: { select: { raisonSociale: true } } },
  },
} as const;

type PpRow = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  profilAvocat: { barreau: string | null } | null;
  rattachements: Array<{ personneMorale: { raisonSociale: string } }>;
};

function toCandidate(pp: PpRow): PPCandidate {
  return {
    id: pp.id,
    nom: pp.nom,
    prenom: pp.prenom,
    email: pp.email,
    barreau: pp.profilAvocat?.barreau ?? null,
    entreprise: pp.rattachements[0]?.personneMorale.raisonSociale ?? null,
  };
}

// ─── Match ────────────────────────────────────────────────────────────────────

// A match is "exact" only when nom + prenom + email all match (case-insensitive).
// Any other scenario where a candidate is found is a "partial" or "multi" warning.
export async function matchParticipants(
  formationId: string,
  inputs: ParticipantMatchInput[],
): Promise<ParticipantMatchResult[]> {
  // 1. Which IDs already exist for this formation?
  const existingSet = new Set(
    (
      await prisma.participationFormation.findMany({
        where: { formationId, idInscription: { in: inputs.map((i) => i.idInscription) } },
        select: { idInscription: true },
      })
    ).map((r) => r.idInscription),
  );

  const newInputs = inputs.filter((i) => !existingSet.has(i.idInscription));

  // 2. Email queries (equals, case-insensitive)
  const emailMap = new Map<string, PpRow[]>();
  const uniqueEmails = [
    ...new Set(newInputs.map((i) => i.email).filter(Boolean) as string[]),
  ];
  await Promise.all(
    uniqueEmails.map(async (email) => {
      const matches = await prisma.personnePhysique.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        select: PP_SELECT,
        take: 10,
      });
      emailMap.set(email.toLowerCase(), matches);
    }),
  );

  // 3. Name queries for inputs where email found nothing
  const needsNameQuery = newInputs.filter((i) => {
    if (!i.email) return true;
    return (emailMap.get(i.email.toLowerCase()) ?? []).length === 0;
  });

  const nameMap = new Map<string, PpRow[]>();
  await Promise.all(
    needsNameQuery
      .filter((i) => i.nom && i.prenom)
      .map(async (i) => {
        const key = `${i.nom!.toLowerCase()}|${i.prenom!.toLowerCase()}`;
        if (nameMap.has(key)) return;
        const matches = await prisma.personnePhysique.findMany({
          where: {
            nom: { equals: i.nom!, mode: "insensitive" },
            prenom: { equals: i.prenom!, mode: "insensitive" },
          },
          select: PP_SELECT,
          take: 10,
        });
        nameMap.set(key, matches);
      }),
  );

  // 4. Classify each input
  return inputs.map((input): ParticipantMatchResult => {
    if (existingSet.has(input.idInscription)) {
      return { idInscription: input.idInscription, existing: true, status: "none", candidates: [] };
    }

    // Try email first
    if (input.email) {
      const emailMatches = emailMap.get(input.email.toLowerCase()) ?? [];
      if (emailMatches.length > 1) {
        return { idInscription: input.idInscription, existing: false, status: "multi", candidates: emailMatches.map(toCandidate) };
      }
      if (emailMatches.length === 1) {
        const pp = emailMatches[0];
        const nomMatch = pp.nom.toLowerCase() === (input.nom ?? "").toLowerCase();
        const prenomMatch = (pp.prenom ?? "").toLowerCase() === (input.prenom ?? "").toLowerCase();
        if (nomMatch && prenomMatch) {
          return { idInscription: input.idInscription, existing: false, status: "exact", candidates: [toCandidate(pp)] };
        }
        return {
          idInscription: input.idInscription,
          existing: false,
          status: "partial",
          candidates: [toCandidate(pp)],
          matchDetail: { nomMatch, prenomMatch, emailMatch: true },
        };
      }
    }

    // Fall back to name search
    if (input.nom && input.prenom) {
      const nameMatches = nameMap.get(`${input.nom.toLowerCase()}|${input.prenom.toLowerCase()}`) ?? [];
      if (nameMatches.length > 1) {
        return { idInscription: input.idInscription, existing: false, status: "multi", candidates: nameMatches.map(toCandidate) };
      }
      if (nameMatches.length === 1) {
        const pp = nameMatches[0];
        const emailMatch =
          !!input.email && (pp.email ?? "").toLowerCase() === input.email.toLowerCase();
        if (emailMatch) {
          return { idInscription: input.idInscription, existing: false, status: "exact", candidates: [toCandidate(pp)] };
        }
        return {
          idInscription: input.idInscription,
          existing: false,
          status: "partial",
          candidates: [toCandidate(pp)],
          matchDetail: { nomMatch: true, prenomMatch: true, emailMatch: false },
        };
      }
    }

    return { idInscription: input.idInscription, existing: false, status: "none", candidates: [] };
  });
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importParticipants(
  formationId: string,
  data: ParticipantCreateInput[],
): Promise<{ created: number; skipped: number }> {
  // Update PP emails where the user chose to use the Excel email
  const emailUpdates = data.filter(
    (p) => p.updatePpEmail && p.personnePhysiqueId && p.email,
  );
  if (emailUpdates.length > 0) {
    await Promise.all(
      emailUpdates.map((p) =>
        prisma.personnePhysique.update({
          where: { id: p.personnePhysiqueId! },
          data: { email: p.email! },
        }),
      ),
    );
  }

  const result = await prisma.participationFormation.createMany({
    data: data.map((p) => ({
      idInscription: p.idInscription,
      formationId,
      personnePhysiqueId: p.personnePhysiqueId ?? null,
      nomAffiche: p.nomAffiche,
      prenom: p.prenom,
      nom: p.nom,
      email: p.email,
      entreprise: p.entreprise,
      barreau: p.barreau,
      present: p.present,
      satisfaction: p.satisfaction,
      dateInscription: p.dateInscription ? new Date(p.dateInscription) : null,
      prixParticipant: p.prixParticipant,
    })),
    skipDuplicates: true,
  });
  return { created: result.count, skipped: data.length - result.count };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getFormationParticipants(formationId: string): Promise<ParticipantListItem[]> {
  const rows = await prisma.participationFormation.findMany({
    where: { formationId },
    include: {
      personnePhysique: { select: { id: true, nom: true, prenom: true } },
    },
    orderBy: [{ present: "desc" }, { nomAffiche: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    idInscription: r.idInscription,
    nomAffiche: r.nomAffiche,
    prenom: r.prenom,
    nom: r.nom,
    email: r.email,
    entreprise: r.entreprise,
    barreau: r.barreau,
    present: r.present,
    satisfaction: r.satisfaction,
    prixParticipant: r.prixParticipant ? Number(r.prixParticipant) : null,
    personnePhysiqueId: r.personnePhysiqueId,
    ppNom: r.personnePhysique?.nom ?? null,
    ppPrenom: r.personnePhysique?.prenom ?? null,
  }));
}

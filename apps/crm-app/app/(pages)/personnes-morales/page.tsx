"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataListPage } from "@/components/data-list/DataListPage";
import { useDataListState } from "@/lib/hooks/useDataListState";
import { usePersonnesMorales } from "@/lib/hooks/usePersonnesMorales";
import { CreatePmModal } from "@/components/pm/CreatePmModal";
import { PM_FIELDS, PM_COLUMNS } from "./config";
import type { PersonneMoraleListItem } from "@/lib/server/modules/personnes-morales/dto";

function PersonnesMoralesContent() {
  const router = useRouter();
  const ds = useDataListState(PM_FIELDS, { defaultSortBy: "raisonSociale" });
  const { data, isLoading, isFetching } = usePersonnesMorales(ds.params);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <DataListPage<PersonneMoraleListItem>
        title="Personnes Morales"
        fields={PM_FIELDS}
        columns={PM_COLUMNS}
        data={data?.data ?? []}
        total={data?.total ?? 0}
        totalPages={data?.totalPages ?? 1}
        page={data?.page ?? ds.page}
        limit={ds.limit}
        sorting={ds.sorting}
        isLoading={isLoading}
        isFetching={isFetching}
        conditions={ds.conditions}
        searchValue={ds.search}
        onPageChange={ds.setPage}
        onLimitChange={ds.setLimit}
        onSortingChange={ds.setSorting}
        onApplyFilters={ds.setConditions}
        onRemoveCondition={ds.removeCondition}
        onClearConditions={ds.clearConditions}
        onSearch={ds.setSearch}
        onRowClick={(row) => router.push(`/personnes-morales/${row.id}`)}
        actionSlot={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition cursor-pointer"
          >
            <Plus size={15} />
            Créer
          </button>
        }
      />
      <CreatePmModal open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
}

export default function PersonnesMoralesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-32 text-sm text-zinc-400">
          Chargement…
        </div>
      }
    >
      <PersonnesMoralesContent />
    </Suspense>
  );
}

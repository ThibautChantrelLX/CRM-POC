"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { DataListPage } from "@/components/data-list/DataListPage";
import { useDataListState } from "@/lib/hooks/useDataListState";
import { usePersonnesPhysiques } from "@/lib/hooks/usePersonnesPhysiques";
import { PP_FIELDS, PP_COLUMNS } from "./config";
import type { PersonnePhysiqueListItem } from "@/lib/server/modules/personnes-physiques/dto";

function PersonnesPhysiquesContent() {
  const router = useRouter();
  const ds = useDataListState(PP_FIELDS, { defaultSortBy: "nom" });
  const { data, isLoading, isFetching } = usePersonnesPhysiques(ds.params);

  return (
    <DataListPage<PersonnePhysiqueListItem>
      title="Personnes Physiques"
      fields={PP_FIELDS}
      columns={PP_COLUMNS}
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
      onRowClick={(row) => router.push(`/personnes-physiques/${row.id}`)}
    />
  );
}

export default function PersonnesPhysiquesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-32 text-sm text-zinc-400">
          Chargement…
        </div>
      }
    >
      <PersonnesPhysiquesContent />
    </Suspense>
  );
}

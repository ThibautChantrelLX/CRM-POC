"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Upload } from "lucide-react";
import { DataListPage } from "@/components/data-list/DataListPage";
import { useDataListState } from "@/lib/hooks/useDataListState";
import { usePersonnesPhysiques } from "@/lib/hooks/usePersonnesPhysiques";
import { ExportModal } from "@/components/pp/ExportModal";
import { ImportPPModal } from "@/components/personnes-physiques/ImportPPModal";
import { PP_FIELDS, PP_COLUMNS } from "./config";
import type { PersonnePhysiqueListItem } from "@/lib/server/modules/personnes-physiques/dto";

function PersonnesPhysiquesContent() {
  const router = useRouter();
  const ds = useDataListState(PP_FIELDS, { defaultSortBy: "nom" });
  const { data, isLoading, isFetching } = usePersonnesPhysiques(ds.params);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
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
        groups={ds.groups}
        conditionCount={ds.conditionCount}
        searchValue={ds.search}
        onPageChange={ds.setPage}
        onLimitChange={ds.setLimit}
        onSortingChange={ds.setSorting}
        onApplyGroups={ds.setGroups}
        onRemoveCondition={ds.removeCondition}
        onClearGroups={ds.clearGroups}
        onSearch={ds.setSearch}
        onRowClick={(row) => router.push(`/personnes-physiques/${row.id}`)}
        actionSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition cursor-pointer"
            >
              <Download size={15} />
              Exporter
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition cursor-pointer"
            >
              <Upload size={15} />
              Importer
            </button>
            <button
              onClick={() => router.push("/personnes-physiques/nouveau")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition cursor-pointer"
            >
              <Plus size={15} />
              Créer
            </button>
          </div>
        }
      />

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        params={ds.params}
        total={data?.total ?? 0}
      />

      {importOpen && (
        <ImportPPModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
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

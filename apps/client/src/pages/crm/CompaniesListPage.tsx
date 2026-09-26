import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  CalendarDays,
  Database,
  Factory,
  Globe,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { sourceLabel, type Company, type UpdateCompanyInput } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/layout/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { useCrmProfiles } from '@/components/crm/CrmProfiles';
import { CompanyDialog } from '@/components/crm/CompanyDialog';
import { DataTable, type DataColumn } from '@/components/crm/DataTable';
import { ColumnFilter, Pill } from '@/components/crm/ColumnFilter';
import { ContactStatusCell, EditableTextCell, SelectCell } from '@/components/crm/EditableCells';
import { MobileFiltersSheet } from '@/components/crm/MobileFiltersSheet';
import { SelectionBar } from '@/components/crm/SelectionBar';
import { TablePagination } from '@/components/crm/TablePagination';
import { ViewConfigButton } from '@/components/crm/ViewConfigButton';
import type { FilterDim } from '@/components/crm/TableFilters';
import {
  countLabel,
  domainFacetOptions,
  domainHref,
  sourceFacetOptions,
  sourceSlugFromLabel,
  sourceSuggestions,
} from '@/components/crm/TableFormat';
import { useCompanies, useCompanyFacets, useDeleteCompany, useUpdateCompany } from '@/hooks/useCrm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { usePersistentStringArray } from '@/hooks/useLocalStorageState';
import { useIsMobile } from '@/hooks/useIsMobile';
import { apiErrorMessage } from '@/lib/api';
import { fullDate, linkExternal, linkInternal } from '@/lib/crm';

// Orden por defecto; se guarda por usuario en el servidor. La primera queda fija.
// "Personas" no viene en el listado (solo en el detalle), así que no hay columna.
const COMPANY_COLUMN_IDS = ['name', 'domain', 'industry', 'location', 'source', 'contact_status', 'created'];
const LIMIT = 50;

export function CompaniesListPage() {
  const { openCompany } = useCrmProfiles();
  const isMobile = useIsMobile();
  const confirm = useConfirm();

  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q.trim());
  // Filtros recordados en localStorage: navegar y volver no los borra.
  const [industry, setIndustry] = usePersistentStringArray('crm.companies.industry');
  const [city, setCity] = usePersistentStringArray('crm.companies.city');
  const [source, setSource] = usePersistentStringArray('crm.companies.source');
  const [domain, setDomain] = usePersistentStringArray('crm.companies.domain'); // 'with' | 'without'
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: facets } = useCompanyFacets();
  const { data, isLoading, isError, error } = useCompanies({
    q: deferredQ || undefined,
    industry: industry.length ? industry : undefined,
    city: city.length ? city : undefined,
    source: source.length ? source : undefined,
    domain: domain.length ? domain : undefined,
    page,
    limit: LIMIT,
  });

  // Desestructuradas: `mutate`/`mutateAsync` son estables y sirven de dependencia.
  const { mutateAsync: deleteOne, isPending: deleting } = useDeleteCompany();
  const { mutate: updateOne } = useUpdateCompany();
  const config = useTableConfig('companies', COMPANY_COLUMN_IDS);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const activeFilterCount = industry.length + city.length + source.length + domain.length;

  function goPage(p: number) {
    setPage(p);
    setSelected(new Set());
  }
  const applyFilter = useCallback(
    (setter: (v: string[]) => void) => (v: string[]) => {
      setter(v);
      setPage(1);
      setSelected(new Set());
    },
    [],
  );

  const saveField = useCallback(
    (id: string, patch: UpdateCompanyInput) => {
      updateOne({ id, data: patch }, { onError: (e) => toast.error(`No se pudo guardar: ${apiErrorMessage(e)}`) });
    },
    [updateOne],
  );

  const options = useMemo(
    () => ({
      industry: facets?.industries ?? [],
      location: facets?.locations ?? [],
      source: sourceFacetOptions(facets?.sources),
      domain: domainFacetOptions(facets?.domain),
      sourceSuggestions: sourceSuggestions(facets?.sources),
      industryValues: (facets?.industries ?? []).map((f) => f.value),
      locationValues: (facets?.locations ?? []).map((f) => f.value),
    }),
    [facets],
  );

  const dims = useMemo<Record<'domain' | 'industry' | 'location' | 'source', FilterDim>>(
    () => ({
      domain: { id: 'domain', label: 'Dominio', icon: Globe, options: options.domain, active: domain, onChange: applyFilter(setDomain) },
      industry: {
        id: 'industry',
        label: 'Industria',
        icon: Factory,
        options: options.industry,
        active: industry,
        onChange: applyFilter(setIndustry),
        searchable: true,
        wide: true,
      },
      location: { id: 'location', label: 'Ubicación', icon: MapPin, options: options.location, active: city, onChange: applyFilter(setCity), searchable: true },
      source: { id: 'source', label: 'Origen', icon: Database, options: options.source, active: source, onChange: applyFilter(setSource) },
    }),
    [options, domain, industry, city, source, applyFilter, setDomain, setIndustry, setCity, setSource],
  );

  const columns = useMemo<DataColumn<Company>[]>(() => {
    const filterOf = (d: FilterDim) => (
      <ColumnFilter label={d.label} options={d.options} active={d.active} onChange={d.onChange} searchable={d.searchable} wide={d.wide} />
    );
    return [
      {
        id: 'name',
        label: 'Empresa',
        icon: Building2,
        width: 240,
        cell: (c) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openCompany(c.id);
            }}
            className={`truncate font-medium ${linkInternal}`}
          >
            {c.name}
          </button>
        ),
      },
      {
        id: 'domain',
        label: 'Dominio',
        icon: Globe,
        width: 180,
        headerControl: filterOf(dims.domain),
        filled: (c) => Boolean(c.domain),
        cell: (c) => (
          <EditableTextCell
            label="Dominio"
            value={c.domain}
            display={
              c.domain ? (
                <a href={domainHref(c.domain)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={linkExternal}>
                  {c.domain}
                </a>
              ) : undefined
            }
            placeholder="dominio.com"
            onSave={(v) => saveField(c.id, { domain: v })}
          />
        ),
      },
      {
        id: 'industry',
        label: 'Industria',
        icon: Factory,
        width: 180,
        headerControl: filterOf(dims.industry),
        filled: (c) => Boolean(c.industry),
        cell: (c) => (
          <SelectCell
            label="Industria"
            value={c.industry}
            options={options.industryValues}
            display={<Pill value={c.industry} />}
            searchPlaceholder="Buscar o crear industria…"
            onSave={(v) => saveField(c.id, { industry: v })}
          />
        ),
      },
      {
        id: 'location',
        label: 'Ubicación',
        icon: MapPin,
        width: 160,
        headerControl: filterOf(dims.location),
        filled: (c) => Boolean(c.primary_location),
        cell: (c) => (
          <SelectCell
            label="Ubicación"
            value={c.primary_location}
            options={options.locationValues}
            searchPlaceholder="Buscar o escribir ciudad…"
            clearLabel="Quitar ubicación"
            onSave={(v) => saveField(c.id, { primary_location: v })}
          />
        ),
      },
      {
        id: 'source',
        label: 'Origen',
        icon: Database,
        width: 140,
        headerControl: filterOf(dims.source),
        filled: (c) => Boolean(c.source),
        cell: (c) => (
          <SelectCell
            label="Origen"
            value={c.source ? sourceLabel(c.source) : null}
            options={options.sourceSuggestions}
            display={<Pill value={sourceLabel(c.source)} />}
            searchPlaceholder="Buscar o crear origen…"
            onSave={(v) => saveField(c.id, { source: sourceSlugFromLabel(v, facets?.sources) })}
          />
        ),
      },
      {
        id: 'contact_status',
        label: 'Estado',
        icon: ShieldCheck,
        width: 150,
        filled: (c) => c.contact_status !== 'CONTACTAR',
        cell: (c) => <ContactStatusCell value={c.contact_status} onSave={(v) => saveField(c.id, { contact_status: v })} />,
      },
      {
        id: 'created',
        label: 'Creada',
        icon: CalendarDays,
        width: 130,
        filled: () => false,
        cell: (c) => <span className="text-muted-foreground">{fullDate(c.created_at)}</span>,
      },
    ];
  }, [dims, options, facets?.sources, openCompany, saveField]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const deleteMany = useCallback(
    async (ids: string[]) => {
    const ok = await confirm({
      title: `¿Eliminar ${countLabel(ids.length, 'empresa')}?`,
      description: 'Las personas asociadas se conservan, pero quedan sin empresa. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    const results = await Promise.allSettled(ids.map((id) => deleteOne(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) toast.error(`No se pudieron eliminar ${failed} de ${ids.length}`);
    else toast.success(countLabel(ids.length, 'empresa eliminada', 'empresas eliminadas'));
    setSelected(new Set());
    },
    [confirm, deleteOne],
  );

  const rowActions = useCallback(
    (c: Company) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label={`Acciones de ${c.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(c)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void deleteMany([c.id])} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [deleteMany],
  );

  const emptyMessage =
    activeFilterCount > 0 || deferredQ
      ? 'Ninguna empresa coincide. Quita algún filtro o cambia la búsqueda.'
      : 'Todavía no hay empresas. Crea la primera con «Nueva empresa».';

  return (
    <div className="flex flex-col md:h-screen">
      <PageHeader title="Empresas" description="Cuentas del CRM: dominio, industria y si podemos contactarlas.">
        <Button size="sm" className="h-9 px-3 md:px-4" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva empresa
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 md:px-6">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar empresa…"
            aria-label="Buscar empresa"
            className="h-9 bg-card pl-7"
          />
        </div>
        <span className="text-xs text-muted-foreground">{countLabel(total, 'empresa')}</span>
        {isMobile ? (
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{activeFilterCount}</span>
            ) : null}
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <TablePagination page={page} limit={LIMIT} total={total} onPage={goPage} />
          {!isMobile ? <ViewConfigButton config={config} columns={columns} /> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-2 md:px-3 md:pb-3">
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando empresas…
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No se pudieron cargar las empresas: {apiErrorMessage(error)}. Recarga la página o intenta más tarde.
          </div>
        ) : (
          <DataTable
            config={config}
            rows={rows}
            columns={columns}
            getRowId={(c) => c.id}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            rowActions={rowActions}
            emptyMessage={emptyMessage}
            addColumn={
              <ViewConfigButton
                config={config}
                columns={columns}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar columna
                  </button>
                }
              />
            }
          />
        )}
      </div>

      <SelectionBar
        count={selected.size}
        noun="empresa"
        pending={deleting}
        onDelete={() => void deleteMany([...selected])}
        onClear={() => setSelected(new Set())}
      />

      <CompanyDialog open={creating} onOpenChange={setCreating} />
      <CompanyDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} company={editing} />
      {isMobile ? <MobileFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} dims={Object.values(dims)} /> : null}
    </div>
  );
}

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  Database,
  Factory,
  FileUp,
  Link2,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  User,
  Wrench,
} from 'lucide-react';
import { CARGO_FAMILIES, cargoGroup, sourceLabel, type Person, type UpdatePersonInput } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CopyText } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/layout/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { useCrmProfiles } from '@/components/crm/CrmProfiles';
import { PersonDialog } from '@/components/crm/PersonDialog';
import { DataTable, type DataColumn } from '@/components/crm/DataTable';
import { ColumnFilter, Pill } from '@/components/crm/ColumnFilter';
import { ContactStatusCell, EditableTextCell, SelectCell } from '@/components/crm/EditableCells';
import { ImportPeopleDialog } from '@/components/crm/ImportPeopleDialog';
import { MobileFiltersSheet } from '@/components/crm/MobileFiltersSheet';
import { SelectionBar } from '@/components/crm/SelectionBar';
import { TablePagination } from '@/components/crm/TablePagination';
import { ViewConfigButton } from '@/components/crm/ViewConfigButton';
import type { FilterDim } from '@/components/crm/TableFilters';
import {
  contactedParam,
  countLabel,
  effectiveIndustry,
  lastTouchText,
  sourceFacetOptions,
  sourceSlugFromLabel,
  sourceSuggestions,
} from '@/components/crm/TableFormat';
import {
  useDeletePerson,
  useFormatPersonNames,
  useMatchPeopleDomains,
  usePeople,
  usePeopleFacets,
  useUpdatePerson,
} from '@/hooks/useCrm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { usePersistentStringArray } from '@/hooks/useLocalStorageState';
import { useIsMobile } from '@/hooks/useIsMobile';
import { apiErrorMessage } from '@/lib/api';
import { linkInternal, relativeTime } from '@/lib/crm';
import { formatPhone } from '@/lib/phone';

// Orden por defecto de columnas; el usuario lo cambia arrastrando y se guarda en
// el servidor (useTableConfig / view-prefs). La primera queda fija a la izquierda.
const PEOPLE_COLUMN_IDS = [
  'name',
  'email',
  'cargo',
  'company',
  'source',
  'industry',
  'last_touch',
  'contact_status',
  'phone',
  'location',
  'linkedin',
];
const LIMIT = 50;

export function PeopleListPage() {
  const { openPerson, openCompany } = useCrmProfiles();
  const isMobile = useIsMobile();
  const confirm = useConfirm();

  const [q, setQ] = useState('');
  // Búsqueda diferida: no dispara una consulta por cada tecla.
  const deferredQ = useDeferredValue(q.trim());
  // Los filtros se recuerdan en localStorage: salir a otra sección y volver no
  // borra la selección (mismo patrón que el resto del CRM).
  const [cargo, setCargo] = usePersistentStringArray('crm.people.cargo');
  const [industry, setIndustry] = usePersistentStringArray('crm.people.industry');
  const [location, setLocation] = usePersistentStringArray('crm.people.location');
  const [source, setSource] = usePersistentStringArray('crm.people.source');
  const [contacted, setContacted] = usePersistentStringArray('crm.people.contacted');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [importing, setImporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const facetFilters = {
    source: source.length ? source : undefined,
    location: location.length ? location : undefined,
    cargo: cargo.length ? cargo : undefined,
    industry: industry.length ? industry : undefined,
    contacted: contactedParam(contacted),
  };
  // Facetas contextuales: cada dimensión refleja el subconjunto ya filtrado por
  // las demás (el servidor excluye la propia dimensión al contar).
  const { data: facets } = usePeopleFacets(facetFilters);
  const { data, isLoading, isError, error } = usePeople({ q: deferredQ || undefined, ...facetFilters, page, limit: LIMIT });

  // Desestructuradas: `mutate`/`mutateAsync` son estables y sirven de dependencia.
  const { mutateAsync: deleteOne, isPending: deleting } = useDeletePerson();
  const { mutate: updateOne } = useUpdatePerson();
  const formatNames = useFormatPersonNames();
  const matchDomains = useMatchPeopleDomains();
  const config = useTableConfig('people', PEOPLE_COLUMN_IDS);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const activeFilterCount = cargo.length + industry.length + location.length + source.length + contacted.length;

  // Cambiar de página o de filtro invalida la selección: las filas ya no son las mismas.
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
    (id: string, patch: UpdatePersonInput) => {
      updateOne({ id, data: patch }, { onError: (e) => toast.error(`No se pudo guardar: ${apiErrorMessage(e)}`) });
    },
    [updateOne],
  );

  const options = useMemo(
    () => ({
      cargo: facets?.cargos ?? [],
      industry: facets?.industries ?? [],
      location: facets?.locations ?? [],
      contact: facets?.contact ?? [],
      source: sourceFacetOptions(facets?.sources),
      sourceSuggestions: sourceSuggestions(facets?.sources),
      industryValues: (facets?.industries ?? []).map((f) => f.value),
      locationValues: (facets?.locations ?? []).map((f) => f.value),
    }),
    [facets],
  );

  // Una sola declaración de cada dimensión: la usan los encabezados (desktop) y
  // el panel de filtros (móvil).
  const dims = useMemo<Record<'cargo' | 'source' | 'industry' | 'contact' | 'location', FilterDim>>(
    () => ({
      cargo: { id: 'cargo', label: 'Cargo', icon: Briefcase, options: options.cargo, active: cargo, onChange: applyFilter(setCargo) },
      source: { id: 'source', label: 'Origen', icon: Database, options: options.source, active: source, onChange: applyFilter(setSource) },
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
      contact: { id: 'contact', label: 'Contacto', icon: MessageSquare, options: options.contact, active: contacted, onChange: applyFilter(setContacted) },
      location: {
        id: 'location',
        label: 'Ubicación',
        icon: MapPin,
        options: options.location,
        active: location,
        onChange: applyFilter(setLocation),
        searchable: true,
      },
    }),
    [options, cargo, source, industry, contacted, location, applyFilter, setCargo, setSource, setIndustry, setContacted, setLocation],
  );

  const columns = useMemo<DataColumn<Person>[]>(() => {
    const filterOf = (d: FilterDim) => (
      <ColumnFilter label={d.label} options={d.options} active={d.active} onChange={d.onChange} searchable={d.searchable} wide={d.wide} />
    );
    return [
      {
        id: 'name',
        label: 'Persona',
        icon: User,
        width: 220,
        cell: (p) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPerson(p.id);
            }}
            className={`truncate font-medium ${linkInternal}`}
          >
            {p.name}
          </button>
        ),
      },
      {
        id: 'email',
        label: 'Correo',
        icon: Mail,
        width: 220,
        filled: (p) => Boolean(p.email_addresses[0]),
        cell: (p) => (
          <EditableTextCell
            label="Correo"
            value={p.email_addresses[0] ?? null}
            display={p.email_addresses[0] ? <CopyText value={p.email_addresses[0]} /> : undefined}
            placeholder="correo@dominio.com"
            onSave={(v) => saveField(p.id, { email_addresses: v ? [v, ...p.email_addresses.slice(1)] : p.email_addresses.slice(1) })}
          />
        ),
      },
      {
        id: 'cargo',
        label: 'Cargo',
        icon: Briefcase,
        width: 180,
        headerControl: filterOf(dims.cargo),
        filled: (p) => Boolean(p.job_title),
        cell: (p) => (
          <SelectCell
            label="Cargo"
            value={p.job_title}
            options={CARGO_FAMILIES}
            // El filtro agrupa por familia; el title lo hace visible sin ocupar espacio.
            display={<span title={`Familia: ${cargoGroup(p.job_title)}`}>{p.job_title}</span>}
            searchPlaceholder="Buscar o escribir cargo…"
            onSave={(v) => saveField(p.id, { job_title: v })}
          />
        ),
      },
      {
        id: 'company',
        label: 'Empresa',
        icon: Building2,
        width: 180,
        cell: (p) =>
          p.company_id ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openCompany(p.company_id!);
              }}
              className={`truncate ${linkInternal}`}
            >
              {p.company?.name ?? 'Ver empresa'}
            </button>
          ) : null,
      },
      {
        id: 'source',
        label: 'Origen',
        icon: Database,
        width: 140,
        headerControl: filterOf(dims.source),
        filled: (p) => Boolean(p.source),
        cell: (p) => (
          <SelectCell
            label="Origen"
            value={p.source ? sourceLabel(p.source) : null}
            options={options.sourceSuggestions}
            display={<Pill value={sourceLabel(p.source)} />}
            searchPlaceholder="Buscar o crear origen…"
            onSave={(v) => saveField(p.id, { source: sourceSlugFromLabel(v, facets?.sources) })}
          />
        ),
      },
      {
        id: 'industry',
        label: 'Industria',
        icon: Factory,
        width: 180,
        headerControl: filterOf(dims.industry),
        filled: (p) => Boolean(effectiveIndustry(p)),
        cell: (p) => {
          const inherited = p.company?.industry ?? null;
          // Con empresa asociada manda la industria de la empresa (se edita allá);
          // sin ella, la propia de la persona es editable aquí.
          if (inherited) {
            return (
              <span title="Heredada de la empresa asociada">
                <Pill value={inherited} />
              </span>
            );
          }
          return (
            <SelectCell
              label="Industria"
              value={p.industry}
              options={options.industryValues}
              display={<Pill value={p.industry} />}
              searchPlaceholder="Buscar o crear industria…"
              onSave={(v) => saveField(p.id, { industry: v })}
            />
          );
        },
      },
      {
        id: 'last_touch',
        label: 'Última interacción',
        icon: MessageSquare,
        width: 190,
        headerControl: filterOf(dims.contact),
        filled: (p) => Boolean(p.last_touch_at),
        cell: (p) => (
          <span className={p.last_touch_at ? undefined : 'text-muted-foreground'}>{lastTouchText(p, relativeTime)}</span>
        ),
      },
      {
        id: 'contact_status',
        label: 'Estado',
        icon: ShieldCheck,
        width: 150,
        filled: (p) => p.contact_status !== 'CONTACTAR',
        cell: (p) => <ContactStatusCell value={p.contact_status} onSave={(v) => saveField(p.id, { contact_status: v })} />,
      },
      {
        id: 'phone',
        label: 'Teléfono',
        icon: Phone,
        width: 170,
        filled: (p) => Boolean(p.phone_numbers[0]),
        cell: (p) => (
          <EditableTextCell
            label="Teléfono"
            value={p.phone_numbers[0] ?? null}
            display={p.phone_numbers[0] ? <CopyText value={p.phone_numbers[0]} display={formatPhone(p.phone_numbers[0])} /> : undefined}
            placeholder="+57…"
            onSave={(v) => saveField(p.id, { phone_numbers: v ? [v, ...p.phone_numbers.slice(1)] : p.phone_numbers.slice(1) })}
          />
        ),
      },
      {
        id: 'location',
        label: 'Ubicación',
        icon: MapPin,
        width: 160,
        headerControl: filterOf(dims.location),
        filled: (p) => Boolean(p.primary_location),
        cell: (p) => (
          <SelectCell
            label="Ubicación"
            value={p.primary_location}
            options={options.locationValues}
            searchPlaceholder="Buscar o escribir ciudad…"
            clearLabel="Quitar ubicación"
            onSave={(v) => saveField(p.id, { primary_location: v })}
          />
        ),
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        icon: Linkedin,
        width: 140,
        filled: (p) => Boolean(p.linkedin),
        cell: (p) => (
          <EditableTextCell
            label="LinkedIn"
            value={p.linkedin}
            display={
              p.linkedin ? (
                <a href={p.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={linkInternal}>
                  Perfil
                </a>
              ) : undefined
            }
            placeholder="URL de LinkedIn…"
            onSave={(v) => saveField(p.id, { linkedin: v })}
          />
        ),
      },
    ];
  }, [dims, options, facets?.sources, openPerson, openCompany, saveField]);

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
      title: `¿Eliminar ${countLabel(ids.length, 'persona')}?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    const results = await Promise.allSettled(ids.map((id) => deleteOne(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) toast.error(`No se pudieron eliminar ${failed} de ${ids.length}`);
    else toast.success(`${countLabel(ids.length, 'persona eliminada', 'personas eliminadas')}`);
    setSelected(new Set());
    },
    [confirm, deleteOne],
  );

  const rowActions = useCallback(
    (p: Person) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label={`Acciones de ${p.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(p)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void deleteMany([p.id])} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [deleteMany],
  );

  async function onFormatNames() {
    const ok = await confirm({
      title: '¿Formatear los nombres en mayúscula?',
      description:
        'Reescribe a mayúscula inicial los nombres que están en MAYÚSCULA sostenida (p. ej. "ANA GÓMEZ" → "Ana Gómez"). No toca los que ya están bien escritos.',
      confirmLabel: 'Formatear',
    });
    if (!ok) return;
    formatNames.mutate(undefined, {
      onSuccess: (r) => toast.success(`${countLabel(r.updated, 'nombre formateado', 'nombres formateados')} de ${r.scanned} revisados`),
      onError: (e) => toast.error(`No se pudo formatear: ${apiErrorMessage(e)}`),
    });
  }

  async function onMatchDomains() {
    const ok = await confirm({
      title: '¿Enlazar personas con su empresa por dominio?',
      description:
        'Asocia a su empresa las personas sin empresa cuyo correo corporativo coincide con el dominio de una sola empresa. Los correos de proveedores públicos (gmail, hotmail…) se ignoran.',
      confirmLabel: 'Enlazar',
    });
    if (!ok) return;
    matchDomains.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          `${countLabel(r.linked, 'persona enlazada', 'personas enlazadas')} de ${r.scanned} revisadas` +
            (r.ambiguous ? ` · ${r.ambiguous} con dominio ambiguo` : ''),
        ),
      onError: (e) => toast.error(`No se pudo enlazar: ${apiErrorMessage(e)}`),
    });
  }

  const maintenancePending = formatNames.isPending || matchDomains.isPending;
  const emptyMessage =
    activeFilterCount > 0 || deferredQ
      ? 'Ninguna persona coincide. Quita algún filtro o cambia la búsqueda.'
      : 'Todavía no hay personas. Crea la primera con «Nueva persona» o importa un CSV.';

  return (
    <div className="flex flex-col md:h-screen">
      <PageHeader title="Personas" description="Contactos del CRM: quién es, dónde trabaja y si podemos escribirle.">
        <Button size="sm" variant="outline" className="hidden h-9 md:inline-flex" onClick={() => setImporting(true)}>
          <FileUp className="mr-1.5 h-4 w-4" /> Importar CSV
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-9" aria-label="Mantenimiento de datos">
              {maintenancePending ? <Loader2 className="h-4 w-4 animate-spin md:mr-1.5" /> : <Wrench className="h-4 w-4 md:mr-1.5" />}
              <span className="hidden md:inline">Mantenimiento</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Mantenimiento</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="md:hidden" onSelect={() => setImporting(true)}>
              <FileUp className="mr-2 h-4 w-4" /> Importar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onFormatNames()} disabled={formatNames.isPending}>
              <Type className="mr-2 h-4 w-4" /> Formatear nombres en mayúscula
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onMatchDomains()} disabled={matchDomains.isPending}>
              <Link2 className="mr-2 h-4 w-4" /> Enlazar por dominio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" className="h-9 px-3 md:px-4" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva persona
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
            placeholder="Buscar persona…"
            aria-label="Buscar persona"
            className="h-9 bg-card pl-7"
          />
        </div>
        <span className="text-xs text-muted-foreground">{countLabel(total, 'persona')}</span>
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
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando personas…
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No se pudieron cargar las personas: {apiErrorMessage(error)}. Recarga la página o intenta más tarde.
          </div>
        ) : (
          <DataTable
            config={config}
            rows={rows}
            columns={columns}
            getRowId={(p) => p.id}
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
        noun="persona"
        pending={deleting}
        onDelete={() => void deleteMany([...selected])}
        onClear={() => setSelected(new Set())}
      />

      <PersonDialog open={creating} onOpenChange={setCreating} />
      <PersonDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} person={editing} />
      <ImportPeopleDialog open={importing} onOpenChange={setImporting} />
      {isMobile ? <MobileFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} dims={Object.values(dims)} /> : null}
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2, Loader2, Trash2, User } from 'lucide-react';
import {
  CreateLeadSchema,
  CRM_CURRENCY,
  LEAD_SERVICES,
  LEAD_SECTORS,
  LEAD_SOURCES,
  type CreateLeadInput,
  type Lead,
  type PipelineStage,
} from '@crm/shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PillSelect } from '@/components/common/PillSelect';
import { Combobox, MultiCombobox, type ComboOption } from '@/components/ui/combobox';
import { useMembers, normalizeMemberId, resolveMemberName } from '@/lib/members';
import { apiErrorMessage } from '@/lib/api';
import { useCreateLead, useUpdateLead, useDeleteLead, useCompanies, useCompany, usePeople } from '@/hooks/useCrm';
import { useConfirm } from '@/components/ConfirmDialog';
import { CompanyDialog } from './CompanyDialog';
import { PersonDialog } from './PersonDialog';

// Valor centinela del selector: el schema acepta cualquier string y en el payload se vuelve null.
const OWNER_NONE = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: PipelineStage[];
  /** Con lead edita; sin él crea uno nuevo. */
  lead?: Lead | null;
  /** Etapa preseleccionada al crear desde una columna del pipeline. */
  defaultStageId?: string;
}

type FormValues = CreateLeadInput;

export function LeadDialog({ open, onOpenChange, stages, lead, defaultStageId }: Props) {
  const isEdit = Boolean(lead);
  const create = useCreateLead();
  const update = useUpdateLead();
  const del = useDeleteLead();
  const confirm = useConfirm();
  // Empresas y personas se buscan CONTRA EL SERVIDOR: filtrar en el cliente
  // escondería todo lo que no cupiera en la primera página.
  const [companyQ, setCompanyQ] = useState('');
  const [personQ, setPersonQ] = useState('');
  const { data: companiesData, isFetching: companiesLoading } = useCompanies({ q: companyQ, limit: 50 }, open);
  const { data: peopleData, isFetching: peopleLoading } = usePeople({ q: personQ, limit: 50 }, open);
  const { activeMembers } = useMembers();
  const companies = companiesData?.items ?? [];
  const people = peopleData?.items ?? [];

  const [companyCreateOpen, setCompanyCreateOpen] = useState(false);
  const [personCreateOpen, setPersonCreateOpen] = useState(false);
  // Personas creadas desde aquí: puede que no caigan en la búsqueda activa, así
  // que se guardan para que su chip conserve el nombre.
  const [createdPeople, setCreatedPeople] = useState<ComboOption[]>([]);

  const orderedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const firstStageId = orderedStages[0]?.id ?? '';

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateLeadSchema),
    defaultValues: blankValues(defaultStageId ?? firstStageId),
  });

  useEffect(() => {
    if (!open) return;
    reset(lead ? leadToValues(lead) : blankValues(defaultStageId ?? firstStageId));
    setCreatedPeople([]);
    // Reinicia SOLO al abrir o al cambiar de lead, no en cada refetch en segundo plano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id]);

  const companyId = watch('company_id');
  const personIds = watch('person_ids') ?? [];

  // La empresa/personas ya asociadas pueden quedar fuera de la búsqueda activa;
  // se pasan aparte para que conserven su nombre (y no se vea el UUID).
  const { data: selectedCompany } = useCompany(companyId ?? undefined);
  const knownCompanies = useMemo<ComboOption[]>(
    () => (selectedCompany ? [companyOption(selectedCompany.id, selectedCompany.name, selectedCompany.domain)] : []),
    [selectedCompany],
  );
  const knownPeople = useMemo<ComboOption[]>(
    () => [...(lead?.persons ?? []).map((p) => personOption(p.id, p.name, p.email_addresses?.[0])), ...createdPeople],
    [lead, createdPeople],
  );

  async function onSubmit(values: FormValues) {
    const payload: CreateLeadInput = {
      ...values,
      owner: values.owner === OWNER_NONE ? null : values.owner || null,
      company_id: values.company_id || null,
      target_service: values.target_service || null,
      sector: values.sector || null,
      source: values.source || null,
      person_ids: values.person_ids ?? [],
    };
    try {
      if (isEdit && lead) {
        await update.mutateAsync({ id: lead.id, data: payload });
        toast.success('Lead actualizado');
      } else {
        await create.mutateAsync(payload);
        toast.success('Lead creado');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(`No se pudo guardar: ${apiErrorMessage(err)}`);
    }
  }

  function onInvalid(errs: FieldErrors<FormValues>) {
    const labels: Record<string, string> = {
      company: 'Nombre del lead',
      stage_id: 'Etapa',
      estimated_value: 'Valor estimado',
      target_service: 'Servicio objetivo',
      sector: 'Sector',
      source: 'Fuente',
    };
    const first = Object.keys(errs)[0] as keyof FormValues | undefined;
    toast.error(
      first
        ? `Revisa "${labels[first] ?? first}": ${errs[first]?.message ?? 'valor inválido'}`
        : 'Hay campos inválidos en el formulario',
    );
  }

  async function onDelete() {
    if (!lead) return;
    const ok = await confirm({
      title: `¿Borrar el lead "${lead.company}"?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(lead.id);
      toast.success('Lead borrado');
      onOpenChange(false);
    } catch (err) {
      toast.error(`No se pudo borrar: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar lead' : 'Nuevo lead'}</DialogTitle>
            <DialogDescription>{isEdit ? 'Actualiza la información del negocio.' : 'Agrega un negocio al pipeline.'}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-3">
            <Field label="Nombre del lead *" error={errors.company?.message}>
              <Input placeholder="Persona o empresa" {...register('company')} />
            </Field>

            {!isEdit ? (
              // La etapa se elige solo al crear: moverlo después se hace arrastrando en el tablero
              // (así el servidor registra el evento de cambio de etapa).
              <Field label="Etapa" error={errors.stage_id?.message}>
                <Controller
                  control={control}
                  name="stage_id"
                  render={({ field }) => (
                    <PillSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={orderedStages.map((s) => ({ value: s.id, label: s.name }))}
                      searchable={false}
                      className="w-full justify-between"
                    />
                  )}
                />
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsable">
                <Controller
                  control={control}
                  name="owner"
                  render={({ field }) => {
                    const current = field.value && field.value !== OWNER_NONE ? normalizeMemberId(field.value) : '';
                    // El responsable actual sigue siendo seleccionable aunque esté inactivo.
                    const extra =
                      current && !activeMembers.some((m) => m.id === current) ? [{ id: current, name: resolveMemberName(field.value) }] : [];
                    return (
                      <PillSelect
                        value={current || OWNER_NONE}
                        onChange={field.onChange}
                        options={[
                          { value: OWNER_NONE, label: 'Sin asignar' },
                          ...[...activeMembers, ...extra].map((o) => ({ value: o.id, label: o.name })),
                        ]}
                        placeholder="Sin asignar"
                        className="w-full justify-between"
                      />
                    );
                  }}
                />
              </Field>
              <Field label={`Valor estimado (${CRM_CURRENCY})`} error={errors.estimated_value?.message}>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="3000000"
                  {...register('estimated_value', {
                    setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                  })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Servicio objetivo">
                <OptionCombobox control={control} name="target_service" options={LEAD_SERVICES} />
              </Field>
              <Field label="Sector">
                <OptionCombobox control={control} name="sector" options={LEAD_SECTORS} />
              </Field>
            </div>

            <Field label="Fuente">
              <OptionCombobox control={control} name="source" options={LEAD_SOURCES} />
            </Field>

            <Field label="Empresa asociada">
              <Controller
                control={control}
                name="company_id"
                render={({ field }) => (
                  <Combobox
                    value={field.value ?? null}
                    onChange={field.onChange}
                    options={companies.map((c) => companyOption(c.id, c.name, c.domain))}
                    knownOptions={knownCompanies}
                    onSearch={setCompanyQ}
                    loading={companiesLoading}
                    placeholder="Ninguna"
                    searchPlaceholder="Buscar empresa…"
                    noneLabel="Ninguna"
                    onCreate={() => setCompanyCreateOpen(true)}
                    createLabel="Crear empresa"
                  />
                )}
              />
            </Field>

            <Field label="Personas asociadas">
              <Controller
                control={control}
                name="person_ids"
                render={({ field }) => (
                  <MultiCombobox
                    values={field.value ?? []}
                    onChange={field.onChange}
                    options={people.map((p) => personOption(p.id, p.name, p.email_addresses?.[0]))}
                    knownOptions={knownPeople}
                    onSearch={setPersonQ}
                    loading={peopleLoading}
                    placeholder="Agregar persona…"
                    searchPlaceholder="Buscar persona…"
                    onCreate={() => setPersonCreateOpen(true)}
                    createLabel="Crear persona"
                  />
                )}
              />
            </Field>

            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Borrar
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Guardar' : 'Crear lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CompanyDialog
        open={companyCreateOpen}
        onOpenChange={setCompanyCreateOpen}
        onCreated={(c) => setValue('company_id', c.id, { shouldDirty: true })}
      />
      <PersonDialog
        open={personCreateOpen}
        onOpenChange={setPersonCreateOpen}
        defaultCompanyId={companyId ?? null}
        onCreated={(p) => {
          setCreatedPeople((prev) => [...prev, personOption(p.id, p.name, p.email_addresses?.[0])]);
          setValue('person_ids', [...personIds, p.id], { shouldDirty: true });
        }}
      />
    </>
  );
}

function companyOption(id: string, name: string, domain?: string | null): ComboOption {
  return { value: id, label: name, sub: domain ?? undefined, icon: <Building2 className="h-4 w-4 text-muted-foreground" /> };
}

function personOption(id: string, name: string, email?: string): ComboOption {
  return { value: id, label: name, sub: email, icon: <User className="h-4 w-4 text-muted-foreground" /> };
}

/** Un valor guardado que no está en la lista sugerida sigue apareciendo como opción (no se pierde). */
function withCurrent(options: readonly string[], value?: string | null): string[] {
  if (value && !options.includes(value)) return [value, ...options];
  return [...options];
}

/** Combobox buscable sobre una lista sugerida; permite escribir un valor propio (los campos son texto libre). */
function OptionCombobox({
  control,
  name,
  options,
}: {
  control: Control<FormValues>;
  name: 'target_service' | 'sector' | 'source';
  options: readonly string[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Combobox
          value={field.value ?? null}
          onChange={field.onChange}
          options={withCurrent(options, field.value).map((o) => ({ value: o, label: o }))}
          placeholder="Sin especificar"
          searchPlaceholder="Buscar o escribir…"
          noneLabel="Sin especificar"
          allowCustom
        />
      )}
    />
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function blankValues(stageId: string): FormValues {
  return {
    company: '',
    stage_id: stageId,
    target_service: '',
    sector: '',
    source: '',
    estimated_value: null,
    owner: OWNER_NONE,
    company_id: null,
    person_ids: [],
  };
}

function leadToValues(lead: Lead): FormValues {
  return {
    company: lead.company,
    stage_id: lead.stage_id,
    target_service: lead.target_service ?? '',
    sector: lead.sector ?? '',
    source: lead.source ?? '',
    estimated_value: lead.estimated_value,
    owner: lead.owner ?? OWNER_NONE,
    company_id: lead.company_id ?? null,
    person_ids: lead.person_ids ?? [],
  };
}

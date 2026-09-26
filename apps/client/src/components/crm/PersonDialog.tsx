import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2, Loader2, Trash2 } from 'lucide-react';
import {
  CreatePersonSchema,
  DATA_SOURCES,
  DATA_SOURCE_LABELS,
  LEAD_SECTORS,
  type CreatePersonInput,
  type Person,
} from '@crm/shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PillSelect } from '@/components/common/PillSelect';
import { Combobox, type ComboOption } from '@/components/ui/combobox';
import { useCompanies, useCompany, useCreatePerson, useUpdatePerson, useDeletePerson } from '@/hooks/useCrm';
import { useConfirm } from '@/components/ConfirmDialog';
import { apiErrorMessage } from '@/lib/api';
import { EmailListInput } from './EmailListInput';
import { PhoneListInput } from './PhoneListInput';
import { CompanyDialog } from './CompanyDialog';

export interface PersonDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Con persona edita; sin ella crea. */
  person?: Person | null;
  /** Empresa preseleccionada al crear (p. ej. desde el perfil de una empresa). */
  defaultCompanyId?: string | null;
  onCreated?: (person: Person) => void;
}

const CONTACT_STATUS_OPTIONS = [
  { value: 'CONTACTAR', label: 'Contactar' },
  { value: 'NO_CONTACTAR', label: 'No contactar' },
  { value: 'DE_BAJA', label: 'De baja' },
];

export function PersonDialog({ open, onOpenChange, person, defaultCompanyId, onCreated }: PersonDialogProps) {
  const isEdit = Boolean(person);
  // Búsqueda contra el servidor: el catálogo de empresas no cabe en una página.
  const [companyQ, setCompanyQ] = useState('');
  const { data: companiesData, isFetching: companiesLoading } = useCompanies({ q: companyQ, limit: 50 }, open);
  const companies = companiesData?.items ?? [];
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const del = useDeletePerson();
  const confirm = useConfirm();
  const [companyCreateOpen, setCompanyCreateOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePersonInput>({ resolver: zodResolver(CreatePersonSchema), defaultValues: blank(defaultCompanyId) });

  useEffect(() => {
    if (open) reset(person ? toValues(person) : blank(defaultCompanyId));
  }, [open, person, defaultCompanyId, reset]);

  // La empresa ya asociada puede quedar fuera de la búsqueda activa; se pasa
  // aparte para que el selector siga mostrando su nombre y no el UUID.
  const companyId = watch('company_id');
  const { data: selectedCompany } = useCompany(companyId ?? undefined);
  const knownCompanies = useMemo<ComboOption[]>(
    () => (selectedCompany ? [companyOption(selectedCompany.id, selectedCompany.name, selectedCompany.domain)] : []),
    [selectedCompany],
  );

  async function onSubmit(values: CreatePersonInput) {
    const payload: CreatePersonInput = {
      ...values,
      email_addresses: (values.email_addresses ?? []).map((e) => e.trim()).filter(Boolean),
      phone_numbers: (values.phone_numbers ?? []).filter(Boolean),
      company_id: values.company_id || null,
      job_title: nullIfEmpty(values.job_title),
      description: nullIfEmpty(values.description),
      industry: nullIfEmpty(values.industry),
      primary_location: nullIfEmpty(values.primary_location),
      source: nullIfEmpty(values.source),
      linkedin: nullIfEmpty(values.linkedin),
      instagram: nullIfEmpty(values.instagram),
      facebook: nullIfEmpty(values.facebook),
      twitter: nullIfEmpty(values.twitter),
    };
    try {
      if (isEdit && person) {
        await update.mutateAsync({ id: person.id, data: payload });
        toast.success('Persona actualizada');
      } else {
        const created = await create.mutateAsync(payload);
        toast.success('Persona creada');
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(`No se pudo guardar: ${apiErrorMessage(err)}`);
    }
  }

  function onInvalid() {
    toast.error('Revisa los datos: el nombre es obligatorio y correos y teléfonos deben ser válidos.');
  }

  async function onDelete() {
    if (!person) return;
    const ok = await confirm({
      title: `¿Borrar a "${person.name}"?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(person.id);
      toast.success('Persona borrada');
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
            <DialogTitle>{isEdit ? 'Editar persona' : 'Nueva persona'}</DialogTitle>
            <DialogDescription>Datos de contacto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *" error={errors.name?.message}>
                <Input {...register('name')} />
              </Field>
              <Field label="Cargo" error={errors.job_title?.message}>
                <Input placeholder="Gerente comercial" {...register('job_title')} />
              </Field>
            </div>

            <Field label="Correos" error={errors.email_addresses?.message as string | undefined}>
              <Controller
                control={control}
                name="email_addresses"
                render={({ field }) => <EmailListInput values={field.value ?? []} onChange={field.onChange} />}
              />
            </Field>
            <Field label="Teléfonos" error={errors.phone_numbers?.message as string | undefined}>
              <Controller
                control={control}
                name="phone_numbers"
                render={({ field }) => <PhoneListInput values={field.value ?? []} onChange={field.onChange} />}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Empresa">
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
                      placeholder="Sin empresa"
                      searchPlaceholder="Buscar empresa…"
                      noneLabel="Sin empresa"
                      onCreate={() => setCompanyCreateOpen(true)}
                      createLabel="Crear empresa"
                    />
                  )}
                />
              </Field>
              <Field label="Ubicación" error={errors.primary_location?.message}>
                <Input placeholder="Ciudad" {...register('primary_location')} />
              </Field>
              <Field label="Industria">
                <Controller
                  control={control}
                  name="industry"
                  render={({ field }) => (
                    <Combobox
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? '')}
                      options={LEAD_SECTORS.map((s) => ({ value: s, label: s }))}
                      placeholder={companyId ? 'Hereda la de la empresa' : 'Selecciona una industria…'}
                      searchPlaceholder="Buscar o escribir industria…"
                      noneLabel="Sin industria"
                      allowCustom
                    />
                  )}
                />
              </Field>
              <Field label="Origen del dato">
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <Combobox
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? '')}
                      options={DATA_SOURCES.map((s) => ({ value: s, label: DATA_SOURCE_LABELS[s] ?? s }))}
                      placeholder="Sin origen"
                      searchPlaceholder="Buscar o escribir origen…"
                      noneLabel="Sin origen"
                      allowCustom
                    />
                  )}
                />
              </Field>
            </div>

            <Field label="Estado de contacto">
              <Controller
                control={control}
                name="contact_status"
                render={({ field }) => (
                  <>
                    <PillSelect
                      value={field.value ?? 'CONTACTAR'}
                      onChange={field.onChange}
                      options={CONTACT_STATUS_OPTIONS}
                      searchable={false}
                      className="w-full justify-between"
                    />
                    {field.value === 'DE_BAJA' ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Bloqueada para envíos (baja, rebote o spam). El sistema lo marca solo; cambiarlo a otro estado la libera para volver
                        a contactar.
                      </p>
                    ) : null}
                  </>
                )}
              />
            </Field>

            <Field label="Descripción" error={errors.description?.message}>
              <Textarea rows={2} {...register('description')} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="LinkedIn">
                <Input {...register('linkedin')} />
              </Field>
              <Field label="Instagram">
                <Input {...register('instagram')} />
              </Field>
              <Field label="Twitter / X">
                <Input {...register('twitter')} />
              </Field>
              <Field label="Facebook">
                <Input {...register('facebook')} />
              </Field>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Borrar
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Guardar' : 'Crear'}
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
    </>
  );
}

function companyOption(id: string, name: string, domain?: string | null): ComboOption {
  return { value: id, label: name, sub: domain ?? undefined, icon: <Building2 className="h-4 w-4 text-muted-foreground" /> };
}

function nullIfEmpty(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
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

// Los inputs de texto trabajan con '' (nunca null) para que react-hook-form los
// considere controlados; en el payload se convierten a null.
function blank(companyId?: string | null): CreatePersonInput {
  return {
    name: '',
    contact_status: 'CONTACTAR',
    email_addresses: [],
    phone_numbers: [],
    job_title: '',
    description: '',
    company_id: companyId ?? null,
    source: '',
    industry: '',
    primary_location: '',
    linkedin: '',
    instagram: '',
    twitter: '',
    facebook: '',
  };
}

function toValues(p: Person): CreatePersonInput {
  return {
    name: p.name,
    contact_status: p.contact_status,
    email_addresses: p.email_addresses ?? [],
    phone_numbers: p.phone_numbers ?? [],
    job_title: p.job_title ?? '',
    description: p.description ?? '',
    company_id: p.company_id ?? null,
    source: p.source ?? '',
    industry: p.industry ?? '',
    primary_location: p.primary_location ?? '',
    linkedin: p.linkedin ?? '',
    instagram: p.instagram ?? '',
    twitter: p.twitter ?? '',
    facebook: p.facebook ?? '',
  };
}

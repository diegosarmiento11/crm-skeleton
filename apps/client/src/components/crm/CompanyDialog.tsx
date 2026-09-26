import { useEffect, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import {
  CreateCompanySchema,
  DATA_SOURCES,
  DATA_SOURCE_LABELS,
  LEAD_SECTORS,
  type Company,
  type CreateCompanyInput,
} from '@crm/shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PillSelect } from '@/components/common/PillSelect';
import { Combobox } from '@/components/ui/combobox';
import { useCreateCompany, useUpdateCompany, useDeleteCompany } from '@/hooks/useCrm';
import { useConfirm } from '@/components/ConfirmDialog';
import { apiErrorMessage } from '@/lib/api';
import { EmailListInput } from './EmailListInput';
import { PhoneListInput } from './PhoneListInput';

export interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Con empresa edita; sin ella crea. */
  company?: Company | null;
  onCreated?: (company: Company) => void;
}

const CONTACT_STATUS_OPTIONS = [
  { value: 'CONTACTAR', label: 'Contactar' },
  { value: 'NO_CONTACTAR', label: 'No contactar' },
  { value: 'DE_BAJA', label: 'De baja' },
];

export function CompanyDialog({ open, onOpenChange, company, onCreated }: CompanyDialogProps) {
  const isEdit = Boolean(company);
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const del = useDeleteCompany();
  const confirm = useConfirm();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyInput>({ resolver: zodResolver(CreateCompanySchema), defaultValues: blank() });

  // Se reinicia al abrir o al cambiar de empresa, no en cada refetch en segundo plano.
  useEffect(() => {
    if (open) reset(company ? toValues(company) : blank());
  }, [open, company, reset]);

  async function onSubmit(values: CreateCompanyInput) {
    const payload: CreateCompanyInput = {
      ...values,
      email_addresses: (values.email_addresses ?? []).map((e) => e.trim()).filter(Boolean),
      phone_numbers: (values.phone_numbers ?? []).filter(Boolean),
      domain: nullIfEmpty(values.domain),
      description: nullIfEmpty(values.description),
      industry: nullIfEmpty(values.industry),
      primary_location: nullIfEmpty(values.primary_location),
      linkedin: nullIfEmpty(values.linkedin),
      instagram: nullIfEmpty(values.instagram),
      facebook: nullIfEmpty(values.facebook),
      twitter: nullIfEmpty(values.twitter),
      source: nullIfEmpty(values.source),
    };
    try {
      if (isEdit && company) {
        await update.mutateAsync({ id: company.id, data: payload });
        toast.success('Empresa actualizada');
      } else {
        const created = await create.mutateAsync(payload);
        toast.success('Empresa creada');
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
    if (!company) return;
    const ok = await confirm({
      title: `¿Borrar la empresa "${company.name}"?`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(company.id);
      toast.success('Empresa borrada');
      onOpenChange(false);
    } catch (err) {
      toast.error(`No se pudo borrar: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
          <DialogDescription>Datos de la empresa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-3">
          <Field label="Nombre *" error={errors.name?.message}>
            <Input placeholder="Nombre de la empresa" {...register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sitio / dominio" error={errors.domain?.message}>
              <Input placeholder="empresa.com" {...register('domain')} />
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
                    options={optionsFrom(LEAD_SECTORS)}
                    placeholder="Selecciona una industria…"
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
                      Bloqueada para envíos (baja, rebote o spam). Cambiarla a otro estado la libera para volver a contactar.
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
  );
}

function optionsFrom(values: readonly string[]) {
  return values.map((v) => ({ value: v, label: v }));
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
function blank(): CreateCompanyInput {
  return {
    name: '',
    contact_status: 'CONTACTAR',
    email_addresses: [],
    phone_numbers: [],
    domain: '',
    primary_location: '',
    industry: '',
    source: '',
    description: '',
    linkedin: '',
    instagram: '',
    twitter: '',
    facebook: '',
  };
}

function toValues(c: Company): CreateCompanyInput {
  return {
    name: c.name,
    contact_status: c.contact_status,
    email_addresses: c.email_addresses ?? [],
    phone_numbers: c.phone_numbers ?? [],
    domain: c.domain ?? '',
    primary_location: c.primary_location ?? '',
    industry: c.industry ?? '',
    source: c.source ?? '',
    description: c.description ?? '',
    linkedin: c.linkedin ?? '',
    instagram: c.instagram ?? '',
    twitter: c.twitter ?? '',
    facebook: c.facebook ?? '',
  };
}

import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, ExternalLink, Plus } from 'lucide-react';
import { normalizeDomain, sourceLabel } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { useConfirm } from '@/components/ConfirmDialog';
import { useCompany, useDeleteCompany, useStages } from '@/hooks/useCrm';
import { apiErrorMessage } from '@/lib/api';
import { fullDate, linkExternal } from '@/lib/crm';
import { formatPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { CompanyDialog } from './CompanyDialog';
import { PersonDialog } from './PersonDialog';
import { ActivityFeed } from './ActivityFeed';
import { AssociatedDeals } from './AssociatedDeals';
import {
  ContactStatusBadge,
  CopyableList,
  Dash,
  EntityIcon,
  Field,
  FieldList,
  ProfileError,
  ProfileFrame,
  ProfileLoading,
  ProfileSection,
  SocialLinks,
  TagBadge,
  type ProfileNav,
} from './ProfileShared';

export function ProfileCompany({ id, nav }: { id: string; nav: ProfileNav }) {
  const { data: company, isLoading, error } = useCompany(id);
  const { data: stagesData } = useStages();
  const del = useDeleteCompany();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);

  async function onDelete() {
    if (!company) return;
    const ok = await confirm({
      title: `Borrar la empresa "${company.name}"`,
      description: 'Las personas y negocios asociados quedan sin empresa. Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(company.id);
      toast.success('Empresa borrada');
      nav.close();
    } catch (err) {
      toast.error(`No se pudo borrar: ${apiErrorMessage(err)}`);
    }
  }

  const subtitle = company ? [company.industry, company.primary_location].filter(Boolean).join(' · ') || `Empresa · creada el ${fullDate(company.created_at)}` : 'Cargando la empresa';
  const domain = company ? normalizeDomain(company.domain) : null;

  return (
    <ProfileFrame
      title={company?.name ?? 'Empresa'}
      subtitle={subtitle}
      icon={<EntityIcon icon={Building2} />}
      badges={company ? <ContactStatusBadge status={company.contact_status} /> : null}
      nav={nav}
      onEdit={company ? () => setEditing(true) : undefined}
      onDelete={company ? onDelete : undefined}
      deleting={del.isPending}
      loading={isLoading}
    >
      {error ? <ProfileError message={apiErrorMessage(error)} /> : null}
      {isLoading || !company ? (
        !error ? <ProfileLoading /> : null
      ) : (
        <Tabs defaultValue="summary">
          <TabsList aria-label="Secciones de la empresa">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4 space-y-5">
            <FieldList>
              <Field label="Dominio">
                {domain ? (
                  <a href={`https://${domain}`} target="_blank" rel="noreferrer" className={cn(linkExternal, 'inline-flex items-center gap-1 break-all')}>
                    {domain} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Industria">{company.industry || <Dash />}</Field>
              <Field label="Ubicación">{company.primary_location || <Dash />}</Field>
              <Field label="Correos">
                <CopyableList values={company.email_addresses} />
              </Field>
              <Field label="Teléfonos">
                <CopyableList values={company.phone_numbers} format={formatPhone} />
              </Field>
              <Field label="Origen">
                <TagBadge value={company.source ? sourceLabel(company.source) : null} />
              </Field>
              <Field label="Redes">
                <SocialLinks record={company} />
              </Field>
              {company.description ? (
                <Field label="Descripción">
                  <p className="whitespace-pre-wrap text-muted-foreground">{company.description}</p>
                </Field>
              ) : null}
            </FieldList>

            <ProfileSection
              title={`Personas (${company.people.length})`}
              action={
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingPerson(true)}>
                  <Plus className="h-3.5 w-3.5" /> Añadir persona
                </Button>
              }
            >
              {company.people.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">Sin personas. Añade el primer contacto de esta empresa.</p>
              ) : (
                <ul className="space-y-1.5">
                  {company.people.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => nav.openPerson(p.id)}
                        className="flex w-full items-center gap-2 rounded-xl border border-border p-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <MemberAvatar name={p.name} seed={p.id} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          {p.job_title ? <span className="block truncate text-[11px] text-muted-foreground">{p.job_title}</span> : null}
                        </span>
                        {p.email_addresses[0] ? <span className="hidden max-w-[45%] truncate text-[11px] text-muted-foreground sm:block">{p.email_addresses[0]}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ProfileSection>

            <ProfileSection title={`Negocios (${company.leads.length})`}>
              <AssociatedDeals
                leads={company.leads}
                stages={stagesData?.items ?? []}
                onOpen={nav.openLead}
                emptyHint="Sin negocios. Crea uno en el pipeline y asócialo a esta empresa."
              />
            </ProfileSection>
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityFeed entityType="company" entityId={company.id} />
          </TabsContent>
        </Tabs>
      )}
      {company ? <CompanyDialog open={editing} onOpenChange={setEditing} company={company} /> : null}
      {company ? <PersonDialog open={addingPerson} onOpenChange={setAddingPerson} defaultCompanyId={company.id} /> : null}
    </ProfileFrame>
  );
}

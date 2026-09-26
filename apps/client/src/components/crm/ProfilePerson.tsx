import { useState } from 'react';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import { sourceLabel } from '@crm/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { useConfirm } from '@/components/ConfirmDialog';
import { useDeletePerson, usePerson, useStages } from '@/hooks/useCrm';
import { apiErrorMessage } from '@/lib/api';
import { fullDate } from '@/lib/crm';
import { formatPhone } from '@/lib/phone';
import { PersonDialog } from './PersonDialog';
import { ActivityFeed } from './ActivityFeed';
import { AssociatedDeals } from './AssociatedDeals';
import {
  ContactStatusBadge,
  CopyableList,
  Dash,
  Field,
  FieldList,
  ProfileError,
  ProfileFrame,
  ProfileLink,
  ProfileLoading,
  ProfileSection,
  SocialLinks,
  TagBadge,
  type ProfileNav,
} from './ProfileShared';

export function ProfilePerson({ id, nav }: { id: string; nav: ProfileNav }) {
  const { data: person, isLoading, error } = usePerson(id);
  const { data: stagesData } = useStages();
  const del = useDeletePerson();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  async function onDelete() {
    if (!person) return;
    const ok = await confirm({
      title: `Borrar a "${person.name}"`,
      description: 'Se borrarán también sus notas y tareas. Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(person.id);
      toast.success('Persona borrada');
      nav.close();
    } catch (err) {
      toast.error(`No se pudo borrar: ${apiErrorMessage(err)}`);
    }
  }

  const subtitle = person ? [person.job_title, person.company?.name].filter(Boolean).join(' · ') || `Persona · creada el ${fullDate(person.created_at)}` : 'Cargando la persona';
  // Con empresa asociada se muestra la industria heredada; la propia es un respaldo.
  const industry = person?.company?.industry ?? person?.industry ?? null;

  return (
    <ProfileFrame
      title={person?.name ?? 'Persona'}
      subtitle={subtitle}
      icon={<MemberAvatar name={person?.name ?? '?'} seed={id} size="lg" className="h-10 w-10 text-sm" />}
      badges={person ? <ContactStatusBadge status={person.contact_status} /> : null}
      nav={nav}
      onEdit={person ? () => setEditing(true) : undefined}
      onDelete={person ? onDelete : undefined}
      deleting={del.isPending}
      loading={isLoading}
    >
      {error ? <ProfileError message={apiErrorMessage(error)} /> : null}
      {isLoading || !person ? (
        !error ? <ProfileLoading /> : null
      ) : (
        <Tabs defaultValue="summary">
          <TabsList aria-label="Secciones de la persona">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4 space-y-5">
            <FieldList>
              <Field label="Cargo">{person.job_title || <Dash />}</Field>
              <Field label="Empresa">
                {person.company ? (
                  <ProfileLink onClick={() => nav.openCompany(person.company!.id)}>
                    <Building2 className="h-3 w-3" /> {person.company.name}
                  </ProfileLink>
                ) : (
                  <span className="text-muted-foreground">Sin empresa. Edita la persona para enlazarla.</span>
                )}
              </Field>
              <Field label="Correos">
                <CopyableList values={person.email_addresses} />
              </Field>
              <Field label="Teléfonos">
                <CopyableList values={person.phone_numbers} format={formatPhone} />
              </Field>
              <Field label="Ubicación">{person.primary_location || <Dash />}</Field>
              <Field label="Industria">
                {industry ? (
                  <span>
                    {industry}
                    {person.company?.industry ? <span className="text-xs text-muted-foreground"> · heredada de la empresa</span> : null}
                  </span>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Origen">
                <TagBadge value={person.source ? sourceLabel(person.source) : null} />
              </Field>
              <Field label="Redes">
                <SocialLinks record={person} />
              </Field>
              {person.description ? (
                <Field label="Descripción">
                  <p className="whitespace-pre-wrap text-muted-foreground">{person.description}</p>
                </Field>
              ) : null}
            </FieldList>

            <ProfileSection title="Negocios asociados">
              <AssociatedDeals
                leads={person.leads}
                stages={stagesData?.items ?? []}
                onOpen={nav.openLead}
                emptyHint="Sin negocios. Crea uno en el pipeline y asocia a esta persona como contacto."
              />
            </ProfileSection>
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityFeed entityType="person" entityId={person.id} />
          </TabsContent>
        </Tabs>
      )}
      {person ? <PersonDialog open={editing} onOpenChange={setEditing} person={person} /> : null}
    </ProfileFrame>
  );
}

import type { ComponentType, ReactNode } from 'react';
import { ChevronLeft, ExternalLink, Loader2, Pencil, Trash2, X } from 'lucide-react';
import type { ContactStatus, PipelineStage } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { CopyText } from '@/components/ui/copy-button';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { HEALTH_META, linkExternal, ownerName, stageColor, tagColor } from '@/lib/crm';
import { cn } from '@/lib/utils';

// Piezas comunes de los tres perfiles (lead, persona, empresa). Viven aparte para
// que cada perfil sea solo su contenido y todos se vean iguales.

/** Navegación del panel: la pila de perfiles la maneja CrmProfilesProvider. */
export interface ProfileNav {
  canGoBack: boolean;
  back: () => void;
  close: () => void;
  openLead: (id: string) => void;
  openPerson: (id: string) => void;
  openCompany: (id: string) => void;
}

interface FrameProps {
  title: string;
  /** Texto breve bajo el título (también es la descripción accesible del panel). */
  subtitle: string;
  icon: ReactNode;
  badges?: ReactNode;
  nav: ProfileNav;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  loading?: boolean;
  children: ReactNode;
}

/** Cabecera fija (volver · identidad · editar/borrar/cerrar) + cuerpo con scroll. */
export function ProfileFrame({ title, subtitle, icon, badges, nav, onEdit, onDelete, deleting, loading, children }: FrameProps) {
  return (
    <>
      <header className="flex items-start gap-3 border-b border-border px-4 py-4 md:px-5">
        {nav.canGoBack ? (
          <Button type="button" variant="ghost" size="icon" className="-ml-2 h-8 w-8 shrink-0" onClick={nav.back} aria-label="Volver al perfil anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <span className="mt-0.5 shrink-0" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate text-lg leading-tight">{title}</SheetTitle>
          <SheetDescription className="truncate text-xs">{subtitle}</SheetDescription>
          {badges ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={loading} className="hidden sm:inline-flex">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          ) : null}
          {onEdit ? (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={onEdit} disabled={loading} aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              disabled={loading || deleting}
              aria-label="Borrar"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={nav.close} aria-label="Cerrar panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>
    </>
  );
}

export function ProfileLoading() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}

export function ProfileError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      No se pudo cargar el registro: {message}. Cierra el panel y vuelve a abrirlo.
    </p>
  );
}

/** Icono redondo de cabecera (lead/empresa). */
export function EntityIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function ProfileSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Lista de campos etiqueta/valor (definición semántica, alineada en dos columnas). */
export function FieldList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-border rounded-xl border border-border">{children}</dl>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 text-sm">
      <dt className="w-32 shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children ?? <Dash />}</dd>
    </div>
  );
}

export function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

/** Botón con aspecto de enlace interno (abre otro perfil dentro del panel). */
export function ProfileLink({ onClick, children, className }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md text-left underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TagBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <Dash />;
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tagColor(value))}>{value}</span>;
}

export function StageBadge({ stage }: { stage: PipelineStage | undefined }) {
  const c = stageColor(stage?.color);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', c.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} aria-hidden />
      {stage?.name ?? 'Sin etapa'}
    </span>
  );
}

export function HealthBadge({ band, reason }: { band: string | null | undefined; reason?: string | null }) {
  if (!band) return null;
  const meta = HEALTH_META[band];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs" title={reason ?? undefined}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

const CONTACT_STATUS: Record<ContactStatus, { label: string; className: string }> = {
  CONTACTAR: { label: 'Se puede contactar', className: 'border-border text-muted-foreground' },
  NO_CONTACTAR: { label: 'No contactar', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
  DE_BAJA: { label: 'De baja', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const meta = CONTACT_STATUS[status];
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', meta.className)}>{meta.label}</span>;
}

export function OwnerChip({ owner }: { owner: string | null | undefined }) {
  if (!owner) return <span className="text-destructive">Sin responsable</span>;
  const name = ownerName(owner);
  return (
    <span className="inline-flex items-center gap-1.5">
      <MemberAvatar name={name} seed={owner} size="sm" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Correos/teléfonos en columna; clic en cualquiera lo copia. */
export function CopyableList({ values, format }: { values: string[]; format?: (v: string) => string }) {
  if (!values.length) return <Dash />;
  return (
    <div className="space-y-0.5">
      {values.map((v) => (
        <CopyText key={v} value={v} display={format ? format(v) : v} className="block break-all text-left" />
      ))}
    </div>
  );
}

interface SocialRecord {
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
}

/** Acepta un usuario o una URL: sin protocolo se asume https. */
function toHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`;
}

export function SocialLinks({ record }: { record: SocialRecord }) {
  const candidates: [string, string | null][] = [
    ['LinkedIn', record.linkedin],
    ['Instagram', record.instagram],
    ['Facebook', record.facebook],
    ['X', record.twitter],
  ];
  const items = candidates.filter((e): e is [string, string] => Boolean(e[1]));
  if (!items.length) return <Dash />;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(([label, value]) => (
        <a key={label} href={toHref(value)} target="_blank" rel="noreferrer" className={cn(linkExternal, 'inline-flex items-center gap-1 text-sm')}>
          {label} <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

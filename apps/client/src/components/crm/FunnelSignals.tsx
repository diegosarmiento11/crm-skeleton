import { CalendarClock, Factory, MapPin, PauseCircle, ShieldAlert } from 'lucide-react';
import type { CrmInsights, IcpRow, OverdueTask, SignalLead } from '@crm/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import type { CrmEntity } from '@/hooks/useCrm';
import { formatMoneyShort, ownerName } from '@/lib/crm';
import { pct } from '@/pages/crm/funnelLogic';
import { CardTitleRow, InfoTip } from './FunnelCards';

export interface OpenProfile {
  (type: CrmEntity, id: string): void;
}

const ROW_CLS =
  'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function LeadSignalList({ items, onOpen, emptyHint }: { items: SignalLead[]; onOpen: OpenProfile; emptyHint: string }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{emptyHint}</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onOpen('lead', s.id)} className={ROW_CLS}>
            <MemberAvatar name={ownerName(s.owner)} seed={s.owner ?? 'none'} size="sm" />
            <span className="min-w-0 flex-1 truncate">{s.company}</span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">{s.reason}</span>
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-destructive">{s.days} d</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function isEntity(v: string | null): v is CrmEntity {
  return v === 'lead' || v === 'person' || v === 'company';
}

function OverdueList({ items, onOpen }: { items: OverdueTask[]; onOpen: OpenProfile }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">Sin tareas vencidas. Las tareas con fecha pasada aparecerán aquí.</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((t) => {
        const canOpen = isEntity(t.entity_type) && t.entity_id;
        const content = (
          <>
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {t.title}
              {t.entity_label ? <span className="text-xs text-muted-foreground"> · {t.entity_label}</span> : null}
            </span>
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-destructive">
              hace {t.days_overdue} d
            </span>
          </>
        );
        return (
          <li key={t.id}>
            {canOpen ? (
              <button type="button" onClick={() => onOpen(t.entity_type as CrmEntity, t.entity_id as string)} className={ROW_CLS}>
                {content}
              </button>
            ) : (
              <div className={ROW_CLS}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Señales operativas: qué atender hoy. Clic abre el perfil correspondiente. */
export function FunnelSignals({ signals, onOpen }: { signals: CrmInsights['signals']; onOpen: OpenProfile }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardContent className="relative p-4">
          <InfoTip label="En riesgo">Leads abiertos con salud en riesgo: sin responsable, sin actividad reciente o demasiado tiempo en la etapa.</InfoTip>
          <CardTitleRow icon={ShieldAlert}>
            En riesgo
            {signals.at_risk.length > 0 ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{signals.at_risk.length}</span> : null}
          </CardTitleRow>
          <LeadSignalList items={signals.at_risk} onOpen={onOpen} emptyHint="Ningún lead en riesgo. Mantén un responsable y actividad reciente en cada uno." />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="relative p-4">
          <InfoTip label="Estancados">Leads abiertos que llevan demasiados días sin cambiar de etapa.</InfoTip>
          <CardTitleRow icon={PauseCircle}>
            Estancados
            {signals.stuck.length > 0 ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{signals.stuck.length}</span> : null}
          </CardTitleRow>
          <LeadSignalList items={signals.stuck} onOpen={onOpen} emptyHint="Ningún lead estancado. Los que no avanzan de etapa aparecerán aquí." />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="relative p-4">
          <InfoTip label="Tareas vencidas">Tareas pendientes cuya fecha límite ya pasó, en cualquier registro del CRM.</InfoTip>
          <CardTitleRow icon={CalendarClock}>
            Tareas vencidas
            {signals.overdue_tasks.length > 0 ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{signals.overdue_tasks.length}</span> : null}
          </CardTitleRow>
          <OverdueList items={signals.overdue_tasks} onOpen={onOpen} />
        </CardContent>
      </Card>
    </div>
  );
}

function IcpTable({ rows }: { rows: IcpRow[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <Table className="min-w-[380px]">
        <TableHeader>
          <TableRow>
            <TableHead>Segmento</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Ganados</TableHead>
            <TableHead className="text-right">Win</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="max-w-[180px] truncate">{r.key}</TableCell>
              <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
              <TableCell className="text-right tabular-nums">{r.won}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(r.win_rate)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.won_value > 0 ? formatMoneyShort(r.won_value) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** ICP: qué industrias y ciudades convierten mejor (sobre las empresas asociadas a los leads). */
export function FunnelIcp({ industry, city }: { industry: IcpRow[]; city: IcpRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="relative p-4">
          <InfoTip label="ICP por industria">Leads y ganados agrupados por la industria de la empresa asociada. Sirve para saber dónde vale la pena prospectar.</InfoTip>
          <CardTitleRow icon={Factory}>ICP por industria</CardTitleRow>
          {industry.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin datos. Completa la industria de las empresas asociadas a los leads para segmentar.</p>
          ) : (
            <IcpTable rows={industry} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="relative p-4">
          <InfoTip label="ICP por ciudad">Leads y ganados agrupados por la ubicación de la empresa asociada.</InfoTip>
          <CardTitleRow icon={MapPin}>ICP por ciudad</CardTitleRow>
          {city.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin datos. Completa la ubicación de las empresas asociadas a los leads para segmentar.</p>
          ) : (
            <IcpTable rows={city} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

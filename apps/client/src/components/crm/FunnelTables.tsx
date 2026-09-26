import { AlertTriangle, Timer, TrendingDown, Users, XCircle } from 'lucide-react';
import type { FunnelStage, LossRow, OwnerPerformance, PipelineAnalytics, PipelinePerformance } from '@crm/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { formatMoney, formatMoneyShort, ownerName, stageColor } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { days, pct } from '@/pages/crm/funnelLogic';
import { CardTitleRow, InfoTip } from './FunnelCards';

// ─────────────────────────── Por etapa ───────────────────────────

/** Hoy vs alguna vez, conversión y velocidad (edad actual e histórico del log). */
export function FunnelStageTable({ stages }: { stages: FunnelStage[] }) {
  return (
    <Card>
      <CardContent className="relative p-4">
        <InfoTip label="la tabla por etapa">
          "Hoy" son los leads sentados en la etapa ahora; "alguna vez" los que entraron en el periodo. "Días hoy" es la edad promedio de los que están; "histórico" es cuánto
          tardaron en salir los que ya salieron, con cuántas estadías sustentan el promedio.
        </InfoTip>
        <CardTitleRow icon={Timer}>Por etapa</CardTitleRow>
        <div className="-mx-4 overflow-x-auto px-4">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Hoy</TableHead>
                <TableHead className="text-right">Alguna vez</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
                <TableHead className="text-right">Días hoy</TableHead>
                <TableHead className="text-right">Histórico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((s) => {
                const c = stageColor(s.color);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dot)} aria-hidden />
                        {s.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.current_count}
                      {s.current_value > 0 ? <span className="text-xs text-muted-foreground"> · {formatMoneyShort(s.current_value)}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.reached_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.kind === 'LOST' ? '—' : pct(s.conversion_from_prev)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.current_count > 0 ? days(s.avg_days_in_stage) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.hist_avg_days != null ? (
                        <>
                          {days(s.hist_avg_days)} <span className="text-xs text-muted-foreground">({s.hist_n})</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">sin datos aún</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Pérdidas ───────────────────────────

function LossCard({ title, icon, rows, tooltip, emptyHint }: { title: string; icon: typeof XCircle; rows: LossRow[]; tooltip: string; emptyHint: string }) {
  const maxValue = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card>
      <CardContent className="relative p-4">
        <InfoTip label={title}>{tooltip}</InfoTip>
        <CardTitleRow icon={icon}>
          {title}
          {total > 0 ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{formatMoney(total)}</span> : null}
        </CardTitleRow>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => {
              const c = r.color ? stageColor(r.color) : null;
              return (
                <li key={r.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', c ? c.dot : 'bg-destructive/70')} aria-hidden />
                      <span className="truncate text-xs font-medium">{r.key}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">× {r.count}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{r.value > 0 ? formatMoneyShort(r.value) : '—'}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-destructive/70" style={{ width: `${Math.max(3, (r.value / maxValue) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function FunnelLoss({ loss }: { loss: PipelineAnalytics['loss'] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LossCard
        title="Dónde se pierde"
        icon={TrendingDown}
        rows={loss.by_stage}
        tooltip="Leads perdidos agrupados por la etapa en la que estaban al perderse, con su valor estimado. Señala el punto del proceso que más valor deja ir."
        emptyHint="Sin pérdidas en el periodo. Cuando muevas un lead a Perdido aparecerá aquí por etapa."
      />
      <LossCard
        title="Razones de pérdida"
        icon={XCircle}
        rows={loss.reasons}
        tooltip="Por qué se perdieron los negocios. La razón se captura al mover un lead a Perdido en el pipeline."
        emptyHint="Sin razones registradas. Al mover un lead a Perdido, elige la razón para alimentar este reporte."
      />
    </div>
  );
}

// ─────────────────────────── SLA de seguimiento ───────────────────────────

/** Leads que llevan más del umbral en una etapa vigilada sin actividad; clic abre el perfil. */
export function FunnelSla({ sla, onOpenLead }: { sla: PipelineAnalytics['sla']; onOpenLead: (id: string) => void }) {
  const watched = sla.stages.map((s) => s.name).join(' y ');
  return (
    <Card>
      <CardContent className="relative p-4">
        <InfoTip label="el SLA de seguimiento">
          Un lead no debería pasar más de {sla.days} días en {watched || 'las etapas vigiladas'} sin registrar un correo, un WhatsApp o una llamada. Se evalúa sobre los leads
          actuales, sin importar el rango elegido.
        </InfoTip>
        <CardTitleRow icon={AlertTriangle}>
          SLA de seguimiento
          {sla.items.length > 0 ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive">{sla.items.length}</span>
          ) : null}
        </CardTitleRow>
        {sla.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nadie supera los {sla.days} días sin actividad en {watched || 'las etapas vigiladas'}. Sigue registrando cada contacto.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Días en etapa</TableHead>
                  <TableHead className="text-right">Sin actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sla.items.map((b) => (
                  <TableRow key={b.lead_id} onClick={() => onOpenLead(b.lead_id)} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <button type="button" onClick={() => onOpenLead(b.lead_id)} className="rounded-md text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        {b.company}
                      </button>
                    </TableCell>
                    <TableCell>
                      {b.owner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MemberAvatar name={ownerName(b.owner)} seed={b.owner} size="sm" />
                          <span className="truncate">{ownerName(b.owner)}</span>
                        </span>
                      ) : (
                        <span className="text-destructive">Sin responsable</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.stage_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.days_in_stage} d</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{b.days_since_activity != null ? `${b.days_since_activity} d` : 'nunca'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Desempeño por persona ───────────────────────────

/** Con actividad en el periodo o pipeline vivo: las filas de puros «—» son ruido. */
function hasActivity(o: OwnerPerformance): boolean {
  return o.owner != null && (o.prospected > 0 || o.proposals > 0 || o.won > 0 || o.lost > 0 || o.stalled > 0 || o.open_count > 0);
}

function money(v: number | null | undefined): string {
  return v ? formatMoneyShort(v) : '—';
}

function PerfCells({ o }: { o: OwnerPerformance }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{o.prospected || '—'}</TableCell>
      <TableCell className="text-right tabular-nums">{o.proposals || '—'}</TableCell>
      <TableCell className="text-right tabular-nums">{o.won || '—'}</TableCell>
      <TableCell className="text-right tabular-nums">{o.won + o.lost > 0 ? pct(o.win_rate) : '—'}</TableCell>
      <TableCell className="text-right tabular-nums">{money(o.won_value)}</TableCell>
      <TableCell className="text-right tabular-nums">{money(o.avg_ticket)}</TableCell>
      <TableCell className="text-right tabular-nums">{o.won > 0 ? days(o.avg_cycle_days) : '—'}</TableCell>
      <TableCell className="text-right tabular-nums">
        {o.open_count || '—'}
        {o.open_value > 0 ? <span className="text-xs text-muted-foreground"> · {formatMoneyShort(o.open_value)}</span> : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">{money(o.forecast)}</TableCell>
      <TableCell className={cn('text-right tabular-nums', o.stalled > 0 && 'font-medium text-destructive')}>{o.stalled || '—'}</TableCell>
    </>
  );
}

export function FunnelPerformance({ perf }: { perf: PipelinePerformance | undefined }) {
  const owners = (perf?.owners ?? []).filter(hasActivity);
  const stalledDays = perf?.stalled_days ?? 14;
  return (
    <Card>
      <CardContent className="relative p-4">
        <InfoTip label="el desempeño por persona">
          Prospección = leads movidos a {perf?.qualify_stage?.name ?? 'la etapa de calificación'}; Propuestas = movidos a {perf?.proposal_stage?.name ?? 'la etapa de propuesta'}. Se
          atribuye a quien es responsable del lead. Estancados = abiertos sin moverse más de {stalledDays} días.
        </InfoTip>
        <CardTitleRow icon={Users}>Desempeño por persona</CardTitleRow>
        {!perf ? (
          <p className="text-xs text-muted-foreground">Cargando desempeño…</p>
        ) : owners.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin actividad en el periodo. Asigna responsables a los leads y mueve etapas para ver el desempeño de cada persona.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead className="text-right">Prospección</TableHead>
                  <TableHead className="text-right">Propuestas</TableHead>
                  <TableHead className="text-right">Ganados</TableHead>
                  <TableHead className="text-right">Win</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                  <TableHead className="text-right">Ciclo</TableHead>
                  <TableHead className="text-right">Abiertos</TableHead>
                  <TableHead className="text-right">Forecast</TableHead>
                  <TableHead className="text-right">Estancados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((o) => {
                  const name = ownerName(o.owner);
                  return (
                    <TableRow key={o.owner ?? 'none'}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <MemberAvatar name={name} seed={o.owner ?? 'none'} size="sm" />
                          <span className="truncate">{name}</span>
                        </span>
                      </TableCell>
                      <PerfCells o={o} />
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Equipo</TableCell>
                  <PerfCells o={perf.team} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

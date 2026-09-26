import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Info, Pencil, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PipelineAnalytics } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCrmGoal, useSetCrmGoal } from '@/hooks/useCrm';
import { apiErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/crm';
import { days, goalProgress, pct } from '@/pages/crm/funnelLogic';

/** Botón de ayuda con tooltip (esquina de una tarjeta). */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`Qué significa ${label}`} className="absolute right-2 top-2 rounded-md text-muted-foreground/50 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-[260px] text-xs leading-snug">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** Cabecera estándar de las tarjetas del embudo. */
export function CardTitleRow({ icon: Icon, children }: { icon: typeof Target; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
      <Icon className="h-4 w-4 text-muted-foreground" /> {children}
    </div>
  );
}

function Kpi({ label, value, hint, tooltip }: { label: string; value: string; hint?: string; tooltip: string }) {
  return (
    <Card>
      <CardContent className="relative p-4">
        <InfoTip label={label}>{tooltip}</InfoTip>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export function FunnelTotals({ totals }: { totals: PipelineAnalytics['totals'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi
        label="Abiertos"
        value={String(totals.open_count)}
        hint={formatMoney(totals.open_value)}
        tooltip="Leads en etapas abiertas hoy y la suma de su valor estimado."
      />
      <Kpi
        label="Ponderado"
        value={formatMoney(totals.weighted_value)}
        hint="valor abierto × probabilidad de la etapa"
        tooltip="Valor abierto multiplicado por la probabilidad de cierre de la etapa de cada lead: una proyección más realista que el valor abierto."
      />
      <Kpi
        label="Ganados"
        value={String(totals.won_count)}
        hint={formatMoney(totals.won_value)}
        tooltip="Negocios que llegaron a la etapa Ganado en el periodo y su valor."
      />
      <Kpi
        label="Win rate"
        value={pct(totals.win_rate)}
        hint="ganados ÷ cerrados"
        tooltip="Porcentaje de negocios cerrados que se ganaron: ganados ÷ (ganados + perdidos) en el periodo."
      />
      <Kpi
        label="Ciclo promedio"
        value={days(totals.avg_cycle_days)}
        hint="creación → ganado"
        tooltip="Días promedio desde que se crea un lead hasta que se marca como ganado."
      />
    </div>
  );
}

/**
 * Meta mensual del equipo (configuración compartida). El avance es lo GANADO en el
 * rango elegido sobre la meta: con "Este mes" mide el mes; con otro rango, compara
 * ese periodo contra una meta de un mes, y se avisa en la tarjeta.
 */
export function FunnelGoal({ wonValue, rangeLabel }: { wonValue: number; rangeLabel: string }) {
  const { data: goal, isLoading } = useCrmGoal();
  const setGoal = useSetCrmGoal();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const g = goal?.monthly_goal ?? null;
  const progress = goalProgress(wonValue, g);

  async function save() {
    const n = Number(draft.replace(/[^\d]/g, ''));
    try {
      await setGoal.mutateAsync({ monthly_goal: Number.isFinite(n) && n > 0 ? n : null });
      setEditing(false);
      toast.success('Meta guardada');
    } catch (err) {
      toast.error(`No se pudo guardar la meta: ${apiErrorMessage(err)}`);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-muted-foreground" /> Meta mensual
          {g != null && !editing ? (
            <span className="ml-1 text-xs font-normal tabular-nums text-muted-foreground">
              {formatMoney(wonValue)} de {formatMoney(g)}
            </span>
          ) : null}
          {!editing && !isLoading ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Editar meta mensual"
              onClick={() => {
                setDraft(g != null ? String(g) : '');
                setEditing(true);
              }}
              className="ml-auto h-7 w-7 text-muted-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              autoFocus
              inputMode="numeric"
              aria-label="Meta mensual"
              placeholder="Meta mensual, p. ej. 20000000"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="h-9 w-64 max-w-full"
            />
            <Button size="sm" onClick={save} disabled={setGoal.isPending}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <span className="text-[11px] text-muted-foreground">Deja vacío para quitar la meta.</span>
          </div>
        ) : g == null ? (
          <p className="mt-2 text-xs text-muted-foreground">Sin meta. Define la meta mensual de ventas para medir lo ganado contra un objetivo.</p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums">{pct(progress)}</span>
              <span className="text-xs text-muted-foreground">de la meta · ganado en {rangeLabel.toLowerCase()}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${(progress ?? 0) * 100}%` }} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function FunnelBottleneck({ bottleneck }: { bottleneck: NonNullable<PipelineAnalytics['bottleneck']> }) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">Cuello de botella: {bottleneck.name}</span>
        <span className="text-muted-foreground">
          {' '}
          — {bottleneck.current_count} lead{bottleneck.current_count === 1 ? '' : 's'} hoy, {days(bottleneck.avg_days_in_stage)} promedio en la etapa
          {bottleneck.conversion_from_prev != null ? `, ${pct(bottleneck.conversion_from_prev)} de conversión` : ''}. Revisa esos leads y registra un siguiente paso.
        </span>
      </div>
      <Link to="/crm/pipeline" className="shrink-0 text-xs font-medium text-primary hover:underline">
        Ver en el pipeline
      </Link>
    </div>
  );
}

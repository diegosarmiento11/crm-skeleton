import { useMemo } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { XCircle } from 'lucide-react';
import type { FunnelStage } from '@crm/shared';
import { formatMoneyShort } from '@/lib/crm';
import { pct } from '@/pages/crm/funnelLogic';

/**
 * recharts pinta SVG y necesita un color real, no una clase. Este mapa refleja el
 * tono 500 de la paleta Tailwind que usan los badges de etapa (`STAGE_COLOR_CLASSES`),
 * así el gráfico y el pipeline hablan el mismo color. Es el único lugar del
 * cliente con valores literales, y solo por esa limitación.
 */
const STAGE_FILL: Record<string, string> = {
  slate: 'hsl(215 16% 47%)',
  blue: 'hsl(217 91% 60%)',
  green: 'hsl(142 71% 45%)',
  amber: 'hsl(38 92% 50%)',
  red: 'hsl(0 84% 60%)',
  purple: 'hsl(271 91% 65%)',
  teal: 'hsl(173 80% 40%)',
};

interface Row extends FunnelStage {
  label: string;
}

/**
 * Embudo por etapa: cuántos leads distintos ALGUNA VEZ entraron a cada etapa
 * (`reached_count`) y la conversión respecto a la anterior. "Perdido" no es un paso
 * del embudo (nadie "convierte" a perdido), así que se resume aparte debajo.
 */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const { rows, lost } = useMemo(() => {
    const ladder = stages.filter((s) => s.kind !== 'LOST');
    const rows: Row[] = ladder.map((s, i) => ({
      ...s,
      label: i === 0 || s.conversion_from_prev == null ? String(s.reached_count) : `${s.reached_count} · ${pct(s.conversion_from_prev)}`,
    }));
    return { rows, lost: stages.find((s) => s.kind === 'LOST') ?? null };
  }, [stages]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin etapas. Configura el pipeline para ver el embudo.</p>;
  }
  const top = Math.max(1, ...rows.map((r) => r.reached_count));
  const empty = rows.every((r) => r.reached_count === 0);

  return (
    <div>
      {empty ? <p className="mb-2 text-xs text-muted-foreground">Ningún lead entró a una etapa en este periodo. Amplía el rango o crea leads en el pipeline.</p> : null}
      <div style={{ height: rows.length * 44 + 12 }} role="img" aria-label="Embudo: leads que alcanzaron cada etapa">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 88, bottom: 4, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide domain={[0, top]} />
            <YAxis
              type="category"
              dataKey="name"
              width={124}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<FunnelTip />} />
            <Bar dataKey="reached_count" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} minPointSize={2}>
              {rows.map((r) => (
                <Cell key={r.id} fill={STAGE_FILL[r.color] ?? STAGE_FILL.slate} />
              ))}
              <LabelList dataKey="label" position="right" fill="hsl(var(--foreground))" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {lost ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs">
          <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="font-medium text-destructive">{lost.name}</span>
          <span className="ml-auto tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{lost.reached_count}</span>
            {lost.current_value > 0 ? ` · ${formatMoneyShort(lost.current_value)}` : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// recharts pasa `payload` con la fila; se pinta con los tokens del tema.
function FunnelTip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = active && payload?.[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">{row.name}</div>
      <div className="mt-1 space-y-0.5 text-muted-foreground">
        <div>
          Alguna vez: <span className="tabular-nums text-foreground">{row.reached_count}</span>
        </div>
        <div>
          Hoy: <span className="tabular-nums text-foreground">{row.current_count}</span>
          {row.current_value > 0 ? ` · ${formatMoneyShort(row.current_value)}` : ''}
        </div>
        {row.conversion_from_prev != null ? (
          <div>
            Conversión desde la anterior: <span className="tabular-nums text-foreground">{pct(row.conversion_from_prev)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

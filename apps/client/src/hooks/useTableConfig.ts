import { useEffect, useRef, useState } from 'react';
import type { ViewPrefConfig } from '@crm/shared';
import { useSaveViewPref, useViewPref } from './useViewPref';

export interface TableConfig {
  order: string[];
  widths: Record<string, number>;
  hidden: Set<string>;
  setOrder: (o: string[]) => void;
  setWidth: (id: string, w: number) => void;
  toggleHidden: (id: string) => void;
  persist: (next?: Partial<ViewPrefConfig>) => void;
}

/**
 * Per-user table view state (column order / widths / visibility), seeded from
 * the saved server config. Lifted out of DataTable so a toolbar "Vista" button
 * and the table share the same state.
 */
export function useTableConfig(entity: string, defaultOrder: string[]): TableConfig {
  const { data: pref } = useViewPref(entity);
  const save = useSaveViewPref(entity);

  const [order, setOrderState] = useState<string[]>(defaultOrder);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || pref === undefined) return;
    seeded.current = true;
    const cfg = pref?.config as ViewPrefConfig | null;
    if (cfg) {
      const known = new Set(defaultOrder);
      const savedOrder = (cfg.order ?? []).filter((id) => known.has(id));
      const missing = defaultOrder.filter((id) => !savedOrder.includes(id));
      setOrderState([...savedOrder, ...missing]);
      setWidths(cfg.widths ?? {});
      setHidden(new Set(cfg.hidden ?? []));
    }
  }, [pref, defaultOrder]);

  function persist(next: Partial<ViewPrefConfig> = {}) {
    save.mutate({ order, widths, hidden: [...hidden], ...next });
  }

  function setOrder(o: string[]) {
    setOrderState(o);
    save.mutate({ order: o, widths, hidden: [...hidden] });
  }

  function setWidth(id: string, w: number) {
    setWidths((prev) => ({ ...prev, [id]: Math.max(80, Math.round(w)) }));
  }

  function toggleHidden(id: string) {
    const nextHidden = new Set(hidden);
    if (nextHidden.has(id)) nextHidden.delete(id);
    else nextHidden.add(id);
    setHidden(nextHidden);
    save.mutate({ order, widths, hidden: [...nextHidden] });
  }

  return { order, widths, hidden, setOrder, setWidth, toggleHidden, persist };
}

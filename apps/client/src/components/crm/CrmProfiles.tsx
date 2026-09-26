import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CrmEntity } from '@/hooks/useCrm';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ProfileLead } from './ProfileLead';
import { ProfilePerson } from './ProfilePerson';
import { ProfileCompany } from './ProfileCompany';
import type { ProfileNav } from './ProfileShared';

/**
 * Panel lateral de perfiles (lead / persona / empresa). Cualquier pantalla abre un
 * perfil con `useCrmProfiles().openLead(id)` y desde dentro del panel se navega a
 * los registros relacionados; una pila simple permite "volver" al anterior.
 */
export interface CrmProfilesApi {
  openLead: (id: string) => void;
  openPerson: (id: string) => void;
  openCompany: (id: string) => void;
  close: () => void;
}

interface ProfileRef {
  type: CrmEntity;
  id: string;
}

const Ctx = createContext<CrmProfilesApi | null>(null);

export function CrmProfilesProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ProfileRef[]>([]);
  // Último perfil mostrado: se conserva mientras el Sheet termina su animación de
  // cierre para que no se vea un panel vacío deslizándose.
  const lastRef = useRef<ProfileRef | null>(null);

  const push = useCallback(
    (type: CrmEntity) => (id: string) =>
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top && top.type === type && top.id === id) return prev;
        return [...prev, { type, id }];
      }),
    [],
  );
  const close = useCallback(() => setStack([]), []);
  const back = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);

  const value = useMemo<CrmProfilesApi>(
    () => ({ openLead: push('lead'), openPerson: push('person'), openCompany: push('company'), close }),
    [push, close],
  );

  const current = stack[stack.length - 1] ?? null;
  if (current) lastRef.current = current;
  const shown = current ?? lastRef.current;
  // Los perfiles reciben la API por props (no por el hook) para no importar este
  // archivo desde los que él mismo importa.
  const nav: ProfileNav = { ...value, canGoBack: stack.length > 1, back };

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet
        open={current !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent side="right" hideClose className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {shown ? <ProfileSwitch key={`${shown.type}:${shown.id}`} current={shown} nav={nav} /> : null}
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}

function ProfileSwitch({ current, nav }: { current: ProfileRef; nav: ProfileNav }) {
  switch (current.type) {
    case 'lead':
      return <ProfileLead id={current.id} nav={nav} />;
    case 'person':
      return <ProfilePerson id={current.id} nav={nav} />;
    case 'company':
      return <ProfileCompany id={current.id} nav={nav} />;
  }
}

export function useCrmProfiles(): CrmProfilesApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCrmProfiles debe usarse dentro de <CrmProfilesProvider>');
  return ctx;
}

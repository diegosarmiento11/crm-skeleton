import { Fragment } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { TEAM_ROLE_LABELS, TEAM_ROLES, type TeamRole } from '@crm/shared';
import { cn } from '@/lib/utils';
import { navItems } from '@/config/nav';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MemberAvatar } from '@/components/team/MemberAvatar';

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { canArea, hasRole } = useAuth();
  const visible = navItems.filter((i) => canArea(i.area) && (!i.roles || hasRole(...i.roles)));
  let lastSection: string | undefined;
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {visible.map((item) => {
        const header = item.section && item.section !== lastSection ? item.section : null;
        lastSection = item.section ?? lastSection;
        return (
          <Fragment key={item.to}>
            {header ? (
              <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {header}
              </div>
            ) : null}
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  isActive ? 'bg-primary/10 font-medium text-primary' : 'text-foreground/80 hover:bg-muted',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          </Fragment>
        );
      })}
    </nav>
  );
}

function UserBox() {
  const { me, signOut, impersonate } = useAuth();
  if (!me) return null;
  const real = me.impersonator_role ?? me.role;
  return (
    <div className="mt-auto space-y-2 border-t border-border p-3">
      <div className="flex items-center gap-2">
        <MemberAvatar seed={me.email} name={me.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{me.name}</div>
          <div className="truncate text-xs text-muted-foreground">{TEAM_ROLE_LABELS[me.role]}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} aria-label="Salir">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      {real === 'GERENTE' ? (
        // Seam de QA: ver la app como otro rol. El servidor solo lo honra a un GERENTE.
        <Select value={me.role} onValueChange={(v) => impersonate(v === 'GERENTE' ? null : (v as TeamRole))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Ver como…" />
          </SelectTrigger>
          <SelectContent>
            {TEAM_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                Ver como {TEAM_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="px-4 py-4 text-base font-semibold tracking-tight">CRM</div>
        <Nav />
        <UserBox />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <div className="px-4 py-4 text-base font-semibold">CRM</div>
              <Nav />
              <UserBox />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">CRM</span>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

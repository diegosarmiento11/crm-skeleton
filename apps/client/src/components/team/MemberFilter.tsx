import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Users, X } from 'lucide-react';
import { TEAM_ROLE_LABELS } from '@crm/shared';
import { normalizeMemberId } from '@/lib/members';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { MemberAvatar } from '@/components/team/MemberAvatar';
import { useMembers, type Member } from '@/lib/members';
import { cn } from '@/lib/utils';

/**
 * Dropdown to filter by team member. `value` is a member id (email) or `null` =
 * everyone. The list is the live active team; inactive members are still shown
 * (greyed) when they appear in `presentIds` so historical assignments stay filterable.
 */
export function MemberFilter({
  value,
  onChange,
  presentIds = [],
  className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  presentIds?: string[];
  className?: string;
}) {
  const { members, activeMembers } = useMembers();
  const [open, setOpen] = useState(false);

  const present = useMemo(() => new Set(presentIds.map((id) => normalizeMemberId(id))), [presentIds]);
  // Active members + any inactive member that still has work assigned in this view.
  const options = useMemo<Member[]>(() => {
    const inactivePresent = members.filter((m) => !m.active && present.has(m.id));
    return [...activeMembers, ...inactivePresent];
  }, [members, activeMembers, present]);

  const selected = value ? options.find((m) => m.id === normalizeMemberId(value)) : undefined;
  // Con persona elegida el chip se tiñe de azul (accent) + su propia ✕ para
  // volver a "Todos" — mismo patrón que el chip de asignado en Tareas.
  const active = Boolean(selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'inline-flex h-9 items-center rounded-full border text-xs font-medium transition-colors',
          active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-white text-neutral-800 hover:bg-neutral-50 dark:bg-white dark:text-neutral-800 dark:hover:bg-neutral-50',
          className,
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full pl-3 outline-none focus-visible:ring-1 focus-visible:ring-ring',
              active ? 'pr-1.5' : 'pr-3',
            )}
          >
            {selected ? (
              <MemberAvatar name={selected.name} seed={selected.id} size="sm" muted={!selected.active} />
            ) : (
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="max-w-[140px] truncate">{selected ? selected.name : 'Todos'}</span>
            {!active ? <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" /> : null}
          </button>
        </PopoverTrigger>
        {active ? (
          <button
            type="button"
            aria-label="Quitar filtro de persona"
            onClick={() => onChange(null)}
            className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-primary/80 hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar persona…" />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__todos__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Todos</span>
                {value === null ? <Check className="ml-auto h-4 w-4" /> : null}
              </CommandItem>
              {options.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.email}`}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <MemberAvatar name={m.name} seed={m.id} size="sm" muted={!m.active} className="mr-2" />
                  <span className={cn('truncate', !m.active && 'text-muted-foreground')}>
                    {m.name}
                    {!m.active ? ' · inactivo' : ''}
                  </span>
                  <span className="ml-2 truncate text-[10px] text-muted-foreground">
                    {TEAM_ROLE_LABELS[m.role]}
                  </span>
                  {normalizeMemberId(value ?? '') === m.id ? <Check className="ml-auto h-4 w-4" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

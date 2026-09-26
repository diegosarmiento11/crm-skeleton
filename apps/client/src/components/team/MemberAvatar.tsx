import { memberInitials, memberPhoto } from '@/lib/members';
import { cn } from '@/lib/utils';

// Deterministic per-member tint so avatars are distinguishable at a glance.
// Full class strings so the Tailwind JIT keeps them.
const AVATAR_TINTS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200',
  'bg-green-100 text-green-700 dark:bg-green-500/25 dark:text-green-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/25 dark:text-amber-200',
  'bg-purple-100 text-purple-700 dark:bg-purple-500/25 dark:text-purple-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/25 dark:text-teal-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-200',
];

export function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

const SIZES = {
  sm: 'h-5 w-5 text-[9px]',
  md: 'h-6 w-6 text-[10px]',
  lg: 'h-8 w-8 text-xs',
} as const;

/** Round initials avatar tinted by member id, with an optional inactive (greyed) state. */
export function MemberAvatar({
  name,
  seed,
  size = 'md',
  muted = false,
  className,
}: {
  name: string;
  seed: string;
  size?: keyof typeof SIZES;
  muted?: boolean;
  className?: string;
}) {
  const photo = memberPhoto(seed);
  if (photo && !muted) {
    return (
      <img
        src={photo}
        alt={name}
        className={cn('inline-block shrink-0 rounded-full object-cover', SIZES[size].split(' ')[0] + ' ' + SIZES[size].split(' ')[1], className)}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        muted ? 'bg-muted text-muted-foreground' : tintFor(seed),
        className,
      )}
    >
      {memberInitials(name)}
    </span>
  );
}

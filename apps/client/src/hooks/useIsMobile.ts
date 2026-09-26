import { useEffect, useState } from 'react';

// Reacciona al breakpoint móvil (por defecto < md de Tailwind = 768px). Úsalo para
// alternar layouts que en desktop son horizontales (kanban, tablas anchas) y en
// móvil deben ser de una columna/sección a la vez.
export function useIsMobile(query = '(max-width: 767px)'): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}

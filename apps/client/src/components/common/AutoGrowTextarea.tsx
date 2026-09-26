import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props extends Omit<React.ComponentProps<'textarea'>, 'rows' | 'style'> {
  /** Alto mínimo en líneas (lo que se ve con el campo vacío). */
  minRows?: number;
  /** Alto máximo en líneas; a partir de ahí el contenido scrollea dentro. */
  maxRows?: number;
}

/**
 * Textarea que crece con el contenido entre `minRows` y `maxRows`.
 *
 * Mide con `scrollHeight`, que solo es fiable si antes se resetea el alto: con un
 * alto fijo puesto, `scrollHeight` nunca baja y el campo no se encogería al
 * borrar texto. El alto de línea se lee del elemento en vez de asumir un número,
 * para que siga cuadrando si cambia la tipografía del tema.
 *
 * `rows={minRows}`: sin atributo el navegador arranca en 2 renglones y `scrollHeight`
 * nunca baja de ahí, así que un campo de una línea (`minRows={1}`) mostraba un
 * renglón vacío de más.
 */
export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ minRows = 6, maxRows = 20, className, value, onChange, ...props }, ref) => {
    const inner = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

    const resize = useCallback(() => {
      const el = inner.current;
      if (!el) return;
      const cs = window.getComputedStyle(el);
      const line = parseFloat(cs.lineHeight) || 20;
      const extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
        parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const min = line * minRows + extra;
      const max = line * maxRows + extra;
      el.style.height = 'auto'; // imprescindible: ver comentario del bloque
      const next = Math.min(Math.max(el.scrollHeight, min), max);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
    }, [minRows, maxRows]);

    // useLayoutEffect: ajusta antes de pintar, para que abrir un diálogo con
    // texto largo no muestre un salto de 6 líneas al alto real.
    useLayoutEffect(resize, [resize, value]);

    // El ancho del diálogo cambia el número de líneas que ocupa el mismo texto.
    useEffect(() => {
      const el = inner.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      return () => ro.disconnect();
    }, [resize]);

    return (
      <textarea
        rows={minRows}
        ref={inner}
        value={value}
        onChange={onChange}
        className={cn(
          'flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        {...props}
      />
    );
  },
);
AutoGrowTextarea.displayName = 'AutoGrowTextarea';

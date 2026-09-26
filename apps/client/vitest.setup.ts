import '@testing-library/jest-dom/vitest';

// jsdom lacks a few DOM APIs that Radix (Popover/Dialog) touches. Shim them so
// component tests can open popovers and calendars.
/* eslint-disable @typescript-eslint/no-explicit-any */
const proto = Element.prototype as any;
proto.hasPointerCapture ??= () => false;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};
proto.scrollIntoView ??= () => {};

const g = globalThis as any;
g.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

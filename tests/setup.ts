import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver for components that need it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverMock;

# cc-plan-viewer

Browser-based PR-style review UI for Claude Code plans.

## Architecture

- **server/** - Express 5 HTTP + WebSocket backend (port 3847)
- **src/** - React 19 SPA (Vite 6, Tailwind 3.4)
- **bin/** - CLI tool (install/update/uninstall/start/open/version)
- **hooks/** - PostToolUse hook for Claude Code integration (CJS)

## Development

```bash
npm run dev          # Start dev server + Vite HMR
npm run build        # Production build
npm start            # Start production server
```

## Testing

### Running tests

```bash
npm test             # Run all unit + integration tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run with coverage report
npm run test:e2e     # Run Playwright E2E tests
npm run test:all     # Run all tests (unit + integration + E2E)
```

### Testing requirements

- Every new module MUST have a corresponding `.test.ts` / `.test.tsx` file
- Every new API endpoint MUST have integration tests
- Every new component MUST have rendering and interaction tests
- Every new hook MUST have tests covering its full state machine
- `npm test` MUST pass before committing — never commit with failing tests
- Existing tests MUST NOT be broken by any changes
- Test behavior, not implementation details
- Use Vitest for unit and integration tests
- Use React Testing Library for component tests (query by role/text, not implementation)
- Use Playwright for E2E tests in `e2e/` directory

### Test structure

- Test files live next to source files with `.test.ts` / `.test.tsx` suffix
- Server tests run in Node environment, client tests run in jsdom
- Setup file: `tests/setup.ts` (jest-dom matchers)

### Mocking conventions

- Mock `node:fs` for server file I/O tests
- Mock `global.fetch` for API client tests
- Mock `WebSocket` for WebSocket hook tests
- Avoid testing third-party library internals (react-markdown, rehype-highlight)

## Code conventions

- TypeScript strict mode throughout
- ESM modules (`"type": "module"` in package.json)
- Server imports use `.js` extensions (ESM convention for compiled TS)
- Tailwind classes for all styling (no CSS modules)
- Dark mode via `prefers-color-scheme` media query

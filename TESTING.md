# Test Setup

This project uses **Vitest** for unit and integration testing across both frontend and backend.

## Running Tests

### Frontend Tests
```bash
npm run test -w frontend          # Run frontend tests
npm run test:ui -w frontend       # Run with UI dashboard
npm run test:coverage -w frontend # Generate coverage report
```

### Backend Tests
```bash
npm run test -w api              # Run backend tests
npm run test:coverage -w api     # Generate coverage report
```

### Run All Tests
```bash
npm test                         # Run all tests in the project
```

## Test Structure

### Frontend (`frontend/src/`)
- **components/*.test.tsx** - Component unit tests
  - `StockDashboard.test.tsx` - Dashboard UI interactions
  - `Screener.test.tsx` - Screener functionality
- **hooks/*.test.ts** - Hook tests
  - `useSortableData.test.ts` - Data sorting hook

### Backend (`backend/api/src/`)
- **server.test.ts** - API route tests and endpoint validation
- **orchestrator.test.ts** - Orchestrator initialization and tool management

## What's Tested

### Frontend
- ✓ Component rendering
- ✓ User interactions (clicks, tab switching)
- ✓ API data fetching
- ✓ Error states and loading states
- ✓ Data formatting functions
- ✓ Hook behavior

### Backend
- ✓ Health check endpoint
- ✓ Tools listing endpoint
- ✓ Quote data fetching (all exchanges)
- ✓ Screener types (quality, growth, dividend)
- ✓ Error handling (missing data, parsing failures)
- ✓ Orchestrator initialization and server connections
- ✓ Tool registration and namespacing

## Test Dependencies

### Frontend
- `vitest` - Test runner
- `@testing-library/react` - React component testing
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM environment

### Backend
- `vitest` - Test runner
- `supertest` - HTTP assertion library (for integration tests)

## Writing New Tests

### Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### API Test Example
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected data', async () => {
    const result = await callEndpoint();
    expect(result).toBeDefined();
  });
});
```

## Coverage Goals

Current coverage targets:
- Frontend components: 70%+
- Frontend hooks: 80%+
- Backend routes: 75%+
- Backend orchestrator: 80%+

View coverage reports:
```bash
npm run test:coverage -w frontend
npm run test:coverage -w api
```

Coverage reports are generated in `coverage/` directories.

## Debugging Tests

### Run specific test file
```bash
npx vitest frontend/src/components/StockDashboard.test.tsx
npx vitest api/src/server.test.ts
```

### Run tests matching pattern
```bash
npx vitest -t "renders without crashing"
```

### Watch mode
```bash
npm run test -- --watch
```

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:
```bash
npm test                         # Runs all tests once
npm run test:coverage            # Generates coverage reports
```

Both commands use Vitest's non-interactive mode suitable for CI.

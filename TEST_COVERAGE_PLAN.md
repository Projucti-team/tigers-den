# Test Coverage Plan

## Overview
Comprehensive test coverage for all critical features to prevent production issues.

## Coverage by Module

### 🟢 Well Covered
- ✅ Feedback Collection (unit + integration tests)
- ✅ Feedback Button Component (unit tests)
- ✅ Tour Detail parsing (existing tests)
- ✅ ESPN Match Centre (existing tests)

### 🟡 Partially Covered
- ⚠️ Cricket Sync Jobs (basic, needs expansion)
- ⚠️ Squad Refresh Logic (no tests yet)
- ⚠️ Tour State Management (no tests yet)
- ⚠️ Format Status Determination (no tests yet)

### 🔴 Not Covered
- ❌ API Endpoints (cricket sync, tours, rankings)
- ❌ Payload CMS collections (Users, Members, etc.)
- ❌ Auth/access control
- ❌ Live match features
- ❌ Member posting/following
- ❌ Chat features
- ❌ Chants submission

## Priority (High → Low)

### Priority 1: Cricket Core (Sync Jobs & State)
Critical to app functionality. Must test before production.
- `lib/cricket/services/sync-cricket-snapshots.ts` (main sync coordinator)
- `lib/cricket/services/refresh-squads-for-active-tours.ts` (squad logic)
- `lib/cricket/services/tour-sync-state-db.ts` (state queries)
- `lib/cricket/services/update-tour-sync-state.ts` (status determination)

### Priority 2: Feedback System
Just added. Must validate fully. ✅ Already done.

### Priority 3: API Endpoints
- `/api/cricket-sync` (sync trigger)
- `/api/cron/cricket` (lock management)
- `/api/feedback` (feedback submission) ✅ Done

### Priority 4: Components & UI
- Tour detail views
- Live match display
- Rankings showcase
- Forum/discussion components

### Priority 5: Collections & Auth
- User registration/login
- Member profiles
- Access control

## Test File Structure

```
tests/
├── unit/
│   ├── cricket-sync.test.ts          (NEW - sync jobs)
│   ├── squad-refresh.test.ts         (NEW - squad logic)
│   ├── tour-state.test.ts            (NEW - state mgmt)
│   ├── format-status.test.ts         (NEW - status logic)
│   ├── feedback-api.test.ts          ✅ Done
│   ├── feedback-button.test.tsx      ✅ Done
│   ├── tour-detail.test.ts           (existing)
│   └── espn-match-centre.test.ts     (existing)
└── integration/
    ├── cricket-sync.test.ts          (NEW - e2e sync)
    ├── squad-refresh.test.ts         (NEW - e2e refresh)
    ├── feedback-schema.test.ts       ✅ Done
    └── api-endpoints.test.ts         (NEW - API testing)
```

## Test Execution

### Pre-Deployment Checklist
```bash
# Run before any production push
npm run test
npm run test:coverage

# Check coverage report
open coverage/index.html
```

### Continuous Integration
All tests should run on:
- Pull requests
- Pre-merge
- Pre-deploy

## Coverage Targets

| Module | Target | Status |
|--------|--------|--------|
| Feedback | 90%+ | ✅ |
| Cricket Sync | 80%+ | 🔴 0% |
| Squad Refresh | 85%+ | 🔴 0% |
| Tour State | 85%+ | 🔴 0% |
| API Endpoints | 75%+ | 🟡 10% |
| Components | 70%+ | 🟡 20% |

## Next Steps

1. **Write unit tests for cricket sync** (this session)
2. **Add squad refresh unit tests**
3. **Add tour state management tests**
4. **Add format status determination tests**
5. **Create API endpoint tests**
6. **Set up CI/CD coverage reporting**
7. **Document test patterns** for team
8. **Make tests required** before merge

## Test Patterns to Use

### Unit Test Template
```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";

describe("Module Name", () => {
  let instance: any;

  beforeEach(() => {
    instance = new Module();
  });

  describe("Feature X", () => {
    it("should do Y when Z happens", () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = instance.method(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

### Integration Test Template
```typescript
import { describe, it, expect, beforeAll } from "@jest/globals";

describe("Feature Integration", () => {
  beforeAll(async () => {
    // Setup (DB, etc)
  });

  it("should flow from A to B to C", async () => {
    // Test full workflow
  });
});
```

## Running Tests

```bash
# All tests
npm test

# Specific file
npm test -- cricket-sync.test.ts

# With coverage
npm test -- --coverage

# Watch mode (development)
npm test -- --watch

# Integration only
npm test -- tests/integration/

# Before deploy
bash scripts/test-before-deploy.sh
```

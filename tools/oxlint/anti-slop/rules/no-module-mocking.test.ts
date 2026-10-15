import { RuleTester } from "oxlint/plugins-dev";

import { noModuleMockingRule } from "./no-module-mocking.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { messageId: "moduleMock" };

tester.run("anti-slop/no-module-mocking", noModuleMockingRule, {
  valid: [
    "const store = new InMemoryUserStore();",
    "vi.spyOn(store, 'save');",
    "const vi = { mock() {} }; vi.mock();",
    "function test(jest: { mock(): void }) { jest.mock(); }",
    "import { vi as localVi } from './helpers'; localVi.mock('./module');",
    "import { mock } from 'bun:test'; const fn = mock(() => 1);",
    "import { mock } from 'bun:test'; mock.restore();",
    "const mock = { module() {} }; mock.module('./x');",
    "import { mock } from './helpers'; mock.module('./x');",
  ],
  invalid: [
    { code: "vi.mock('./user-store');", errors: [error] },
    { code: "jest.mock('./user-store');", errors: [error] },
    { code: "vi['doMock']('./user-store');", errors: [error] },
    { code: "jest.unstable_mockModule('./user-store');", errors: [error] },
    { code: "import { vi } from 'vitest'; vi.mock('./user-store');", errors: [error] },
    { code: "import { vi as testApi } from 'vitest'; testApi.mock('./user-store');", errors: [error] },
    {
      code: "import { jest } from '@jest/globals'; jest.mock('./user-store');",
      errors: [error],
    },
    {
      code: "import { mock } from 'bun:test'; mock.module('./user-store', () => ({}));",
      errors: [error],
    },
    {
      code: "import { mock as bunMock } from 'bun:test'; bunMock.module('./user-store', () => ({}));",
      errors: [error],
    },
    {
      code: "import { mock } from 'bun:test'; mock['module']('./user-store', () => ({}));",
      errors: [error],
    },
    {
      code: "import { vi } from 'bun:test'; vi.mock('./user-store', () => ({}));",
      errors: [error],
    },
  ],
});

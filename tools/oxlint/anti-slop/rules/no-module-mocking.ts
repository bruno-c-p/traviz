import { defineRule } from "@oxlint/plugins";

import { resolveVariable } from "../shared/scope.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

interface ModuleMockApi {
  readonly source: string;
  readonly exportName: string;
  readonly methods: ReadonlySet<string>;
}

const frameworkMockMethods: ReadonlySet<string> = new Set(["doMock", "mock", "unstable_mockModule"]);
const globalFrameworkObjects = new Set(["vi", "jest"]);

const moduleMockApis: readonly ModuleMockApi[] = [
  { source: "vitest", exportName: "vi", methods: frameworkMockMethods },
  { source: "@jest/globals", exportName: "jest", methods: frameworkMockMethods },
  { source: "bun:test", exportName: "mock", methods: new Set(["module"]) },
  { source: "bun:test", exportName: "vi", methods: new Set(["mock"]) },
];

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") return null;
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function moduleMockMethodsOf(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
): ReadonlySet<string> | null {
  if (expression.type !== "Identifier") return null;
  const isFrameworkGlobalName = globalFrameworkObjects.has(expression.name);
  if (isFrameworkGlobalName && sourceCode.isGlobalReference(expression)) {
    return frameworkMockMethods;
  }

  const variable = resolveVariable(sourceCode, expression);
  if (variable === null || variable.defs.length === 0) {
    return isFrameworkGlobalName ? frameworkMockMethods : null;
  }
  for (const definition of variable.defs) {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      continue;
    }
    const source = definition.parent.source.value;
    const name = importedName(definition.node);
    const api = moduleMockApis.find(
      (candidate) => candidate.source === source && candidate.exportName === name,
    );
    if (api !== undefined) return api.methods;
  }
  return null;
}

function staticPropertyName(property: ESTree.Node, computed: boolean): string | null {
  if (!computed && property.type === "Identifier") return property.name;
  if (computed && property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }
  return null;
}

function moduleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  if (!("property" in callee) || !("object" in callee) || !("computed" in callee)) return false;
  const methods = moduleMockMethodsOf(sourceCode, callee.object);
  if (methods === null) return false;
  const method = staticPropertyName(callee.property, callee.computed);
  return method !== null && methods.has(method);
}

/** Ban test framework module mocking in favor of real dependency seams. */
export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest, Jest, and Bun module mocking; tests must replace dependencies through real interfaces.",
    },
    messages: {
      moduleMock:
        "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
        if (moduleMockCall(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});

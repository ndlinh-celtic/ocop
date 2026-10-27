/** Layer rules from docs/kien-truc-va-cong-nghe.md 3.1: dependencies only point inwards. */
module.exports = {
  forbidden: [
    {
      name: "web-no-db",
      comment: "apps/web goes through use cases; it must not touch the ORM, the driver or repositories directly.",
      severity: "error",
      from: { path: "^apps/web" },
      to: { path: ["node_modules/(drizzle-orm|pg|pg-boss)/", "^packages/infra/src/(db|repos)/"] },
    },
    {
      name: "core-is-framework-free",
      comment: "packages/core is plain TypeScript: no framework, ORM or infrastructure SDK.",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: {
        path: ["^packages/infra", "^apps/", "node_modules/(next|react|drizzle-orm|pg|pg-boss|@aws-sdk|nodemailer)/"],
      },
    },
    {
      name: "not-to-unresolvable",
      comment: "An import nobody can resolve is usually a dependency missing from package.json.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["\\.next", "dist", "node_modules/\\.pnpm/[^/]+/node_modules/[^/]+/node_modules"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default", "types"] },
  },
};

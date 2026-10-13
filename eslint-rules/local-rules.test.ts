import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import { localRules } from "./local-rules.mjs";

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

describe("local/no-dynamic-restricted-import", () => {
  it("runs RuleTester valid/invalid cases", () => {
    ruleTester.run(
      "no-dynamic-restricted-import",
      localRules.rules["no-dynamic-restricted-import"],
      {
        valid: [
          'const x = await import("react");',
          'const x = await import("@postific/shared");',
        ],
        invalid: [
          {
            code: 'const x = await import("@prisma/client");',
            errors: 1,
          },
          {
            code: 'const x = await import("@supabase/supabase-js");',
            errors: 1,
          },
          {
            code: 'const x = await import("@/lib/repositories/identity/identity.repository");',
            errors: 1,
          },
          {
            code: 'const x = await import("@/lib/prisma/client");',
            errors: 1,
          },
        ],
      },
    );
  });
});

describe("local/no-arbitrary-value-in-variable", () => {
  it("runs RuleTester valid/invalid cases", () => {
    ruleTester.run(
      "no-arbitrary-value-in-variable",
      localRules.rules["no-arbitrary-value-in-variable"],
      {
        valid: ['const x = "gap-4 p-2";', 'const x = `gap-${size}`;'],
        invalid: [
          // Regression: findArbitraryValues() must catch every token in a
          // string, not just the first (code-review fix — missing `g` flag).
          {
            code: 'const x = "p-[13px] m-[7px]";',
            errors: 2,
          },
          {
            code: 'const TRANSITION_FAST = "duration-[var(--duration-fast)] ease-[var(--ease-standard)]";',
            errors: 2,
          },
          // Regression: an arbitrary-value token split across a template
          // literal interpolation boundary must still be caught (code-review
          // fix — quasis were checked independently before).
          {
            code: "const x = `duration-[${token}]`;",
            errors: 1,
          },
          {
            code: 'x = "p-[13px]";',
            errors: 1,
          },
        ],
      },
    );
  });
});

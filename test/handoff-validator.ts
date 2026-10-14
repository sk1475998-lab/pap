import { z } from 'zod';

const HandoffASchema = z.object({
  phase: z.literal('A'),
  dependency_map: z.record(
    z.object({
      imports: z.array(z.string()),
      imported_by: z.array(z.string()),
    })
  ),
  workflows: z.array(
    z.object({
      name: z.string(),
      entry_point: z.string(),
      exit_conditions: z.array(z.string()),
      external_deps: z.array(z.string()),
      risk_surface: z.array(z.string()),
    })
  ),
  brittle_selectors: z.array(
    z.object({
      selector: z.string(),
      file: z.string(),
      reason: z.string(),
    })
  ),
  api_surface: z.array(
    z.object({
      api: z.string(),
      key_storage: z.enum(['env', 'hardcoded', 'user']),
      file: z.string(),
    })
  ),
  circular_deps: z.array(z.string()),
  critical_blockers: z.array(z.string()),
});

const HandoffBSchema = z.object({
  phase: z.literal('B'),
  security_findings: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      file: z.string(),
      line: z.number(),
      description: z.string(),
      exploit_scenario: z.string(),
      fix: z.string(),
    })
  ),
  permission_audit: z.array(
    z.object({
      permission: z.string(),
      used: z.boolean(),
      where: z.string(),
      store_risk: z.string(),
    })
  ),
  critical_blockers: z.array(z.string()),
});

const HandoffCSchema = z.object({
  phase: z.literal('C'),
  test_results: z.array(
    z.object({
      test_id: z.string(),
      module: z.string(),
      input: z.string(),
      expected: z.string(),
      actual: z.string(),
      passed: z.boolean(),
      bug_id: z.string().nullable(),
    })
  ),
  bugs_found: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      module: z.string().optional(),
      description: z.string(),
      root_cause_hypothesis: z.string(),
      fix_location: z.string(),
      fix_suggestion: z.string(),
    })
  ),
  critical_blockers: z.array(z.string()),
});

const HandoffDSchema = z.object({
  phase: z.literal('D'),
  platform_results: z.array(
    z.object({
      platform: z.string(),
      protocols_run: z.array(z.string()),
      fields_tested: z.array(
        z.object({
          label: z.string(),
          resolved_as: z.string(),
          value_written: z.string(),
          registered: z.boolean(),
        })
      ),
      bugs_found: z.array(z.any()),
      observations: z.string(),
    })
  ),
  all_bugs: z.array(z.any()),
  critical_blockers: z.array(z.string()),
});

const HandoffESchema = z.object({
  phase: z.literal('E'),
  performance: z.object({
    startup_ms: z.number(),
    autofill_ms: z.number(),
    cpu_peak_pct: z.number(),
    memory_mb_after_30min: z.number(),
    leaks_found: z.array(z.string()),
  }),
  mv3_compliance: z.object({
    passed: z.boolean(),
    failures: z.array(z.string()),
  }),
  ux_scores: z.record(
    z.object({
      score: z.number(),
      notes: z.string(),
    })
  ),
  store_policy_flags: z.array(z.string()),
  improvements: z.array(
    z.object({
      recommendation: z.string(),
      category: z.string(),
      impact: z.string(),
      effort: z.string(),
      priority_rank: z.number(),
    })
  ),
});

const schemas: Record<string, z.ZodSchema> = {
  A: HandoffASchema,
  B: HandoffBSchema,
  C: HandoffCSchema,
  D: HandoffDSchema,
  E: HandoffESchema,
};

export async function validateHandoff(
  phase: string,
  data: unknown
): Promise<{ valid: boolean; data?: any; errors?: string[] }> {
  const schema = schemas[phase];
  if (!schema) {
    return { valid: false, errors: [`No schema defined for phase ${phase}`] };
  }
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  } else {
    return {
      valid: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
    };
  }
}

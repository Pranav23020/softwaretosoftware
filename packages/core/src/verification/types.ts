export type VerificationCategory = "static" | "build" | "api" | "runtime" | "database" | "security" | "integration";
export type VerificationSeverity = "error" | "warning" | "info";
export type VerificationStatus = "passed" | "failed" | "skipped";
export type FailureCategory = "BUILD_FAILURE" | "IMPORT_FAILURE" | "STARTUP_FAILURE" | "HTTP_FAILURE" | "SCHEMA_FAILURE" | "DATABASE_FAILURE" | "AUTH_FAILURE" | "INTEGRATION_FAILURE" | "SECURITY_FAILURE" | "TIMEOUT" | "RESOURCE_LIMIT" | "TEST_FAILURE" | "UNKNOWN";

export interface VerificationCheck {
  id: string;
  name: string;
  category: VerificationCategory;
  severity: VerificationSeverity;
  source: string[];
  description: string;
  timeoutMs?: number;
}

export interface StaticCheck extends VerificationCheck {
  category: "static" | "security";
  path?: string;
}

export interface ApiCheck extends VerificationCheck {
  category: "api";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  expectedStatus: number;
  requestBody?: Record<string, unknown>;
  authRequired: boolean;
}

export interface RuntimeCheck extends VerificationCheck {
  category: "runtime" | "database" | "build";
  command?: string;
  expected?: string[];
}

export interface VerificationPlan {
  projectSlug: string;
  architectureVersion?: string;
  checks: VerificationCheck[];
  staticChecks: StaticCheck[];
  apiChecks: ApiCheck[];
  runtimeChecks: RuntimeCheck[];
  securityChecks: StaticCheck[];
  expectedTables: string[];
  testFiles: string[];
}

export interface VerificationFailure {
  type: FailureCategory;
  message: string;
  checkId: string;
  request?: { method: string; path: string; body?: Record<string, unknown> };
  response?: { status: number; details?: string };
  relatedArchitectureNodes: string[];
  generatedFiles: string[];
}

export interface VerificationCheckResult extends VerificationCheck {
  status: VerificationStatus;
  durationMs: number;
  details?: string;
  failure?: VerificationFailure;
}

export interface VerificationReport {
  status: "healthy" | "failed" | "timed_out";
  project: string;
  projectSlug: string;
  durationMs: number;
  summary: { total: number; passed: number; failed: number; warnings: number };
  checks: VerificationCheckResult[];
  failures: VerificationFailure[];
  verifiedAt: string;
}
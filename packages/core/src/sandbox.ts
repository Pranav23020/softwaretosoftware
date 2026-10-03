/**
 * Sandbox types and validation contracts for FORGE.
 *
 * Security invariants:
 *  - Disposable runtime execution only for reviewed/composed projects.
 *  - Resource quotas: CPU/memory caps (default 256MB), time caps (default 15s).
 *  - Network restriction: 127.0.0.1 loopback only.
 *  - Zero ambient host credentials or secrets passed to subprocess.
 */

export interface SandboxOptions {
  projectSlug?: string;
  port?: number;
  maxMemoryMb?: number;
  timeoutMs?: number;
  allowedHost?: string;
}

export interface ProbeCheck {
  name: string;
  endpoint: string;
  expectedStatus: number;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  details?: string;
}

export interface SandboxRunReport {
  status: "healthy" | "failed" | "timed_out";
  projectSlug: string;
  port: number;
  durationMs: number;
  maxMemoryMb: number;
  checks: ProbeCheck[];
  logs: string[];
  error?: string;
  verifiedAt: string;
}

export interface SandboxProcessStatus {
  running: boolean;
  pid?: number;
  port?: number;
  projectSlug?: string;
  uptimeSeconds?: number;
  startedAt?: string;
  lastLogs?: string[];
}

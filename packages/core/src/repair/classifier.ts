import type { FailureCategory, VerificationFailure } from "../verification/types.js";

export function classifyFailure(message: string, fallback: FailureCategory = "UNKNOWN"): FailureCategory {
  if (/cannot find module|module not found|ERR_MODULE_NOT_FOUND|TS2307|TS2304/i.test(message)) return /cannot find module|module not found|ERR_MODULE_NOT_FOUND/i.test(message) ? "IMPORT_FAILURE" : "BUILD_FAILURE";
  if (/TS\d+|build failed|compilation failed|type error/i.test(message)) return "BUILD_FAILURE";
  if (/no such table|foreign key constraint|SQLITE_|database/i.test(message)) return "DATABASE_FAILURE";
  if (/expected \d+, received \d+|HTTP|status code|request failed/i.test(message)) return "HTTP_FAILURE";
  if (/timeout|timed out|exceeded timeout|aborted/i.test(message)) return "TIMEOUT";
  if (/unauthorized|forbidden|invalid credentials|401|403/i.test(message)) return "AUTH_FAILURE";
  if (/security|path traversal|unsafe/i.test(message)) return "SECURITY_FAILURE";
  return fallback;
}

export function normalizeFailure(failure: VerificationFailure): VerificationFailure {
  return { ...failure, type: classifyFailure(failure.message, failure.type) };
}
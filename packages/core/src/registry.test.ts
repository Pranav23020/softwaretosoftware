import { describe, expect, it } from "vitest";
import {
  MODULE_REGISTRY,
  registryForCapability,
  resolveModules,
} from "./registry.js";
import { CATALOG } from "./index.js";
import type { CapabilityId } from "./index.js";

describe("Approved module registry", () => {
  it("has an entry for every capability in the CATALOG", () => {
    const catalogIds = Object.keys(CATALOG) as CapabilityId[];
    const registryIds = MODULE_REGISTRY.map(e => e.capability);
    for (const id of catalogIds) {
      expect(registryIds, `Missing registry entry for capability: ${id}`).toContain(id);
    }
  });

  it("has no duplicate capability registrations", () => {
    const caps = MODULE_REGISTRY.map(e => e.capability);
    const unique = new Set(caps);
    expect(caps.length).toBe(unique.size);
  });

  it("every template dest path is safe (no traversal, no backslash, no absolute)", () => {
    for (const entry of MODULE_REGISTRY) {
      for (const tpl of entry.templates) {
        expect(tpl.dest, `${entry.id} dest contains '..': ${tpl.dest}`).not.toContain("..");
        expect(tpl.dest, `${entry.id} dest contains backslash`).not.toContain("\\");
        expect(tpl.dest, `${entry.id} dest is absolute`).not.toMatch(/^[/A-Z]:/);
      }
    }
  });

  it("every template content is a non-empty string", () => {
    for (const entry of MODULE_REGISTRY) {
      for (const tpl of entry.templates) {
        expect(typeof tpl.content).toBe("string");
        expect(tpl.content.length).toBeGreaterThan(0);
      }
    }
  });

  it("registryForCapability returns the correct entry", () => {
    const entry = registryForCapability("authentication");
    expect(entry).toBeDefined();
    expect(entry!.capability).toBe("authentication");
    expect(entry!.id).toBe("local-auth");
  });

  it("registryForCapability returns undefined for an unknown capability", () => {
    // Cast to bypass type checking — simulates an unregistered future capability.
    const entry = registryForCapability("unknown-cap" as CapabilityId);
    expect(entry).toBeUndefined();
  });

  it("resolveModules returns entries in input order", () => {
    const caps: CapabilityId[] = ["database", "rest-api", "authentication"];
    const resolved = resolveModules(caps);
    expect(resolved.map(e => e.capability)).toEqual(caps);
  });

  it("resolveModules silently skips capabilities with no registry entry", () => {
    const caps: CapabilityId[] = ["database", "unknown-cap" as CapabilityId, "rest-api"];
    const resolved = resolveModules(caps);
    expect(resolved).toHaveLength(2);
    expect(resolved.map(e => e.capability)).toEqual(["database", "rest-api"]);
  });

  it("every entry has a valid ISO reviewedAt date", () => {
    const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
    for (const entry of MODULE_REGISTRY) {
      expect(entry.reviewedAt, `${entry.id} has invalid reviewedAt`).toMatch(ISO_RE);
    }
  });

  it("auth template includes timing-safe comparison to prevent timing attacks", () => {
    const auth = registryForCapability("authentication");
    expect(auth).toBeDefined();
    const content = auth!.templates[0]!.content;
    expect(content).toContain("timingSafeEqual");
  });

  it("upload adapter template uses allowlisted MIME types", () => {
    const upload = registryForCapability("file-upload");
    expect(upload).toBeDefined();
    const content = upload!.templates[0]!.content;
    expect(content).toContain("ALLOWED_MIME");
    expect(content).toContain("image/jpeg");
  });

  it("search template uses parameterized queries (no interpolation)", () => {
    const search = registryForCapability("search");
    expect(search).toBeDefined();
    const content = search!.templates[0]!.content;
    // Must bind with ? — never interpolate user input into SQL.
    expect(content).toContain("MATCH ?");
    expect(content).not.toMatch(/MATCH \$\{/);
  });
});

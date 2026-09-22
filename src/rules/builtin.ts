import type { AxRule } from "../types.js";

function specOf(value: Record<string, unknown>): Record<string, unknown> {
  return value.spec &&
    typeof value.spec === "object" &&
    !Array.isArray(value.spec)
    ? (value.spec as Record<string, unknown>)
    : {};
}

export const unrestrictedEgress: AxRule = {
  name: "ax/unrestricted-egress",
  defaultSeverity: "warning",
  description:
    "Warn when a Gateway allows every host. AX recommends tightening wildcard egress for production.",
  check(document, context) {
    if (document.value.kind !== "Gateway") return;
    const spec = specOf(document.value);
    const egress = spec.egress as Record<string, unknown> | undefined;
    const allowlist = egress?.allowlist as Record<string, unknown> | undefined;
    const hosts = Array.isArray(allowlist?.hosts) ? allowlist.hosts : [];
    hosts.forEach((entry, index) => {
      if (
        entry &&
        typeof entry === "object" &&
        (entry as { host?: unknown }).host === "*"
      )
        context.report({
          ruleId: "ax/unrestricted-egress",
          message:
            "Egress allows every host. Restrict hosts for production workloads.",
          path: `spec.egress.allowlist.hosts[${index}].host`,
          location: document.location(
            `spec.egress.allowlist.hosts.${index}.host`,
          ),
        });
    });
  },
};

export const debugEnabled: AxRule = {
  name: "ax/debug-enabled",
  defaultSeverity: "warning",
  description:
    "Warn when Task debug guest services enable process execution and file access.",
  check(document, context) {
    if (document.value.kind === "Task" && specOf(document.value).debug === true)
      context.report({
        ruleId: "ax/debug-enabled",
        message:
          "Debug guest services are enabled. Disable debug outside troubleshooting workflows.",
        path: "spec.debug",
        location: document.location("spec.debug"),
      });
  },
};

export const missingResourceLimits: AxRule = {
  name: "ax/missing-resource-limits",
  defaultSeverity: "warning",
  description: "Warn when a Task omits CPU or memory limits for its sandbox.",
  check(document, context) {
    if (document.value.kind !== "Task") return;
    const resources = specOf(document.value).resources as
      Record<string, unknown> | undefined;
    const limits = resources?.limits as Record<string, unknown> | undefined;
    if (typeof limits?.cpu !== "string" || typeof limits.memory !== "string")
      context.report({
        ruleId: "ax/missing-resource-limits",
        message: "Task should set both CPU and memory resource limits.",
        path: "spec.resources.limits",
        location: document.location("spec.resources.limits"),
      });
  },
};

export const latestImage: AxRule = {
  name: "ax/latest-image",
  defaultSeverity: "warning",
  description: "Warn when a Task image explicitly uses the mutable latest tag.",
  check(document, context) {
    if (document.value.kind !== "Task") return;
    const image = specOf(document.value).image;
    if (
      typeof image === "string" &&
      (image.endsWith(":latest") ||
        (!image.includes(":") && !image.includes("@")))
    )
      context.report({
        ruleId: "ax/latest-image",
        message: "Container image uses the mutable latest tag.",
        path: "spec.image",
        location: document.location("spec.image"),
      });
  },
};

export const unpinnedImage: AxRule = {
  name: "ax/unpinned-image",
  defaultSeverity: "warning",
  description: "Warn when a Task image is not pinned by digest.",
  check(document, context) {
    if (document.value.kind !== "Task") return;
    const image = specOf(document.value).image;
    if (typeof image === "string" && !image.includes("@sha256:"))
      context.report({
        ruleId: "ax/unpinned-image",
        message: "Container image is not pinned to a digest.",
        path: "spec.image",
        location: document.location("spec.image"),
      });
  },
};

export const possibleInlineSecret: AxRule = {
  name: "ax/possible-inline-secret",
  defaultSeverity: "warning",
  description:
    "Warn when a secret-like Task environment variable contains a literal value. Values are never included in diagnostics.",
  check(document, context) {
    if (document.value.kind !== "Task") return;
    const env = specOf(document.value).env;
    if (!Array.isArray(env)) return;
    env.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const item = entry as Record<string, unknown>;
      if (
        typeof item.name === "string" &&
        typeof item.value === "string" &&
        item.value.length > 0 &&
        /(?:secret|token|password|passwd|api[_-]?key|private[_-]?key|credential|auth)/i.test(
          item.name,
        )
      )
        context.report({
          ruleId: "ax/possible-inline-secret",
          message: `Environment variable ${JSON.stringify(item.name)} may contain an inline secret. Use a secret reference or runtime injection.`,
          path: `spec.env[${index}].value`,
          location: document.location(`spec.env.${index}.value`),
        });
    });
  },
};

export const workspaceSanity: AxRule = {
  name: "ax/workspace-sanity",
  defaultSeverity: "warning",
  description:
    "Warn about empty Git repository URLs and non-absolute skills paths in Workspace resources.",
  check(document, context) {
    if (document.value.kind !== "Workspace") return;
    const spec = specOf(document.value);
    if (Array.isArray(spec.git))
      spec.git.forEach((entry, index) => {
        if (
          entry &&
          typeof entry === "object" &&
          (entry as { repo?: unknown }).repo === ""
        )
          context.report({
            ruleId: "ax/workspace-sanity",
            message: "Workspace Git repository URL is empty.",
            path: `spec.git[${index}].repo`,
            location: document.location(`spec.git.${index}.repo`),
          });
      });
    const skills = spec.skills as Record<string, unknown> | undefined;
    if (typeof skills?.path === "string" && !skills.path.startsWith("/"))
      context.report({
        ruleId: "ax/workspace-sanity",
        message: "Workspace skills path should be absolute.",
        path: "spec.skills.path",
        location: document.location("spec.skills.path"),
      });
  },
};

export const builtinRules = [
  unrestrictedEgress,
  debugEnabled,
  missingResourceLimits,
  latestImage,
  unpinnedImage,
  possibleInlineSecret,
  workspaceSanity,
] as const;

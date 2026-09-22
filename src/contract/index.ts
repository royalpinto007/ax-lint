import type { ParsedDocument } from "../parser.js";
import type { AxDiagnostic } from "../types.js";

type Schema =
  | { type: "string" | "boolean" | "number" | "integer" | "any" }
  | { type: "array"; items: Schema }
  | { type: "object"; fields?: Record<string, Schema>; additional?: boolean }
  | { type: "oneOf"; variants: Schema[] };

const string: Schema = { type: "string" };
const boolean: Schema = { type: "boolean" };
const integer: Schema = { type: "integer" };
const any: Schema = { type: "any" };
const array = (items: Schema): Schema => ({ type: "array", items });
const oneOf = (...variants: Schema[]): Schema => ({ type: "oneOf", variants });
const object = (
  fields: Record<string, Schema>,
  additional = false,
): Schema => ({ type: "object", fields, additional });

const metadata = object({
  name: string,
  atespace: string,
  creationTimestamp: string,
});
const resourceList = object({ cpu: string, memory: string });
const taskSpec = object({
  suspend: boolean,
  image: string,
  command: array(string),
  env: array(object({ name: string, value: string })),
  resources: object({ requests: resourceList, limits: resourceList }),
  workspaces: array(object({ name: string, path: string, goal: string })),
  gateway: object({ name: string }),
  debug: boolean,
});
const gatewaySpec = object({
  listeners: array(object({ name: string, port: integer, protocol: string })),
  egress: object({
    allowlist: object({
      hosts: array(object({ host: string, port: integer })),
    }),
  }),
});
const mcpServer = object({
  name: string,
  endpoint: string,
  command: string,
  args: array(string),
});
const workspaceSpec = object({
  git: array(
    object({
      name: string,
      repo: string,
      branch: string,
      dir: string,
      depth: integer,
    }),
  ),
  mcp: oneOf(
    {
      type: "object",
      fields: {
        registries: array(
          object({
            provider: string,
            project: string,
            query: string,
            servers: array(mcpServer),
          }),
        ),
        servers: array(mcpServer),
      },
    },
    array(mcpServer),
  ),
  skills: object({
    registries: array(
      object({ provider: string, project: string, query: string }),
    ),
    path: string,
  }),
});
const secretKey = object({ name: string, key: string });
const modelSpec = object({
  provider: string,
  model: string,
  secretKey: oneOf(secretKey, string),
  secretKeyRef: secretKey,
  apiKey: object({ secretKeyRef: secretKey }),
  parameters: { type: "object", additional: true },
});
const status = object(
  {
    phase: string,
    id: string,
    actor: string,
    workerIP: string,
    pendingApproval: object({
      id: string,
      action: string,
      requestedAt: string,
    }),
    usage: object({ promptTokens: integer, completionTokens: integer }),
    conditions: array(
      object({
        type: string,
        status: string,
        lastTransitionTime: string,
        reason: string,
        message: string,
      }),
    ),
  },
  false,
);

const specs: Record<string, Schema> = {
  Task: taskSpec,
  Gateway: gatewaySpec,
  Workspace: workspaceSpec,
  Model: modelSpec,
};

function displayPath(path: string): string {
  return path.replace(/\.(\d+)(?=\.|$)/g, "[$1]");
}

function diagnostic(
  document: ParsedDocument,
  ruleId: string,
  message: string,
  path: string,
): AxDiagnostic {
  return {
    ruleId,
    severity: "error",
    category: "contract",
    message,
    path: displayPath(path),
    location: document.location(path),
  };
}

function matchesType(value: unknown, type: Schema["type"]): boolean {
  if (type === "any") return true;
  if (type === "oneOf") return true;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer")
    return typeof value === "number" && Number.isInteger(value);
  return typeof value === type;
}

function validateValue(
  document: ParsedDocument,
  value: unknown,
  schema: Schema,
  path: string,
  output: AxDiagnostic[],
): void {
  if (schema.type === "oneOf") {
    const matching = schema.variants.find((variant) =>
      matchesType(value, variant.type),
    );
    if (matching) validateValue(document, value, matching, path, output);
    else
      output.push(
        diagnostic(
          document,
          "contract/type",
          `${displayPath(path)} has an invalid type.`,
          path,
        ),
      );
    return;
  }
  if (!matchesType(value, schema.type)) {
    output.push(
      diagnostic(
        document,
        "contract/type",
        `${displayPath(path)} must be ${schema.type === "integer" ? "an integer" : `a ${schema.type}`}.`,
        path,
      ),
    );
    return;
  }
  if (schema.type === "array") {
    (value as unknown[]).forEach((item, index) =>
      validateValue(document, item, schema.items, `${path}.${index}`, output),
    );
  }
  if (schema.type === "object" && !schema.additional) {
    const fields = schema.fields ?? {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in fields))
        output.push(
          diagnostic(
            document,
            "contract/unknown-field",
            `Unknown AX field ${displayPath(childPath)}.`,
            childPath,
          ),
        );
      else {
        const field = fields[key];
        if (field) validateValue(document, child, field, childPath, output);
      }
    }
  }
}

function validateWorkspaceBindings(
  document: ParsedDocument,
  output: AxDiagnostic[],
): void {
  const spec = document.value.spec as Record<string, unknown> | undefined;
  if (!spec || !Array.isArray(spec.workspaces)) return;
  const names = new Set<string>();
  const paths = new Map<string, string>();
  spec.workspaces.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const workspace = raw as Record<string, unknown>;
    const base = `spec.workspaces.${index}`;
    if (typeof workspace.name !== "string" || workspace.name.length === 0) {
      output.push(
        diagnostic(
          document,
          "contract/required-field",
          `${displayPath(base)}.name is required.`,
          base,
        ),
      );
      return;
    }
    if (names.has(workspace.name))
      output.push(
        diagnostic(
          document,
          "contract/duplicate-workspace",
          `Workspace ${JSON.stringify(workspace.name)} is bound more than once.`,
          `${base}.name`,
        ),
      );
    names.add(workspace.name);
    if (typeof workspace.path === "string" && !workspace.path.startsWith("/"))
      output.push(
        diagnostic(
          document,
          "contract/workspace-path",
          `Workspace path ${JSON.stringify(workspace.path)} must be absolute.`,
          `${base}.path`,
        ),
      );
    const effective =
      (typeof workspace.path === "string" && workspace.path
        ? workspace.path
        : `/workspace/${workspace.name}`
      ).replace(/\/+$/, "") || "/";
    const other = paths.get(effective);
    if (other)
      output.push(
        diagnostic(
          document,
          "contract/duplicate-workspace-path",
          `Workspace path ${JSON.stringify(effective)} is already used by ${JSON.stringify(other)}.`,
          `${base}.path`,
        ),
      );
    paths.set(effective, workspace.name);
  });
}

export function validateContract(document: ParsedDocument): AxDiagnostic[] {
  const output: AxDiagnostic[] = [];
  const { value } = document;
  if (value.apiVersion !== undefined && value.apiVersion !== "ax.io/v1alpha1")
    output.push(
      diagnostic(
        document,
        "contract/api-version",
        "apiVersion must be ax.io/v1alpha1.",
        "apiVersion",
      ),
    );
  const kind = typeof value.kind === "string" ? value.kind : "";
  if (!(kind in specs))
    output.push(
      diagnostic(
        document,
        "contract/kind",
        "kind must be Task, Workspace, Gateway, or Model.",
        "kind",
      ),
    );
  const common = object({
    apiVersion: string,
    kind: string,
    metadata,
    spec: specs[kind] ?? any,
    ...(kind === "Task" ? { status } : {}),
  });
  validateValue(document, value, common, "", output);
  const meta = value.metadata as Record<string, unknown> | undefined;
  if (!meta || typeof meta.name !== "string" || meta.name.length === 0)
    output.push(
      diagnostic(
        document,
        "contract/required-field",
        "metadata.name is required.",
        "metadata.name",
      ),
    );
  if (kind === "Task") validateWorkspaceBindings(document, output);
  return output;
}

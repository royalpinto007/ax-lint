# Rules

Contract diagnostics report definite incompatibilities with the pinned AX API. Policy diagnostics report configurable security or reliability guidance.

## Contract diagnostics

| Rule                                | Meaning                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `contract/yaml-syntax`              | YAML cannot be parsed safely.                                            |
| `contract/document-type`            | A YAML document is not a mapping.                                        |
| `contract/api-version`              | `apiVersion` is not the supported `ax.io/v1alpha1`.                      |
| `contract/kind`                     | `kind` is not `Task`, `Workspace`, `Gateway`, or `Model`.                |
| `contract/unknown-field`            | A field is absent from the pinned protobuf contract.                     |
| `contract/type`                     | A value has the wrong structural type.                                   |
| `contract/required-field`           | Required resource identity or workspace binding data is missing.         |
| `contract/duplicate-workspace`      | A Task binds the same Workspace twice.                                   |
| `contract/workspace-path`           | A Task workspace mount path is relative.                                 |
| `contract/duplicate-workspace-path` | Two Task workspaces resolve to the same mount path.                      |
| `ax/invalid-reference`              | A Task references a Workspace or Gateway missing from the same atespace. |
| `ax/duplicate-resource`             | Two resources have the same kind, name, and atespace.                    |
| `ax/invalid-listener`               | A Gateway listener port is outside the valid TCP/UDP range.              |
| `ax/duplicate-listener`             | Gateway listener names or ports collide.                                 |

Contract diagnostics cannot be disabled.

## Policy diagnostics

### `ax/unrestricted-egress`

Warns when a Gateway host rule uses `"*"`. The official AX manifest guide describes this as allowing everything on the selected port and says to tighten it in production.

Reference: [AX Gateway manifest](https://github.com/google/ax/blob/d8ed0fe38bceb7842d3c47817d53d16ccdfcb601/docs/manifests.md#gateway)

### `ax/debug-enabled`

Warns when a Task enables `debug`. AX documents that this enables guest services providing arbitrary process execution and file access inside the sandbox.

Reference: [AX sandbox documentation](https://github.com/google/ax/blob/d8ed0fe38bceb7842d3c47817d53d16ccdfcb601/docs/sandbox.md)

### `ax/missing-resource-limits`

Warns unless a Task supplies both CPU and memory limits. AX positions sandbox resource limits as part of isolating untrusted agent code and includes both limits in its complete manifest example.

Reference: [AX Task manifest](https://github.com/google/ax/blob/d8ed0fe38bceb7842d3c47817d53d16ccdfcb601/docs/manifests.md#task)

### `ax/latest-image`

Warns for an explicit or implicit `latest` image tag because it is mutable. This is a best-practice warning, not an AX schema failure.

### `ax/unpinned-image`

Warns when a Task image is not pinned to a SHA-256 digest. The official complete AX example uses a digest-pinned image. This is a reproducibility warning, not an AX schema failure.

### `ax/possible-inline-secret`

Warns when a secret-like Task environment variable contains a literal value. The value is never copied into a diagnostic or formatter output. AX Model credentials use Kubernetes `secretKey` references in the official manifest guide.

Reference: [AX Model manifest](https://github.com/google/ax/blob/d8ed0fe38bceb7842d3c47817d53d16ccdfcb601/docs/manifests.md#model)

### `ax/workspace-sanity`

Warns for an empty Workspace Git repository URL or a relative skills path. This is a best-practice check over fields defined by the current Workspace contract.

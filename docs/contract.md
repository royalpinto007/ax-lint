# AX contract maintenance

`ax-lint@0.0.1` pins Google AX commit `d8ed0fe38bceb7842d3c47817d53d16ccdfcb601`.

The runtime contract lives under `src/contract/`. It is derived from the upstream protobuf, the strict YAML bridge and legacy normalizers in `types.go`, the official manifest guide, and official examples.

`npm run check:contract` is a maintainer-only network check. It downloads the pinned source files and verifies their SHA-256 hashes. Users never run this check and normal linting is fully offline.

When upstream changes, add a new contract or deliberately update the existing snapshot with fixtures and release notes. Never broaden a field or relationship based only on an example or assumption.

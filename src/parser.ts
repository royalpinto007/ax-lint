import { LineCounter, isNode, parseAllDocuments, type Document, type Node } from "yaml";
import type { AxDiagnostic, SourceLocation } from "./types.js";

export interface ParsedDocument {
  file: string;
  index: number;
  value: Record<string, unknown>;
  source: string;
  yaml: Document;
  location(path?: string): SourceLocation;
}

export interface ParseResult {
  documents: ParsedDocument[];
  diagnostics: AxDiagnostic[];
}

function position(lineCounter: LineCounter, file: string, offset = 0): SourceLocation {
  const point = lineCounter.linePos(Math.max(0, offset));
  return { file, line: point.line, column: point.col };
}

function nodeOffset(node: unknown): number | undefined {
  return isNode(node) && node.range ? node.range[0] : undefined;
}

export function parseAxSource(source: string, file = "<input>"): ParseResult {
  const lineCounter = new LineCounter();
  const yamlDocuments = parseAllDocuments(source, {
    lineCounter,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
    maxAliasCount: 100,
  });
  const documents: ParsedDocument[] = [];
  const diagnostics: AxDiagnostic[] = [];

  yamlDocuments.forEach((yaml, index) => {
    for (const error of yaml.errors) {
      diagnostics.push({
        ruleId: "contract/yaml-syntax",
        severity: "error",
        category: "contract",
        message: error.message.replace(/ at line \d+, column \d+:.*/s, ""),
        path: "",
        location: position(lineCounter, file, error.pos[0]),
      });
    }
    if (yaml.errors.length > 0 || yaml.contents === null) return;
    const value = yaml.toJS({ maxAliasCount: 100 }) as unknown;
    if (value === null) return;
    if (typeof value !== "object" || Array.isArray(value)) {
      diagnostics.push({
        ruleId: "contract/document-type",
        severity: "error",
        category: "contract",
        message: "Each AX document must be a YAML mapping.",
        path: "",
        location: position(lineCounter, file, nodeOffset(yaml.contents)),
      });
      return;
    }
    documents.push({
      file,
      index: index + 1,
      value: value as Record<string, unknown>,
      source,
      yaml,
      location(path = "") {
        const segments = path ? path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : [];
        let node: Node | null | undefined = yaml.contents;
        if (segments.length > 0) node = yaml.getIn(segments, true) as Node | null | undefined;
        return position(lineCounter, file, nodeOffset(node) ?? nodeOffset(yaml.contents));
      },
    });
  });
  return { documents, diagnostics };
}

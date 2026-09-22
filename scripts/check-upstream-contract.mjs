import { createHash } from "node:crypto";

const commit = "d8ed0fe38bceb7842d3c47817d53d16ccdfcb601";
const expected = {
  "pkg/apis/v1alpha1/ax.proto": "0da3f725f8520fd918c000483df8cc1cacf1f04b7d6842a7ccdec5bc24dcd704",
  "pkg/apis/v1alpha1/types.go": "5eba215b0833f22e910a4324d37bdece73cdf65f900d3edc6f652032f6af8ec0",
};

for (const [path, digest] of Object.entries(expected)) {
  const response = await fetch(`https://raw.githubusercontent.com/google/ax/${commit}/${path}`);
  if (!response.ok) throw new Error(`Unable to fetch ${path}: HTTP ${response.status}`);
  const actual = createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");
  if (actual !== digest) throw new Error(`${path} does not match the pinned AX contract.`);
}
console.log(`AX contract ${commit.slice(0, 12)} is unchanged.`);

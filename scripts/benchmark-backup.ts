// Synthetic only. No network, database, credentials or persistent archive output.
import { randomFillSync } from "node:crypto";
import { performance } from "node:perf_hooks";
import { exportZip } from "../src/lib/backup/export";
import { validateBackup } from "../src/lib/backup/validate";
import { sha256 } from "../src/lib/backup/format";
import { fixture, collect } from "../tests/backup-fixture";
async function main() {
  for (const scenario of ["5x10MB", "1000-small", "5000-records"] as const) {
    const bytes = randomFillSync(
      new Uint8Array(scenario === "5x10MB" ? 10_000_000 : 1000),
    );
    const s = await fixture(bytes);
    if (scenario !== "5000-records") {
      const n = scenario === "5x10MB" ? 5 : 1000;
      s.attachments = Array.from({ length: n }, () => ({
        ...s.attachments[0],
        id: crypto.randomUUID(),
      }));
      s.records[0].attachmentIds = s.attachments.map((a) => a.id);
    } else {
      s.entries = [];
      s.records = Array.from({ length: 5000 }, (_, i) => ({
        ...s.records[0],
        id: i === 0 ? s.records[0].id : crypto.randomUUID(),
        originalText: "合成长文字".repeat(30),
        attachmentIds: i === 0 ? s.records[0].attachmentIds : [],
      }));
    }
    const baseline = process.memoryUsage().rss;
    const started = performance.now();
    // Actual generator pull consumption; collector models bounded browser Blob fallback.
    const zip = await collect(exportZip(s, async () => bytes));
    const generated = performance.now();
    await validateBackup(zip);
    console.log(
      JSON.stringify({
        scenario,
        zipBytes: zip.length,
        exportMs: Math.round(generated - started),
        validateMs: Math.round(performance.now() - generated),
        rssDeltaMB: Math.round(
          (process.memoryUsage().rss - baseline) / 1024 / 1024,
        ),
        maxRssMB: Math.round(process.resourceUsage().maxRSS / 1024),
        sourceHash: (await sha256(bytes)).slice(0, 8),
      }),
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

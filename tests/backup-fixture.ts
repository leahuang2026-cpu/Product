import { sha256, type Snapshot } from "../src/lib/backup/format";
export const recordId = "11111111-1111-4111-8111-111111111111";
export const attachmentId = "22222222-2222-4222-8222-222222222222";
export const directionId = "33333333-3333-4333-8333-333333333333";
export const stamp = "2026-11-08T00:00:00.123456+00:00";
export const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWPYe/MrAATiAoxBHmUVAAAAAElFTkSuQmCC",
  "base64",
);
export async function fixture(bytes: Uint8Array = png): Promise<Snapshot> {
  const base = {
    title: "合成条目",
    body: "仅测试",
    domains: [] as [],
    next: "",
    sourceIds: [recordId],
    active: true,
    relationId: null,
    createdAt: stamp,
    deletedAt: null,
    sourceVersion: 3,
  };
  return {
    snapshotAt: stamp,
    records: [
      {
        id: recordId,
        originalText: "  合成原文\n保留空白。  ",
        note: "图片说明",
        domains: ["生活", "能力"],
        isIdea: true,
        links: ["https://example.test/user-supplied"],
        attachmentIds: [attachmentId],
        sourceId: null,
        createdAt: stamp,
        deletedAt: stamp,
        sourceVersion: 4,
      },
    ],
    entries: [
      { ...base, id: directionId, kind: "direction" },
      {
        ...base,
        id: "44444444-4444-4444-8444-444444444444",
        kind: "focus",
        active: false,
        relationId: directionId,
      },
      {
        ...base,
        id: "55555555-5555-4555-8555-555555555555",
        kind: "reflection",
        cadence: "monthly",
        deletedAt: stamp,
      },
    ],
    attachments: [
      {
        id: attachmentId,
        recordId,
        mime: "image/png",
        name: "../合成原图.png",
        bytes: bytes.length,
        sha256: await sha256(bytes),
      },
    ],
  };
}
export async function collect(stream: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  for await (const c of stream) chunks.push(c);
  return new Uint8Array(Buffer.concat(chunks));
}

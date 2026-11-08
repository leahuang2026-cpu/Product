import { LIMITS } from "./format";
import { validateBackup } from "./validate";
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    if (event.data.size > LIMITS.zip)
      throw new Error("文件超过 64 MiB 校验上限。");
    const summary = await validateBackup(
      new Uint8Array(await event.data.arrayBuffer()),
    );
    self.postMessage({ summary });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "文件校验未完成。",
    });
  }
};

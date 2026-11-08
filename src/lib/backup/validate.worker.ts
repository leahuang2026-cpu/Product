import { LIMITS } from "./format";
import { validateBackupDetails } from "./validate";
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    if (event.data.size > LIMITS.zip)
      throw new Error("文件超过 64 MiB 校验上限。");
    const result = await validateBackupDetails(
      new Uint8Array(await event.data.arrayBuffer()),
    );
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "文件校验未完成。",
    });
  }
};

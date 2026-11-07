import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  authorize,
  dataReady,
  fail,
  ok,
  ApiError,
  writeGuard,
} from "@/lib/server/supabase";
import { dbError } from "@/lib/server/records";
export async function POST(request: Request) {
  try {
    writeGuard(request);
    const { db, user } = await authorize();
    dataReady();
    if (Number(request.headers.get("content-length")) > 11_000_000)
      throw new ApiError(413, "TOO_LARGE", "上传请求超过当前服务上限。");
    const form = await request.formData(),
      file = form.get("file"),
      id = form.get("id");
    if (!(file instanceof File) || !z.string().uuid().safeParse(id).success)
      throw new ApiError(400, "INVALID_UPLOAD", "请选择有效附件。");
    const mime = file.type.split(";")[0];
    const isImage = ["image/jpeg", "image/png"].includes(mime);
    const isAudio = [
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ].includes(mime);
    if (!isImage && !isAudio)
      throw new ApiError(415, "INVALID_MEDIA", "当前不支持此附件格式。");
    const audioLimit = Number(process.env.PERSONAL_OS_MAX_AUDIO_BYTES || 0);
    if (isAudio && !audioLimit)
      throw new ApiError(
        503,
        "AUDIO_NOT_READY",
        "语音上传规格尚未配置，录音仍保留在当前页面，可试听或移除。",
      );
    const limit = isImage ? 10_000_000 : Math.min(audioLimit, 10_000_000);
    if (!file.size || file.size > limit)
      throw new ApiError(
        413,
        "TOO_LARGE",
        "附件超过当前服务上限，输入仍保留。",
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    if (isImage) {
      try {
        const image = sharp(bytes, { limitInputPixels: 40_000_000 });
        const info = await image.metadata();
        if (
          (mime === "image/png" && info.format !== "png") ||
          (mime === "image/jpeg" && info.format !== "jpeg")
        )
          throw new Error("format");
        await image.stats();
      } catch {
        throw new ApiError(
          422,
          "INVALID_IMAGE",
          "图片无法完整解码，或超过当前安全解码上限。请选择有效图片。",
        );
      }
    }
    const hash = createHash("sha256").update(bytes).digest("hex"),
      key = `${user.id}/${id}`;
    const old = await db
      .from("personal_os_attachments")
      .select("id,sha256")
      .eq("owner_id", user.id)
      .eq("id", id)
      .maybeSingle();
    dbError(old.error);
    if (old.data) {
      if (old.data.sha256 !== hash)
        throw new ApiError(
          409,
          "UPLOAD_CONFLICT",
          "附件请求已使用，请重新选择文件。",
        );
      return ok({ id: old.data.id });
    }
    const storage = db.storage.from("personal-os-private");
    const upload = await storage.upload(key, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upload.error) {
      const previous = await storage.download(key);
      if (
        previous.error ||
        !previous.data ||
        createHash("sha256")
          .update(Buffer.from(await previous.data.arrayBuffer()))
          .digest("hex") !== hash
      )
        throw new ApiError(
          503,
          "UPLOAD_FAILED",
          "图片或录音尚未确认上传成功，请重试或移除。",
        );
    }
    const row = {
      id,
      owner_id: user.id,
      object_key: key,
      mime,
      name: file.name.slice(0, 255),
      bytes: file.size,
      sha256: hash,
    };
    const saved = await db.from("personal_os_attachments").insert(row);
    if (saved.error) {
      const retry = await db
        .from("personal_os_attachments")
        .select("id,sha256")
        .eq("owner_id", user.id)
        .eq("id", id)
        .maybeSingle();
      if (retry.data?.sha256 !== hash) dbError(saved.error);
    }
    return ok({ id }, 201);
  } catch (e) {
    return fail(e);
  }
}

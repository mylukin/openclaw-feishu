import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { FeishuConfig } from "./types.js";
import { createFeishuClient } from "./client.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { execSync } from "child_process";

export type UploadImageResult = {
  imageKey: string;
};

export type UploadFileResult = {
  fileKey: string;
};

export type SendMediaResult = {
  messageId: string;
  chatId: string;
};

/**
 * Upload an image to Feishu and get an image_key for sending.
 * Supports: JPEG, PNG, WEBP, GIF, TIFF, BMP, ICO
 */
export async function uploadImageFeishu(params: {
  cfg: ClawdbotConfig;
  image: Buffer | string; // Buffer or file path
  imageType?: "message" | "avatar";
}): Promise<UploadImageResult> {
  const { cfg, image, imageType = "message" } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  // SDK expects a Readable stream, not a Buffer
  // Use type assertion since SDK actually accepts any Readable at runtime
  const imageStream =
    typeof image === "string" ? fs.createReadStream(image) : Readable.from(image);

  const response = await client.im.image.create({
    data: {
      image_type: imageType,
      image: imageStream as any,
    },
  });

  // SDK v1.30+ returns data directly without code wrapper on success
  // On error, it throws or returns { code, msg }
  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`Feishu image upload failed: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  const imageKey = responseAny.image_key ?? responseAny.data?.image_key;
  if (!imageKey) {
    throw new Error("Feishu image upload failed: no image_key returned");
  }

  return { imageKey };
}

/**
 * Upload a file to Feishu and get a file_key for sending.
 * Max file size: 30MB
 */
export async function uploadFileFeishu(params: {
  cfg: ClawdbotConfig;
  file: Buffer | string; // Buffer or file path
  fileName: string;
  fileType: "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream";
  duration?: number; // Required for audio/video files, in milliseconds
}): Promise<UploadFileResult> {
  const { cfg, file, fileName, fileType, duration } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  // SDK expects a Readable stream, not a Buffer
  // Use type assertion since SDK actually accepts any Readable at runtime
  const fileStream =
    typeof file === "string" ? fs.createReadStream(file) : Readable.from(file);

  const response = await client.im.file.create({
    data: {
      file_type: fileType,
      file_name: fileName,
      file: fileStream as any,
      ...(duration !== undefined && { duration }),
    },
  });

  // SDK v1.30+ returns data directly without code wrapper on success
  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`Feishu file upload failed: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  const fileKey = responseAny.file_key ?? responseAny.data?.file_key;
  if (!fileKey) {
    throw new Error("Feishu file upload failed: no file_key returned");
  }

  return { fileKey };
}

/**
 * Send an image message using an image_key
 */
export async function sendImageFeishu(params: {
  cfg: ClawdbotConfig;
  to: string;
  imageKey: string;
  replyToMessageId?: string;
}): Promise<SendMediaResult> {
  const { cfg, to, imageKey, replyToMessageId } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`Invalid Feishu target: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ image_key: imageKey });

  if (replyToMessageId) {
    const response = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: {
        content,
        msg_type: "image",
      },
    });

    if (response.code !== 0) {
      throw new Error(`Feishu image reply failed: ${response.msg || `code ${response.code}`}`);
    }

    return {
      messageId: response.data?.message_id ?? "unknown",
      chatId: receiveId,
    };
  }

  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content,
      msg_type: "image",
    },
  });

  if (response.code !== 0) {
    throw new Error(`Feishu image send failed: ${response.msg || `code ${response.code}`}`);
  }

  return {
    messageId: response.data?.message_id ?? "unknown",
    chatId: receiveId,
  };
}

/**
 * Send a file message using a file_key
 */
export async function sendFileFeishu(params: {
  cfg: ClawdbotConfig;
  to: string;
  fileKey: string;
  replyToMessageId?: string;
}): Promise<SendMediaResult> {
  const { cfg, to, fileKey, replyToMessageId } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`Invalid Feishu target: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ file_key: fileKey });

  if (replyToMessageId) {
    const response = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: {
        content,
        msg_type: "file",
      },
    });

    if (response.code !== 0) {
      throw new Error(`Feishu file reply failed: ${response.msg || `code ${response.code}`}`);
    }

    return {
      messageId: response.data?.message_id ?? "unknown",
      chatId: receiveId,
    };
  }

  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content,
      msg_type: "file",
    },
  });

  if (response.code !== 0) {
    throw new Error(`Feishu file send failed: ${response.msg || `code ${response.code}`}`);
  }

  return {
    messageId: response.data?.message_id ?? "unknown",
    chatId: receiveId,
  };
}

/**
 * Helper to detect file type from extension
 */
export function detectFileType(
  fileName: string,
): "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream" {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".opus":
    case ".ogg":
      return "opus";
    case ".mp4":
    case ".mov":
    case ".avi":
      return "mp4";
    case ".pdf":
      return "pdf";
    case ".doc":
    case ".docx":
      return "doc";
    case ".xls":
    case ".xlsx":
      return "xls";
    case ".ppt":
    case ".pptx":
      return "ppt";
    default:
      return "stream";
  }
}

/**
 * Check if a string is a local file path (not a URL)
 */
function isLocalPath(urlOrPath: string): boolean {
  // Starts with / or ~ or drive letter (Windows)
  if (urlOrPath.startsWith("/") || urlOrPath.startsWith("~") || /^[a-zA-Z]:/.test(urlOrPath)) {
    return true;
  }
  // Try to parse as URL - if it fails or has no protocol, it's likely a local path
  try {
    const url = new URL(urlOrPath);
    return url.protocol === "file:";
  } catch {
    return true; // Not a valid URL, treat as local path
  }
}

/**
 * Upload and send media (image or file) from URL, local path, or buffer
 */
export async function sendMediaFeishu(params: {
  cfg: ClawdbotConfig;
  to: string;
  mediaUrl?: string;
  mediaBuffer?: Buffer;
  fileName?: string;
  replyToMessageId?: string;
}): Promise<SendMediaResult> {
  const { cfg, to, mediaUrl, mediaBuffer, fileName, replyToMessageId } = params;

  let buffer: Buffer;
  let name: string;

  if (mediaBuffer) {
    buffer = mediaBuffer;
    name = fileName ?? "file";
  } else if (mediaUrl) {
    if (isLocalPath(mediaUrl)) {
      // Local file path - read directly
      const filePath = mediaUrl.startsWith("~")
        ? mediaUrl.replace("~", process.env.HOME ?? "")
        : mediaUrl.replace("file://", "");

      if (!fs.existsSync(filePath)) {
        throw new Error(`Local file not found: ${filePath}`);
      }
      buffer = fs.readFileSync(filePath);
      name = fileName ?? path.basename(filePath);
    } else {
      // Remote URL - fetch
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch media from URL: ${response.status}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
      name = fileName ?? (path.basename(new URL(mediaUrl).pathname) || "file");
    }
  } else {
    throw new Error("Either mediaUrl or mediaBuffer must be provided");
  }

  // Determine if it's an image based on extension
  const ext = path.extname(name).toLowerCase();
  const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".ico", ".tiff"].includes(ext);

  if (isImage) {
    const { imageKey } = await uploadImageFeishu({ cfg, image: buffer });
    return sendImageFeishu({ cfg, to, imageKey, replyToMessageId });
  } else {
    const fileType = detectFileType(name);
    const { fileKey } = await uploadFileFeishu({
      cfg,
      file: buffer,
      fileName: name,
      fileType,
    });
    return sendFileFeishu({ cfg, to, fileKey, replyToMessageId });
  }
}

/**
 * Download a media file from Feishu message using message_id and file_key
 * Returns the file content as a Buffer
 */
export async function downloadFeishuFile(params: {
  cfg: ClawdbotConfig;
  messageId: string;
  fileKey: string;
  fileType?: "audio" | "image" | "video" | "file";
}): Promise<Buffer> {
  const { cfg, messageId, fileKey, fileType = "audio" } = params;
  const feishuCfg = cfg.channels?.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    throw new Error("Feishu channel not configured");
  }

  const client = createFeishuClient(feishuCfg);

  // Use messageResource.get to download the file from a message
  const response = await client.im.messageResource.get({
    params: {
      type: fileType,
    },
    path: {
      message_id: messageId,
      file_key: fileKey,
    },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`Feishu download failed: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  // Get readable stream and convert to buffer
  const stream = responseAny.getReadableStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Download a voice/audio file from Feishu and save to local path
 */
export async function downloadFeishuVoice(params: {
  cfg: ClawdbotConfig;
  messageId: string;
  fileKey: string;
  outputPath?: string;
}): Promise<string> {
  const { cfg, messageId, fileKey, outputPath } = params;
  const buffer = await downloadFeishuFile({ cfg, messageId, fileKey, fileType: "audio" });

  const targetPath = outputPath ?? `/tmp/feishu_voice_${Date.now()}.wav`;

  // Ensure output directory exists
  const outputDir = path.dirname(targetPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, buffer);
  return targetPath;
}

/**
 * Transcribe a voice file using Whisper
 * Returns the transcription text
 */
export async function transcribeVoice(params: {
  voicePath: string;
  language?: string;
}): Promise<string> {
  const { voicePath, language = "zh" } = params;

  const modelPath = `${process.env.HOME}/.cache/whisper/ggml-large-v3.bin`;

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Whisper model not found: ${modelPath}`);
  }

  // Run whisper-cli to transcribe
  const command = `whisper-cli -m "${modelPath}" -f "${voicePath}" -l "${language}" -oj --no-timestamps`;
  const result = execSync(command, { encoding: "utf-8" });

  // Parse the JSON output
  try {
    const transcription = JSON.parse(result);
    return transcription.map((seg: any) => seg.text).join(" ").trim();
  } catch {
    // If not JSON, return the raw result
    return result.trim();
  }
}

/**
 * Download and transcribe a voice message from Feishu
 */
export async function downloadAndTranscribeVoice(params: {
  cfg: ClawdbotConfig;
  messageId: string;
  fileKey: string;
}): Promise<string> {
  const { cfg, messageId, fileKey } = params;

  // Download the voice file
  const voicePath = await downloadFeishuVoice({
    cfg,
    messageId,
    fileKey,
  });

  // Transcribe using Whisper
  const transcription = await transcribeVoice({ voicePath });

  return transcription;
}

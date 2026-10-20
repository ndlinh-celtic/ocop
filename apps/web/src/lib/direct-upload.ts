import type { UploadInstructions } from "@ocop/core";

/** PUT with progress; fetch has no upload progress, XMLHttpRequest does. Browser only. */
function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (sent: number) => void): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.getResponseHeader("ETag")) : reject(new Error(`Lưu trữ trả lỗi ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Không kết nối được tới kho lưu trữ"));
    xhr.send(body);
  });
}

/**
 * Sends a file straight to object storage following the upload instructions (L24): one PUT, or the parts
 * of a multipart upload whose ETags the server needs to complete it.
 */
export async function sendToStorage(file: File, upload: UploadInstructions, onProgress: (ratio: number) => void) {
  if (upload.kind === "single") {
    await put(upload.url, file, upload.headers, (sent) => onProgress(sent / file.size));
    return undefined;
  }
  const parts: { partNumber: number; etag: string }[] = [];
  let done = 0;
  for (const [i, url] of upload.partUrls.entries()) {
    const chunk = file.slice(i * upload.partSize, (i + 1) * upload.partSize);
    const etag = await put(url, chunk, {}, (sent) => onProgress((done + sent) / file.size));
    if (!etag) throw new Error("Kho lưu trữ không trả ETag (kiểm tra CORS ExposeHeaders)");
    parts.push({ partNumber: i + 1, etag });
    done += chunk.size;
  }
  return parts;
}

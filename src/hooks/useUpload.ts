"use client";

import { useState, useCallback } from "react";

interface UploadResult {
  key: string;
}

interface UseUploadOptions {
  projectId: string;
}

interface UseUploadReturn {
  upload: (file: File) => Promise<UploadResult>;
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
  error: string | null;
  reset: () => void;
}

export function useUpload({ projectId }: UseUploadOptions): UseUploadReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus("idle");
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      setProgress(0);
      setStatus("uploading");
      setError(null);

      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            filename: file.name,
            contentType: file.type,
            contentLength: file.size,
          }),
        });

        if (!presignRes.ok) {
          const data = await presignRes.json();
          throw new Error(data.error || "Не удалось получить ссылку для загрузки");
        }

        const { url, key } = await presignRes.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Загрузка не удалась: ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Сетевая ошибка при загрузке"));
          xhr.send(file);
        });

        setStatus("done");
        setProgress(100);
        return { key };
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        throw err;
      }
    },
    [projectId],
  );

  return { upload, progress, status, error, reset };
}

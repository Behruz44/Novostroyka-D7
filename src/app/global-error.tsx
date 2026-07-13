"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Что-то пошло не так</h1>
        <p className="mt-2 text-slate-600">
          Произошла ошибка при отображении страницы. Мы уже получили отчёт об ошибке.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-teal-700 px-4 py-2 text-white hover:bg-teal-800"
        >
          Попробовать снова
        </button>
      </body>
    </html>
  );
}

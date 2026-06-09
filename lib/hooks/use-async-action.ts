"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";

export type AsyncActionOptions = {
  /** Toast title to show on a thrown error. Defaults to "Something went wrong". */
  errorTitle?: string;
  /** Toast title to show on success. Omit to stay silent on success. */
  successTitle?: string;
  /** Optional secondary line shown under the success title. */
  successDescription?: string;
};

/**
 * Wraps an async action so every form/button gets:
 *   - a `loading` flag while in-flight
 *   - an automatic `toast.error(title, e.message)` on a thrown error
 *   - an automatic `toast.success(title)` when `successTitle` is provided
 *
 * Use the `errorMessage` return for inline form errors (alongside the toast).
 *
 *   const { run, loading, errorMessage } = useAsyncAction(
 *     async (input) => myMutation({ variables: { input } }),
 *     { errorTitle: "Couldn't save", successTitle: "Saved" },
 *   );
 *   <Button onClick={() => run(input)} loading={loading}>Save</Button>
 *   {errorMessage ? <p role="alert">{errorMessage}</p> : null}
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: AsyncActionOptions = {},
) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await action(...args);
        if (options.successTitle) {
          toast.success(options.successTitle, options.successDescription);
        }
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Try again.";
        setErrorMessage(msg);
        toast.error(options.errorTitle ?? "Something went wrong", msg);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [action, options.errorTitle, options.successTitle, options.successDescription, toast],
  );

  return { run, loading, errorMessage, clearError: () => setErrorMessage(null) };
}

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-start px-4 py-16"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, #0b4f4a 0%, #061f1d 60%, #061513 100%)",
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}

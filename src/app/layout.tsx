import type { ReactNode } from "react";

// Il layout vero è in [locale]/layout.tsx, qui serve solo come radice richiesta da Next.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

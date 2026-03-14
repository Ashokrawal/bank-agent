import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: { default: "NovaBanк", template: "%s | NovaBanк" },
  description: "Smart banking powered by AI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Navbar />
          <main style={{ minHeight: "calc(100vh - 64px)" }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

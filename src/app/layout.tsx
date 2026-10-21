import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { SiteTopBar } from "@/components/site-top-bar";
import { ensureDbReady } from "@/db";
import { ensureSiteCompetition } from "@/lib/competition";
import "./globals.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "WADL Tab — Competition Management",
  description:
    "Western Australian Debating League competition management and tabulation system",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureDbReady();
  await ensureSiteCompetition();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>
          <SiteTopBar />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

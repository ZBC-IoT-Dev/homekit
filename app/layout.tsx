import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { getToken } from "@/lib/auth-server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IoT HomeKit",
  description: "Minimal dashboard til styring af dit smarte hjem.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();
  return (
    <html lang="da">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <ConvexClientProvider initialToken={token}>
          <TooltipProvider>{children}</TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

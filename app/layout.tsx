import type { Metadata } from "next";
import { Crimson_Pro, Stack_Sans_Text } from "next/font/google";
import "./globals.css";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  display: "swap",
});

const stackSansText = Stack_Sans_Text({
  variable: "--font-stack-sans-text",
  subsets: ["latin"],
  weight: ["200", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Auto Beli",
  description: "Organize food photos into location and time-based clusters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${crimsonPro.variable} ${stackSansText.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bioctl",
  description: "A self-hosted link page with an isolated AI chat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

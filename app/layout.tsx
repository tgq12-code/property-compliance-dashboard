import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Property Compliance Dashboard",
  description: "Track property taxes, business filings, and recurring obligations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

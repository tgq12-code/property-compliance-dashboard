import type { Metadata } from "next";
import "./globals.css";
import AppFrame from "@/components/AppFrame";

export const metadata: Metadata = {
  title: "Vo Family Operations",
  description: "A simple private family command center for properties, businesses, deadlines and reminders.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppFrame>{children}</AppFrame></body>
    </html>
  );
}

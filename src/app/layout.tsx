import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "TaskBoard",
  description: "A small project management tool for the fullstack assessment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

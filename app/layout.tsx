import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kumpas — Movement with meaning",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  description:
    "Personal gestures. Familiar voices. An offline communication aid for Filipino families.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

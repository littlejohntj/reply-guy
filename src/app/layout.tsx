import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reply Guy",
  description: "Twitter engagement automation tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

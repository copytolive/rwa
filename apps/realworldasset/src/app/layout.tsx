import type { Metadata } from "next";
import "./globals.css";
import "./pixel-parity.css";
import "./pixel-parity-final.css";
import "./pixel-parity-lock.css";
import "./pixel-parity-assets.css";
import "./pixel-parity-chat03.css";
import "./final-interaction-lock.css";
import "./landing-production-lock.css";
import "./layout-consistency-lock.css";

export const metadata: Metadata = {
  title: "RWA.MS",
  description: "Real-world asset platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

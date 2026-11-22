import type { Metadata, Viewport } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import WalletContextProvider from "./providers/WalletProvider";
import { SITE } from "./lib/profileFormat";

const TITLE = "PROVN — The developer résumé nobody can fake";
const DESCRIPTION =
  "A verified developer profile and résumé built from your merged GitHub work. Every claim links to proof.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060709",
  colorScheme: "dark",
};

// The Open Graph image, icons and manifest come from the file conventions in app/
// (opengraph-image.tsx, icon.svg, apple-icon.tsx, manifest.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "PROVN",
  keywords: [
    "developer résumé",
    "verified developer profile",
    "GitHub contributions",
    "merged pull requests",
    "open source",
    "proof of work",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    siteName: "PROVN",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <WalletContextProvider>
          {children}
          <Footer />
        </WalletContextProvider>
      </body>
    </html>
  );
}

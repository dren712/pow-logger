import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import WalletContextProvider from "./providers/WalletProvider";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "PROVN — Proof-of-Work Logger 🗿",
  description: "Solana-native, wallet-authenticated proof-of-work protocol permanently archived on Arweave.",
  metadataBase: new URL('https://provn-sol.vercel.app'),
  openGraph: {
    title: 'PROVN — Proof-of-Work Logger 🗿',
    description: 'Solana-native, wallet-authenticated proof-of-work protocol permanently archived on Arweave.',
    url: 'https://provn-sol.vercel.app',
    siteName: 'PROVN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROVN — Proof-of-Work Logger 🗿',
    description: 'Your work, cryptographically verified & permanently archived. 🗿',
  },
  other: {
    'theme-color': '#060709',
  },
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

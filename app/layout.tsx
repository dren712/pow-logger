import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import WalletContextProvider from "./providers/WalletProvider";

export const metadata: Metadata = {
  title: "PROVN — Proof-of-Work Logger 🗿",
  description: "Cryptographically verified daily work logs on Solana. Build your on-chain builder reputation.",
  metadataBase: new URL('https://provn-sol.vercel.app'),
  openGraph: {
    title: 'PROVN — Proof-of-Work Logger 🗿',
    description: 'Cryptographically verified daily work logs on Solana. Build your on-chain builder reputation.',
    url: 'https://provn-sol.vercel.app',
    siteName: 'PROVN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROVN — Proof-of-Work Logger 🗿',
    description: 'Your work, permanently on-chain. 🗿',
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

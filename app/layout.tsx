import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import WalletContextProvider from "./providers/WalletProvider";

export const metadata: Metadata = {
  title: "PoWL — Proof-of-Work Logger",
  description: "Cryptographically verified daily work logs on Solana. Build your on-chain builder reputation.",
  metadataBase: new URL('https://pow-logger.vercel.app'),
  openGraph: {
    title: 'PoWL — Proof-of-Work Logger',
    description: 'Cryptographically verified daily work logs on Solana. Build your on-chain builder reputation.',
    url: 'https://pow-logger.vercel.app',
    siteName: 'PoWL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PoWL — Proof-of-Work Logger',
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

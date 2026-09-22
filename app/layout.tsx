import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import WalletContextProvider from "./providers/WalletProvider";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08090d',
};

export const metadata: Metadata = {
  title: "PROVN — Autonomous Agent Provenance & Cryptographic Trust Layer",
  description: "Cryptographically seal autonomous AI agent traces and developer proof-of-work with Ed25519 signatures, hash chains, and Merkle roots anchored to Solana.",
  metadataBase: new URL('https://provn-sol.vercel.app'),
  openGraph: {
    title: 'PROVN — Autonomous Agent Provenance & Cryptographic Trust Layer',
    description: 'Deterministic Ed25519 signatures, hash chains, and Merkle roots anchored to Solana and preserved on Arweave.',
    url: 'https://provn-sol.vercel.app',
    siteName: 'PROVN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROVN — Autonomous Agent Provenance & Cryptographic Trust Layer',
    description: 'Deterministic Ed25519 signatures, hash chains, and Merkle roots anchored to Solana.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#08090d] text-[#f0f4fc]">
        <WalletContextProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <Footer />
        </WalletContextProvider>
      </body>
    </html>
  );
}

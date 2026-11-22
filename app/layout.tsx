import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import WalletContextProvider from "./providers/WalletProvider";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "PROVN — The developer résumé nobody can fake",
  description: "A verified developer profile and résumé built from your merged GitHub work. Every claim links to proof.",
  metadataBase: new URL('https://provn-sol.vercel.app'),
  openGraph: {
    title: 'PROVN — The developer résumé nobody can fake',
    description: 'A verified developer profile and résumé built from your merged GitHub work. Every claim links to proof.',
    url: 'https://provn-sol.vercel.app',
    siteName: 'PROVN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PROVN — The developer résumé nobody can fake',
    description: 'A verified developer profile and résumé built from your merged GitHub work.',
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

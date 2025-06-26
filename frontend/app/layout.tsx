import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WNBA Fantasy Analytics",
  description: "Advanced analytics platform for WNBA fantasy basketball. Player stats, consistency scores, trade calculator, and daily recommendations.",
  keywords: "WNBA, fantasy basketball, analytics, player stats, trade calculator, waiver wire",
  authors: [{ name: "WNBA Fantasy Analytics" }],
  openGraph: {
    title: "WNBA Fantasy Analytics",
    description: "Advanced analytics platform for WNBA fantasy basketball",
    type: "website",
    locale: "en_US",
    siteName: "WNBA Fantasy Analytics",
  },
  twitter: {
    card: "summary_large_image",
    title: "WNBA Fantasy Analytics",
    description: "Advanced analytics platform for WNBA fantasy basketball",
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-wnba-gray-50 text-wnba-gray-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Mona_Sans, Geist_Mono } from "next/font/google";
import { ApolloWrapper } from "@/lib/apollo/provider";
import "./globals.css";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PoolDN — Pool & Billiards Leagues",
  description: "Manage pool leagues, teams, and competitions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${monaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ApolloWrapper>{children}</ApolloWrapper>
      </body>
    </html>
  );
}

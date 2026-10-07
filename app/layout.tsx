import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Tell LeadScout what you sell and where you are. Get a ranked list of nearby businesses likely to buy from you, with public contact details.";

export const metadata: Metadata = {
  title: "LeadScout — find clients near you",
  description,
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  openGraph: { title: "LeadScout — find clients near you", description, type: "website" },
  twitter: { card: "summary", title: "LeadScout — find clients near you", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">{children}</body>
    </html>
  );
}

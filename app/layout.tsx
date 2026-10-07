import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
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
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}

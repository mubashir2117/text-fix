import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600"],
  adjustFontFallback: false,
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Text Fixer — Check your social media copy before you post",
  description:
    "Upload a social media post, ad, or banner and let AI check the text for spelling, grammar, and marketing-copy issues before you publish.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans text-ink antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#1C1B19",
              color: "#F7F5F1",
              border: "1px solid #1C1B19",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
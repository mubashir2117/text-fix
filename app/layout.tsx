import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, Inter, Manrope, Poppins, DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

// Post-design fonts — the recreation prompt may pick any of these five
// (max two per design), so all five are self-hosted at build time and
// mapped to CSS variables consumed by components/recreated-post.tsx.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-post-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-post-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-post-poppins",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-post-dmsans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-post-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AI Text Fixer — Check your social media copy before you post",
  description:
    "Upload a social media post, ad, or banner and let AI check the text for spelling, grammar, and marketing-copy issues before you publish.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${inter.variable} ${manrope.variable} ${poppins.variable} ${dmSans.variable} ${jakarta.variable}`}
    >
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
              background: "#1B1F1C",
              color: "#EFF1EA",
              border: "1px solid #1B1F1C",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}

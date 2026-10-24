import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finora",
  description: "Controle suas finanças de forma simples e eficiente.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.className} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#181642]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

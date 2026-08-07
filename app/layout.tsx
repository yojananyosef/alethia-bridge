import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ExegesisProvider } from "../src/components/ExegesisProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alethia Bridge — Análisis Exegético",
  description:
    "Software de estudio bíblico con lector interlineal, búsqueda FTS5 y análisis léxico-morfológico.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ExegesisProvider>{children}</ExegesisProvider>
      </body>
    </html>
  );
}

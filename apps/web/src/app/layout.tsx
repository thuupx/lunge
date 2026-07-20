import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ScrollReveal } from "@/components/scroll-reveal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Volley - Agent-native API testing MCP server",
  description:
    "An MCP server that lets AI agents perform API testing autonomously - REST, GraphQL, WebSocket, SSE, and gRPC - without any GUI. Lightweight, token-efficient, built on a Rust core.",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "API testing",
    "REST",
    "GraphQL",
    "WebSocket",
    "SSE",
    "Rust",
    "AI agents",
    "Postman alternative",
  ],
  authors: [{ name: "volley" }],
  openGraph: {
    title: "Volley - Agent-native API testing MCP server",
    description:
      "An MCP server that lets AI agents perform API testing autonomously - REST, GraphQL, WebSocket, SSE, and gRPC.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ScrollReveal />
        {children}
      </body>
    </html>
  );
}

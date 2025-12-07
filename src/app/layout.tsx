import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/space-grotesk/SpaceGrotesk-300.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/space-grotesk/SpaceGrotesk-400.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/space-grotesk/SpaceGrotesk-500.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/space-grotesk/SpaceGrotesk-600.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/space-grotesk/SpaceGrotesk-700.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

const mono = localFont({
  src: [
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-100.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-200.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-300.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-400.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-500.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-600.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/roboto-mono/RobotoMono-700.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Homepage | Collaborative Car Configurator",
  description:
    "Homepage for the collaborative car configurator: branching, live cursors, inline notes, and AI guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

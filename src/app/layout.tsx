import type { Metadata } from "next";
import "@fontsource/comfortaa/latin-400.css";
import "@fontsource/comfortaa/latin-500.css";
import "@fontsource/comfortaa/latin-600.css";
import "@fontsource/comfortaa/latin-700.css";
import "./globals.css";
import { Provider } from "@/components/provider";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: "TEX3D · Seu estúdio criativo",
  description:
    "Organize projetos 3D, acompanhe suas finanças e calcule suas impressões.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Provider>
          <Shell>{children}</Shell>
        </Provider>
      </body>
    </html>
  );
}

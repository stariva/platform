import localFont from "next/font/local";

// Self-hosted variable fonts (Google Fonts "latin" + "cyrillic" subsets),
// so builds don't depend on reaching fonts.googleapis.com.
const cormorant = localFont({
  src: [
    {
      path: "./fonts/cormorant-garamond-var.woff2",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "./fonts/cormorant-garamond-italic-var.woff2",
      weight: "400 700",
      style: "italic",
    },
  ],
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const inter = localFont({
  src: "./fonts/inter-var.woff2",
  weight: "300 600",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

/** Классы для <html>: и корневой layout, и global-error рисуют свой документ. */
export const fontVariables = `${cormorant.variable} ${inter.variable}`;

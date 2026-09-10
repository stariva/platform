import { SITE_URL as BASE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";



export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/colors-demo",
          "/api/",
          "/account",
          "/sign-in",
          "/sign-up",
          "/magic-link",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}

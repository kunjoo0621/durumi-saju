import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/result/share/"],
        disallow: ["/api/", "/result/", "/checkout/", "/my/"],
      },
    ],
    sitemap: "https://www.durumisaju.com/sitemap.xml",
  };
}

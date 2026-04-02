import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/result/share/", "/battle/result/share/"],
        disallow: ["/api/", "/result/", "/battle/result/", "/checkout/", "/my/", "/edit-profile/"],
      },
    ],
    sitemap: "https://www.durumisaju.com/sitemap.xml",
  };
}

import type { MetadataRoute } from "next";
import { getAllDictEntries } from "@/lib/dict/registry";
import type { DictCategory } from "@/lib/dict/types";

const BASE = "https://www.durumisaju.com";

const DICT_CATEGORIES: DictCategory[] = [
  "saju",
  "pillars",
  "cheongan",
  "jiji",
  "gabja",
  "ohaeng",
  "sipsung",
  "unseong12",
  "relation",
  "sinsal",
  "sipisinsal",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/menu`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/start`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/battle/input`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/dict`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/coins`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const dictCategoryPages: MetadataRoute.Sitemap = DICT_CATEGORIES.map((cat) => ({
    url: `${BASE}/dict/${cat}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const dictDetailPages: MetadataRoute.Sitemap = getAllDictEntries().map((e) => ({
    url: `${BASE}/dict/${e.category}/${e.slug}`,
    lastModified: new Date(e.updatedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...dictCategoryPages, ...dictDetailPages];
}

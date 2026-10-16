import type { Metadata } from "next";

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
/** Public origin for metadata, robots and sitemap. `SITE_URL` overrides Vercel's host. */
export function siteUrl(): URL {
  return new URL(process.env.SITE_URL || (host ? `https://${host}` : "http://localhost:3000"));
}

/** Supply complete social objects: Next replaces nested metadata rather than merging it. */
export function pageMetadata({
  path,
  title,
  description,
  image,
  imageAlt,
}: {
  path: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}): Metadata {
  // Every language shares one URL; the locale cookie picks the copy.
  const alternates = { canonical: path };
  const images = [{ url: image, width: 1200, height: 630, type: "image/png", alt: imageAlt }];
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      images,
      type: "website",
      siteName: "Horizon",
      url: alternates.canonical,
      // Share copy is English for every route.
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

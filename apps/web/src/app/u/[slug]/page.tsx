import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import {
  GetPublicStartPageBySlug,
  RecordStartPageView,
  buildMetaDescription,
  buildPublicPagePath,
} from "@/domains/start-page";
import { StartPageProfile } from "@/components/start-page/StartPageProfile";
import { getServerEnv } from "@/lib/env";
import {
  publicStartPageRepository,
  startPageAnalyticsRepository,
} from "@/lib/repositories/start-page";

/**
 * Lookup dibagi antara `generateMetadata` dan halaman dalam satu request
 * (`cache` React) supaya tidak query dua kali.
 */
const getPublicPage = cache((slug: string) =>
  new GetPublicStartPageBySlug(publicStartPageRepository).execute(slug),
);

/**
 * Metadata SEO/sharing (T-071). Hanya halaman published yang ada; slug tak
 * ada/draft -> `noindex` (halaman 404). `metadataBase` dari
 * `BETTER_AUTH_URL` agar URL OG absolut.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) {
    return { title: "Halaman tidak ditemukan", robots: { index: false } };
  }

  const description = buildMetaDescription(
    page.bio,
    `Tautan resmi ${page.title}`,
  );
  const path = buildPublicPagePath(page.slug);
  const baseUrl = getServerEnv().BETTER_AUTH_URL;
  return {
    ...(baseUrl ? { metadataBase: new URL(baseUrl) } : {}),
    title: page.title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      title: page.title,
      description,
      url: path,
      ...(page.avatarUrl ? { images: [{ url: page.avatarUrl }] } : {}),
    },
    twitter: {
      card: "summary",
      title: page.title,
      description,
      ...(page.avatarUrl ? { images: [page.avatarUrl] } : {}),
    },
  };
}

/**
 * Halaman publik Start Page (T-070.4, ADR-128) — di-bypass penuh dari auth
 * gate `proxy.ts`, jadi TIDAK ada session/workspace context di sini.
 *
 * Server Component tipis: hanya memanggil use-case, mencatat view, lalu
 * merender `StartPageProfile` (Card Stack, T-071). Data sudah disanitasi
 * use-case (url tautan http/https, avatar https); `href` tautan selalu
 * lewat redirect tracked, bukan URL tujuan.
 */
export default async function PublicStartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await getPublicPage(slug);
  if (!page) notFound();

  // Hitung kunjungan SETELAH respons terkirim (T-074): best-effort, tidak
  // menunda render dan kegagalan counter tidak boleh merusak halaman. Membaca
  // `headers()` juga menjadikan route ini dinamis (tidak di-cache statis),
  // jadi tiap request dihitung dan unpublish berlaku seketika.
  // Next.js merender `HEAD` sebagai `GET` dan tidak mengekspos metodenya ke
  // page, jadi header Fetch Metadata diteruskan ke use-case yang menyaring
  // hanya navigasi dokumen browser (T-162.1).
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const fetchDest = requestHeaders.get("sec-fetch-dest");
  const fetchMode = requestHeaders.get("sec-fetch-mode");
  after(async () => {
    try {
      await new RecordStartPageView(startPageAnalyticsRepository).execute({
        slug: page.slug,
        userAgent,
        fetchDest,
        fetchMode,
      });
    } catch (error) {
      console.error("start-page: gagal mencatat view", error);
    }
  });

  return <StartPageProfile page={page} />;
}

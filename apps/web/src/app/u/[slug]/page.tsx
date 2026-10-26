import { notFound } from "next/navigation";

import { GetPublicStartPageBySlug } from "@/domains/start-page";
import { publicStartPageRepository } from "@/lib/repositories/start-page";

/**
 * Halaman publik Start Page (T-070.4, ADR-128) — di-bypass penuh dari auth
 * gate `proxy.ts`, jadi TIDAK ada session/workspace context di sini.
 *
 * Server Component tipis: hanya memanggil use-case lalu `notFound()`.
 * Markup di bawah SENGAJA minimal dan belum final — tampilan (Card Stack)
 * dibangun di T-071. Catatan untuk T-071: `url` tautan berasal dari input
 * workspace dan belum divalidasi skemanya di sini, jadi hanya ditampilkan
 * sebagai teks (bukan `href`) sampai validasi skema URL (http/https) ada.
 */
export default async function PublicStartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await new GetPublicStartPageBySlug(
    publicStartPageRepository,
  ).execute(slug);
  if (!page) notFound();

  return (
    <main>
      <h1>{page.title}</h1>
      {page.bio ? <p>{page.bio}</p> : null}
      <ul>
        {page.links.map((link) => (
          <li key={link.id}>
            {link.label} — {link.url}
          </li>
        ))}
      </ul>
    </main>
  );
}

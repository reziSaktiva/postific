"use client";

import { useState } from "react";

import type {
  StartPageLinkRecord,
  StartPageRecord,
} from "@/domains/start-page";

import { CreateStartPageCard } from "./CreateStartPageCard";
import { LinkListCard } from "./LinkListCard";
import { PreviewCard } from "./PreviewCard";
import {
  hasNoAnalyticsData,
  toPreviewPage,
  toProfileDraft,
  type ProfileDraft,
} from "./profile-draft";
import { ProfileCard } from "./ProfileCard";
import { ShareCard } from "./ShareCard";
import { VisitsStat } from "./VisitsStat";

function PageHead({ aside }: { aside?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <hgroup className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Start Page
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola link, preview, dan bagikan halaman publik Anda
        </p>
      </hgroup>
      {aside}
    </header>
  );
}

/**
 * Page Editor Start Page (T-072/T-073/T-074). Memegang state halaman +
 * draft profil (supaya Preview langsung mengikuti isian & pilihan tema).
 * Server Action tetap sumber kebenaran: hasilnya menggantikan state lokal.
 */
export function StartPageEditor({
  initialPage,
  appOrigin,
}: {
  initialPage: StartPageRecord | null;
  appOrigin: string | null;
}) {
  const [page, setPage] = useState(initialPage);
  const [draft, setDraft] = useState<ProfileDraft | null>(
    initialPage ? toProfileDraft(initialPage) : null,
  );

  function adopt(next: StartPageRecord) {
    setPage(next);
    setDraft(toProfileDraft(next));
  }

  if (!page || !draft) {
    return (
      <section className="flex flex-col gap-6">
        <PageHead />
        <CreateStartPageCard onCreated={adopt} />
      </section>
    );
  }

  function handleLinksChange(links: StartPageLinkRecord[]) {
    setPage((current) => (current ? { ...current, links } : current));
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHead aside={<VisitsStat viewCount={page.viewCount} />} />
      <section className="grid items-start gap-3.5 xl:grid-cols-5">
        <section className="flex flex-col gap-3.5 xl:col-span-3">
          <ProfileCard
            page={page}
            draft={draft}
            onDraftChange={(patch) =>
              setDraft((current) =>
                current ? { ...current, ...patch } : current,
              )
            }
            onSaved={adopt}
          />
          <LinkListCard
            links={page.links}
            showZeroHint={page.links.length > 0 && hasNoAnalyticsData(page)}
            onLinksChange={handleLinksChange}
          />
        </section>
        <aside className="flex flex-col gap-3.5 xl:col-span-2">
          <PreviewCard page={toPreviewPage(page, draft)} />
          <ShareCard
            page={page}
            appOrigin={appOrigin}
            onPublishedChange={(next) =>
              setPage((current) =>
                current
                  ? { ...current, isPublished: next.isPublished }
                  : current,
              )
            }
          />
        </aside>
      </section>
    </section>
  );
}

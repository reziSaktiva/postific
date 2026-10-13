import { asUserId } from "@postific/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceService } from "@/domains/workspace";
import { auth } from "@/lib/better-auth/auth";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { CreateWorkspaceForm } from "./components/CreateWorkspaceForm";
import { WorkspacePicker } from "./components/WorkspacePicker";

/**
 * Dua state re-entry point onboarding (T-039.4, desain di Claude Design
 * `templates/onboarding.html`): (1) user baru tanpa workspace → form buat
 * workspace pertama, (2) user existing kehilangan cookie
 * `active-workspace-id` — kalau cuma 1 membership aktif, auto-resolve lewat
 * `/onboarding/resume` (Route Handler, karena RSC tidak bisa `cookies().set()`,
 * lihat komentar di sana); kalau >1, tampilkan picker supaya user memilih
 * sendiri alih-alih auto-pick diam-diam (gap lama yang ditutup task ini).
 */
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const memberships = await workspaceService.listWorkspacesForUser(
    asUserId(session.user.id),
  );

  if (memberships.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buat Workspace Pertama Anda</CardTitle>
          <CardDescription>
            Workspace adalah tempat tim Anda mengelola konten media sosial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm />
        </CardContent>
      </Card>
    );
  }

  if (memberships.length === 1) {
    redirect("/onboarding/resume");
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Buat Workspace</CardTitle>
          <CardDescription>
            Butuh ruang kerja baru? Buat workspace tambahan kapan saja.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pilih Workspace</CardTitle>
          <CardDescription>
            Anda tergabung di beberapa workspace. Pilih salah satu untuk
            melanjutkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspacePicker
            workspaces={memberships.map((membership) => ({
              id: membership.workspaceId,
              name: membership.name,
              role: membership.role,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}

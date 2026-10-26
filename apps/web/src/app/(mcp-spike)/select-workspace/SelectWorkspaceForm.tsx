"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { authClient } from "@/lib/better-auth/client";

import { chooseWorkspaceAction } from "./actions";

type WorkspaceOption = { id: string; name: string; role: string };

export function SelectWorkspaceForm({
  email,
  workspaces,
}: {
  email: string;
  workspaces: WorkspaceOption[];
}) {
  const [selected, setSelected] = useState(workspaces[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    setError(null);
    setIsSubmitting(true);
    const result = await chooseWorkspaceAction(selected);
    if (!result.ok) {
      setIsSubmitting(false);
      setError("Workspace tidak valid.");
      return;
    }
    const { error: continueError } = await authClient.oauth2.continue({
      postLogin: true,
    });
    if (continueError) {
      setIsSubmitting(false);
      setError(continueError.message ?? "Gagal melanjutkan.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pilih workspace</CardTitle>
          <CardDescription>
            Klien AI meminta akses ke akun {email}. Langkah 1 dari 2 (spike
            T-148).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RadioGroup value={selected} onValueChange={setSelected}>
            <ItemGroup className="gap-2">
              {workspaces.map((workspace) => (
                <Item key={workspace.id} variant="outline" asChild>
                  <label htmlFor={`ws-${workspace.id}`}>
                    <ItemMedia>
                      <RadioGroupItem
                        id={`ws-${workspace.id}`}
                        value={workspace.id}
                      />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{workspace.name}</ItemTitle>
                      <ItemDescription>{workspace.role}</ItemDescription>
                    </ItemContent>
                  </label>
                </Item>
              ))}
            </ItemGroup>
          </RadioGroup>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={handleContinue} disabled={isSubmitting || !selected}>
            Lanjut
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

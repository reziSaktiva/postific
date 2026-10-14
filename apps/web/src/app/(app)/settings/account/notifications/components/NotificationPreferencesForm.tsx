"use client";

import { useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

import type { NotificationPreferencesRecord } from "@/domains/identity";

import {
  SETTINGS_BREADCRUMB_GROUP,
  SettingsPageHead,
} from "../../../components/SettingsPageHead";
import { updateNotificationPreferencesAction } from "../actions";

// T-016.4: 3 preferensi notifikasi email sesuai rancangan Claude Design
// (`templates/settings-notifications.html`, `.pref-row`). Pola komposisi
// `FieldLabel` membungkus `Field orientation="horizontal"` (FieldContent +
// control) sama persis dengan `InviteMemberDialog.tsx` (T-016.4 bukan
// konsumen pertama, hanya reuse pola yang sudah ada).
const PREFERENCE_ROWS: Array<{
  key: keyof NotificationPreferencesRecord;
  title: string;
  description: string;
}> = [
  {
    key: "notifyRepliesAndMentions",
    title: "Balasan & Mention",
    description: "Email saat ada komentar atau mention baru di Engage",
  },
  {
    key: "notifyPublishSchedule",
    title: "Jadwal Publish",
    description: "Ringkasan harian post yang akan tayang",
  },
  {
    key: "notifyAnalyticsReport",
    title: "Laporan Analytics",
    description: "Ringkasan performa mingguan via email",
  },
];

export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: NotificationPreferencesRecord;
}) {
  const [values, setValues] =
    useState<NotificationPreferencesRecord>(preferences);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function handleToggle(
    key: keyof NotificationPreferencesRecord,
    checked: boolean,
  ) {
    if (submittingRef.current) return;
    setIsSuccess(false);
    setValues((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setIsSuccess(false);
    setIsSubmitting(true);
    const payload = values;

    try {
      const result = await updateNotificationPreferencesAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setValues(result.preferences);
      setIsSuccess(true);
    } catch {
      setError("Gagal menyimpan preferensi. Coba lagi.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    /* eslint-disable-next-line no-restricted-syntax -- T-016.4: file ini
       dikomposisi langsung dengan Tailwind shadcn (ADR-097), pola sama
       `ProfileForm.tsx`. */
    <div className="flex flex-col gap-4 p-4">
      <SettingsPageHead
        pageName="Notifications"
        breadcrumb={`${SETTINGS_BREADCRUMB_GROUP.account} / Notifications`}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}
      {isSuccess ? (
        <Alert>
          <AlertTitle>Preferensi notifikasi berhasil diperbarui.</AlertTitle>
        </Alert>
      ) : null}

      <Card className="max-w-130">
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {PREFERENCE_ROWS.map((row) => (
                <FieldLabel
                  key={row.key}
                  htmlFor={`notif-${row.key}`}
                  className={isSubmitting ? "pointer-events-none" : undefined}
                >
                  <Field
                    orientation="horizontal"
                    data-disabled={isSubmitting ? true : undefined}
                  >
                    <FieldContent>
                      <FieldTitle>{row.title}</FieldTitle>
                      <FieldDescription>{row.description}</FieldDescription>
                    </FieldContent>
                    <Checkbox
                      id={`notif-${row.key}`}
                      checked={values[row.key]}
                      disabled={isSubmitting}
                      onCheckedChange={(checked) =>
                        handleToggle(row.key, checked === true)
                      }
                    />
                  </Field>
                </FieldLabel>
              ))}

              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner /> : null}
                  Simpan Perubahan
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

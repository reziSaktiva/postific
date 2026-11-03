import type { ContentFormat } from "@postific/shared";
import { SocialPlatform } from "@postific/shared";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";

import type { ConnectedAccount } from "./form-shared";
import {
  FORMAT_LABEL,
  getDefaultFormat,
  getSelectableFormats,
} from "./form-shared";
import { LabeledControl } from "./LabeledControl";
import type { PinterestFieldsValue } from "./PinterestFields";
import { PinterestFields } from "./PinterestFields";

/**
 * Pengaturan per jaringan untuk satu akun yang dicentang: pilihan Content
 * Format (ADR-039) dan field khusus platform (Pinterest). Dirender sebagai
 * fragment di dalam wrapper per akun (`AccountSelector`).
 */
export function NetworkBlock({
  account,
  checkboxId,
  isChecked,
  currentFormat,
  onFormatChange,
  pinterest,
}: {
  account: ConnectedAccount;
  checkboxId: string;
  isChecked: boolean;
  currentFormat: ContentFormat | undefined;
  onFormatChange: (format: ContentFormat) => void;
  pinterest: PinterestFieldsValue;
}) {
  const formats = getSelectableFormats(account.platform);

  return (
    <>
      {isChecked && formats ? (
        <RadioGroup
          aria-label="Content Format"
          className="flex flex-row flex-wrap gap-4"
          value={currentFormat ?? getDefaultFormat(account.platform)}
          onValueChange={(value) => onFormatChange(value as ContentFormat)}
        >
          {formats.map((format) => {
            const radioId = `${checkboxId}-format-${format}`;
            return (
              <LabeledControl
                key={format}
                htmlFor={radioId}
                control={<RadioGroupItem value={format} id={radioId} />}
              >
                {FORMAT_LABEL[format]}
              </LabeledControl>
            );
          })}
        </RadioGroup>
      ) : null}

      {isChecked && account.platform === SocialPlatform.Pinterest ? (
        <PinterestFields checkboxId={checkboxId} {...pinterest} />
      ) : null}

      {isChecked &&
      !formats &&
      account.platform !== SocialPlatform.Pinterest ? (
        <Text variant="muted">Format: Post</Text>
      ) : null}
    </>
  );
}

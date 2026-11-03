import { FieldDescription } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";

export function CaptionEditor({
  caption,
  onCaptionChange,
  showStoryCaptionWarning,
}: {
  caption: string;
  onCaptionChange: (caption: string) => void;
  /** Hanya target Story dan caption terisi — caption tidak ikut terpublish. */
  showStoryCaptionWarning: boolean;
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-3">
      <Text variant="h4" as="h3">
        Caption
      </Text>
      <Label htmlFor="draft-caption" className="sr-only">
        Caption
      </Label>
      <Textarea
        id="draft-caption"
        value={caption}
        onChange={(event) => onCaptionChange(event.target.value)}
        placeholder="Tulis caption di sini..."
      />
      <FieldDescription>
        AI Caption Assist belum termasuk revisi ini.
      </FieldDescription>
      {showStoryCaptionWarning ? (
        <FieldDescription>
          Story menolak caption — teks di atas TIDAK akan ikut terpublish ke
          Instagram/Facebook.
        </FieldDescription>
      ) : null}
    </div>
  );
}

import { FieldDescription } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Editor caption (T-202.1): satu caption untuk semua jaringan (ADR-155). Tanpa
 * toolbar emoji/hashtag; satu-satunya aksi lampiran ada di `MediaSection`.
 */
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
    <div className="flex flex-col gap-2">
      <Label htmlFor="draft-caption" className="sr-only">
        Caption
      </Label>
      <Textarea
        id="draft-caption"
        className="min-h-28 resize-none"
        value={caption}
        onChange={(event) => onCaptionChange(event.target.value)}
        placeholder="Tulis caption di sini..."
      />
      {showStoryCaptionWarning ? (
        <FieldDescription>
          Story menolak caption — teks di atas TIDAK akan ikut terpublish ke
          Instagram/Facebook.
        </FieldDescription>
      ) : null}
    </div>
  );
}

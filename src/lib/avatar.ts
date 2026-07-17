/**
 * Client-side avatar image helper for the Profile page's photo uploader
 * (`src/components/profile/ProfileView.tsx`, backed by `useProfile.ts`).
 *
 * There is no image storage bucket in this project (Supabase's schema —
 * see `supabase/README.md` — is intentionally schema-only, and no upload
 * endpoint exists), so avatars are kept entirely client-side: downscaled
 * to a small square via an off-screen canvas and persisted as a `data:`
 * URL in `localStorage` through `useProfile.ts`. This keeps the feature
 * fully self-contained and working offline, at the cost of the avatar
 * being per-device rather than synced to an account.
 */

/**
 * Reads an image `File`, downsizes it to fit within `maxDim`×`maxDim`
 * (preserving aspect ratio, no upscaling), and returns a compressed JPEG
 * `data:` URL small enough to live comfortably in `localStorage`.
 */
export function readAndResizeImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file reader result."));
        return;
      }

      const img = new window.Image();
      img.onerror = () => reject(new Error("Could not decode that image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is unavailable in this browser."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = result;
    };

    reader.readAsDataURL(file);
  });
}

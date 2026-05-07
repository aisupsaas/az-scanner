export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text || ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export async function shareBlobFile(
  filename: string,
  blob: Blob,
  title = "Share file"
) {
  const file = new File([blob], filename, {
    type: blob.type || "application/octet-stream",
  });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (nav.canShare?.({ files: [file] })) {
    await navigator.share({
      title,
      files: [file],
    });

    return true;
  }

  return false;
}

export async function shareTextFile(
  filename: string,
  text: string,
  title = "Share text"
) {
  const blob = new Blob([text || ""], {
    type: "text/plain;charset=utf-8",
  });

  return shareBlobFile(filename, blob, title);
}
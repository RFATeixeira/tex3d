import { MAX_QUOTE_IMAGE_LENGTH } from "./quotes";

export async function encodeQuoteImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Selecione uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    for (const maxSize of [900, 700, 500, 300]) {
      const scale = Math.min(1, maxSize / Math.max(picture.naturalWidth, picture.naturalHeight));
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.65, 0.45]) {
        const encoded = canvas.toDataURL("image/jpeg", quality);
        if (encoded.length <= MAX_QUOTE_IMAGE_LENGTH) return encoded;
      }
    }
    throw new Error("Não foi possível reduzir a imagem. Escolha outra foto.");
  } finally { URL.revokeObjectURL(url); }
}

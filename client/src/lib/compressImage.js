/**
 * Resizes and compresses an image file using the Canvas API.
 * Returns a new File at the target dimensions and quality.
 * SVG files are returned unchanged.
 */
export async function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.85 } = {}) {
  if (file.type === 'image/svg+xml') return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down only if larger than max — never upscale
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      // Preserve PNG for logos/transparent images; use JPEG for everything else
      const isPng     = file.type === 'image/png';
      const mimeType  = isPng ? 'image/png' : 'image/jpeg';
      const ext       = isPng ? 'png' : 'jpg';

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mimeType }));
        },
        mimeType,
        isPng ? undefined : quality,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

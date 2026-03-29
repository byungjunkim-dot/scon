/**
 * Compresses an image file to be under a certain size (in bytes)
 * @param file The image file to compress
 * @param maxSizeKB The maximum size in KB
 * @returns A promise that resolves to the compressed base64 string
 */
export const compressImage = (file: File, maxSizeKB: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Initial check: if already small enough and dimensions are reasonable, just return
        const initialBase64 = event.target?.result as string;
        if (file.size <= maxSizeKB * 1024) {
          resolve(initialBase64);
          return;
        }

        // If too large, start resizing
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Iterative compression
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Simple heuristic: if still too big, drop quality faster
        while (dataUrl.length * 0.75 > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

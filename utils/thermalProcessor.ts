
export function processToThermal(canvas: HTMLCanvasElement, targetWidth: number): Uint8Array {
  const targetHeight = Math.floor(canvas.height * (targetWidth / canvas.width));
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetWidth;
  tempCanvas.height = targetHeight;
  
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");
  
  // Menggunakan rendering lancar (imageSmoothingEnabled = false untuk pixel art/barcode)
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;

  // Floyd-Steinberg Dithering Algorithm
  // Menghasilkan gradasi abu-abu semu pada printer hitam-putih agar gambar jelas (tidak blur)
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const i = (y * targetWidth + x) * 4;
      
      // Grayscale conversion (Luminance)
      const oldPixel = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const newPixel = oldPixel < 128 ? 0 : 255;
      
      data[i] = data[i + 1] = data[i + 2] = newPixel;
      const error = oldPixel - newPixel;

      // Distribusi error ke tetangga (Dithering)
      if (x + 1 < targetWidth) data[((y) * targetWidth + (x + 1)) * 4] += error * 7 / 16;
      if (y + 1 < targetHeight) {
        if (x - 1 >= 0) data[((y + 1) * targetWidth + (x - 1)) * 4] += error * 3 / 16;
        data[((y + 1) * targetWidth + (x)) * 4] += error * 5 / 16;
        if (x + 1 < targetWidth) data[((y + 1) * targetWidth + (x + 1)) * 4] += error * 1 / 16;
      }
    }
  }

  // Masukkan kembali data dithered ke canvas preview (opsional untuk akurasi UI)
  ctx.putImageData(imgData, 0, 0);

  const byteWidth = targetWidth / 8;
  const result = new Uint8Array(8 + (byteWidth * targetHeight));
  
  // ESC/POS GS v 0 (Print raster bit image)
  result.set([
    0x1D, 0x76, 0x30, 0x00, 
    byteWidth & 0xFF, (byteWidth >> 8) & 0xFF, 
    targetHeight & 0xFF, (targetHeight >> 8) & 0xFF
  ]);

  let pos = 8;
  for (let y = 0; y < targetHeight; y++) {
    for (let xByte = 0; xByte < byteWidth; xByte++) {
      let byteValue = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        const i = (y * targetWidth + x) * 4;
        // Pixel hitam adalah 1 pada ESC/POS raster
        if (data[i] < 128) {
          byteValue |= (1 << (7 - bit));
        }
      }
      result[pos++] = byteValue;
    }
  }
  
  return result;
}

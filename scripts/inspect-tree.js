import { Jimp } from 'jimp';

async function inspect() {
  const image = await Jimp.read('public/arbol.png');
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  console.log(`Image dimensions: ${width}x${height}`);
  
  // Inspect bottom center area (likely where the trunk is)
  const startX = Math.floor(width * 0.45);
  const endX = Math.floor(width * 0.55);
  const startY = Math.floor(height * 0.7);
  const endY = Math.floor(height * 0.9);
  
  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const color = image.getPixelColor(x, y);
      const r = (color >> 24) & 0xff;
      const g = (color >> 16) & 0xff;
      const b = (color >> 8) & 0xff;
      const a = color & 0xff;
      
      if (a > 50) { // ignore transparent
        totalR += r;
        totalG += g;
        totalB += b;
        count++;
      }
    }
  }
  
  if (count > 0) {
    console.log(`Average trunk color: RGB(${Math.round(totalR/count)}, ${Math.round(totalG/count)}, ${Math.round(totalB/count)})`);
  } else {
    console.log('No opaque pixels found in the trunk area.');
  }
}

inspect().catch(console.error);

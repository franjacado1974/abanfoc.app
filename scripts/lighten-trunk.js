import { Jimp } from 'jimp';

async function lightenTrunk() {
  console.log('Loading arbol.png...');
  const image = await Jimp.read('public/arbol.png');
  const data = image.bitmap.data;
  
  console.log('Processing pixels...');
  let processedCount = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a > 30) {
      // The trunk is dark (RGB values are low compared to the colorful leaves)
      // Let's target pixels where R, G, and B are all under 100
      if (r < 100 && g < 100 && b < 125) {
        // Increase R, G, B to make them lighter
        // Let's add 90 to each channel (capped at 255)
        data[i] = Math.min(255, r + 90);
        data[i + 1] = Math.min(255, g + 90);
        data[i + 2] = Math.min(255, b + 90);
        processedCount++;
      }
    }
  }
  
  console.log(`Modified ${processedCount} pixels.`);
  console.log('Saving modified arbol.png...');
  await image.write('public/arbol.png');
  console.log('Done!');
}

lightenTrunk().catch(console.error);

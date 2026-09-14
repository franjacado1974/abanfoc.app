import { Jimp } from 'jimp';

async function removeBackground() {
  console.log('Loading image...');
  const image = await Jimp.read('public/arbol-colorido-sin-fondo.jpg');
  
  console.log('Scanning pixels and removing white background...');
  const data = image.bitmap.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // If a pixel is very close to white (RGB > 240), set its alpha to 0
    if (r > 235 && g > 235 && b > 235) {
      data[i + 3] = 0; // Set alpha channel to transparent
    }
  }

  console.log('Writing transparent PNG...');
  await image.write('public/arbol-colorido-sin-fondo.png');
  console.log('Done! Saved to public/arbol-colorido-sin-fondo.png');
}

removeBackground().catch(console.error);

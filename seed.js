require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ts-mart';

// Real makeup products available in Bangladesh (Daraz, Othoba, Shajgoj, etc.).
// Names, shades, and BDT prices reflect typical retail in 2026.
const sampleProducts = [
  {
    name: 'Maybelline Fit Me Matte + Poreless Foundation',
    description: 'Mattifying liquid foundation with micro-powders for natural matte finish. Shade 220 Natural Beige.',
    price: 1450,
    image: '/images/products/foundation.jpg',
    category: 'Foundation',
    stock: 60,
  },
  {
    name: 'LOreal Infallible 32H Fresh Wear Foundation',
    description: 'Long-wear full-coverage liquid foundation. Transfer-resistant for up to 32 hours.',
    price: 1850,
    image: '/images/products/foundation.jpg',
    category: 'Foundation',
    stock: 45,
  },
  {
    name: 'MAC Retro Matte Lipstick – Ruby Woo',
    description: 'Iconic blue-red matte lipstick. Iconic shade worn globally since 1999.',
    price: 2200,
    image: '/images/products/lipstick.jpg',
    category: 'Lipstick',
    stock: 30,
  },
  {
    name: 'Maybelline SuperStay Matte Ink Liquid Lipstick',
    description: 'Up to 16-hour wear liquid matte lipstick. Shade 20 Pioneer (deep red).',
    price: 950,
    image: '/images/products/lipstick.jpg',
    category: 'Lipstick',
    stock: 80,
  },
  {
    name: 'LOreal Paris Color Riche Lipstick',
    description: 'Hydrating creamy lipstick enriched with vitamin E and argan oil. Shade 234 Rose Tender.',
    price: 850,
    image: '/images/products/lipstick.jpg',
    category: 'Lipstick',
    stock: 70,
  },
  {
    name: 'Maybelline Lash Sensational Mascara',
    description: 'Volumising and lengthening mascara with a fanning brush. Washable black.',
    price: 890,
    image: '/images/products/mascara.jpg',
    category: 'Mascara',
    stock: 75,
  },
  {
    name: 'LOreal Telescopic Mascara',
    description: 'Precision lengthening mascara with a flexible separator brush. Carbon black.',
    price: 950,
    image: '/images/products/mascara.jpg',
    category: 'Mascara',
    stock: 50,
  },
  {
    name: 'NYX Professional Makeup Epic Ink Liner',
    description: 'Waterproof ultra-precise liquid eyeliner. Up to 24-hour wear, matte finish.',
    price: 650,
    image: '/images/products/eyeliner.jpg',
    category: 'Eyeliner',
    stock: 90,
  },
  {
    name: 'Huda Beauty Easy Bake Loose Powder',
    description: 'Loose baking powder for a flawless finish. Shade Banana Bread.',
    price: 3200,
    image: '/images/products/powder.jpg',
    category: 'Powder',
    stock: 25,
  },
  {
    name: 'Maybelline Fit Me Pressed Powder',
    description: 'Lightweight pressed powder for natural coverage and shine control. Shade 120 Classic Ivory.',
    price: 950,
    image: '/images/products/powder.jpg',
    category: 'Powder',
    stock: 65,
  },
  {
    name: 'The Ordinary Coverage Foundation',
    description: 'Buildable medium-to-full coverage foundation with a natural satin finish. Shade 2.1 N.',
    price: 2400,
    image: '/images/products/foundation.jpg',
    category: 'Foundation',
    stock: 35,
  },
  {
    name: 'Revolution Beauty Reloaded Eye Shadow Palette',
    description: '18-shade eyeshadow palette with mattes and shimmers. Iconic Division.',
    price: 1600,
    image: '/images/products/powder.jpg',
    category: 'Eye Shadow',
    stock: 40,
  },
];

async function seed() {
  let exitCode = 0;
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`MongoDB connected: ${MONGO_URI}`);

    const existing = await Product.countDocuments();
    if (existing > 0) {
      console.log(`Products collection already has ${existing} documents. Skipping seed.`);
      console.log('Tip: to re-seed, drop the collection first:');
      console.log(`   mongosh ${MONGO_URI} --eval "db.products.drop()"`);
      return;
    }

    const result = await Product.insertMany(sampleProducts);
    console.log(`Inserted ${result.length} products.`);
  } catch (err) {
    console.error('Seed failed:', err);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
}

seed();
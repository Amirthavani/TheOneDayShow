import Jewelry from "./models/Jewelry.js";

export const initialJewelry = [
  {
    code: "001",
    name: "Temple Bloom Haaram",
    category: "Necklaces",
    style: "Bridal",
    description: "A temple-inspired long haaram with a rich antique-gold finish for bridal ceremonies.",
    pricePerDay: 899,
    deposit: 3000,
    image: "/images/VMJAI45822_CS.jpg",
    featured: true,
    premium: true
  },
  {
    code: "002",
    name: "Royal Pearl Long Haaram",
    category: "Necklaces",
    style: "Casual",
    description: "A graceful pearl long haaram that brings a timeless finish to silk and evening looks.",
    pricePerDay: 749,
    deposit: 2500,
    image: "/images/Pearl%20Long%20Haram.jpeg",
    featured: true
  },
  {
    code: "003",
    name: "Antique Goddess Choker",
    category: "Chokers",
    style: "Bridal",
    description: "An ornate goddess choker designed to frame a bridal neckline beautifully.",
    pricePerDay: 699,
    deposit: 2400,
    image: "/images/choker.jpg",
    featured: true
  },
  {
    code: "004",
    name: "Mullai Malai Set",
    category: "Necklaces",
    style: "Bridal",
    description: "Traditional mullai motifs and a statement silhouette for your most meaningful celebrations.",
    pricePerDay: 799,
    deposit: 2800,
    image: "/images/Traditional%20Mullai%20Malai%20Haram.jpeg",
    featured: true
  },
  {
    code: "005",
    name: "Sunlit Ruby Earrings",
    category: "Earrings",
    style: "Party",
    description: "Bright ruby-toned earrings with a festive, lightweight finish.",
    pricePerDay: 349,
    deposit: 1200,
    image: "/images/VMJAI45913_CS.jpg"
  },
  {
    code: "006",
    name: "Heritage Waist Belt",
    category: "Waist Belts",
    style: "Casual",
    description: "A heritage-style waist belt for sarees and traditional bridal styling.",
    pricePerDay: 599,
    deposit: 2000,
    image: "/images/hipbelt.jpg"
  },
  {
    code: "007",
    name: "Emerald Cascade Haaram",
    category: "Necklaces",
    style: "Party",
    description: "A cascading emerald-inspired haaram that makes a confident statement.",
    pricePerDay: 849,
    deposit: 3000,
    image: "/images/VMJAI46144_CS.webp"
  },
  {
    code: "008",
    name: "Golden Jhumka Pair",
    category: "Earrings",
    style: "Party",
    description: "Classic gold jhumkas designed for a joyful finishing touch.",
    pricePerDay: 299,
    deposit: 1000,
    image: "/images/VMJAI45906_CS.jpg"
  }
];

export async function seedJewelry() {
  if ((await Jewelry.countDocuments()) === 0) {
    await Jewelry.insertMany(initialJewelry);
    console.log("Seeded jewelry catalog.");
    return;
  }
  await Jewelry.bulkWrite(
    initialJewelry.map((item) => ({
      updateOne: {
        filter: { name: item.name, $or: [{ description: { $exists: false } }, { description: "" }] },
        update: { $set: { description: item.description } }
      }
    }))
  );
  await Jewelry.updateOne(
    { name: "Temple Bloom Haaram", premium: { $exists: false } },
    { $set: { premium: true } }
  );
  await Jewelry.bulkWrite([
    { updateMany: { filter: { style: { $in: ["Classic", "Traditional"] } }, update: { $set: { style: "Casual" } } } },
    { updateMany: { filter: { style: { $in: ["Festive", "Statement"] } }, update: { $set: { style: "Party" } } } }
  ]);
  const jewelryWithoutCode = await Jewelry.find({
    $or: [{ code: { $exists: false } }, { code: "" }]
  }).sort({ createdAt: 1 });
  const usedCodes = new Set((await Jewelry.find({ code: { $ne: "" } }).select("code").lean()).map((item) => item.code));
  let codeNumber = 1;
  for (const item of jewelryWithoutCode) {
    let code;
    do {
      code = String(codeNumber++).padStart(3, "0");
    } while (usedCodes.has(code));
    item.code = code;
    await item.save();
    usedCodes.add(code);
  }
  await Jewelry.updateMany(
    { code: /^ODS-?/ },
    [{ $set: { code: { $replaceOne: { input: "$code", find: "ODS-", replacement: "" } } } }]
  );
}

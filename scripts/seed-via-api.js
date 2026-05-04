/**
 * Seeds services by calling the backend API.
 * Run: npm run db:seed:api
 * Make sure the backend is running (npm run dev).
 */

const API_BASE = process.env.API_BASE || "http://localhost:4002";

const seedPayload = {
  services: [
    {
      heading: "Hair Styling",
      description:
        "Indulge in our expert hair styling services tailored to enhance your natural beauty and confidence.",
      subheadings: [
        {
          subheading: "Cut & finish",
          items: [
            { name: "Women's cut & blow-dry", price: 85 },
            { name: "Men's cut", price: 45 },
            { name: "Children's cut", price: 35 },
          ],
        },
        {
          subheading: "Colour",
          items: [
            { name: "Full colour", price: 140 },
            { name: "Half head foils", price: 120 },
            { name: "Toner refresh", price: 55 },
          ],
        },
      ],
      image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=85",
      alt: "Hair styling at Blosm",
      duration: 45,
    },
    {
      heading: "Beauty Treatments",
      description: "Explore our exclusive beauty treatments that provide a luxurious experience.",
      subheadings: [
        {
          subheading: "Face",
          items: [
            { name: "Classic facial (60 min)", price: 95 },
            { name: "Hydrating facial", price: 110 },
          ],
        },
        {
          subheading: "Brows & lashes",
          items: [
            { name: "Brow shape & tint", price: 45 },
            { name: "Classic lash extensions", price: 130 },
          ],
        },
      ],
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=85",
      alt: "Beauty and facial treatment",
      duration: 60,
    },
    {
      heading: "Nail Care",
      description:
        "From classic manicures to intricate nail art, our skilled technicians deliver perfection.",
      subheadings: [
        {
          subheading: "Hands & feet",
          items: [
            { name: "Manicure", price: 40 },
            { name: "Pedicure", price: 55 },
            { name: "Gel manicure", price: 55 },
            { name: "Deluxe pedicure", price: 75 },
          ],
        },
      ],
      image: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=85",
      alt: "Nail care services",
      duration: 45,
    },
  ],
};

async function main() {
  console.log(`Seeding via API at ${API_BASE}...`);
  const res = await fetch(`${API_BASE}/api/v1/admin/services/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seedPayload),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error("Seed failed:", res.status, res.statusText);
    console.error("Response:", text.slice(0, 200));
    process.exit(1);
  }

  if (!res.ok) {
    console.error("Seed failed:", data.error || data.message || res.statusText);
    process.exit(1);
  }

  console.log("Seed completed:", data);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

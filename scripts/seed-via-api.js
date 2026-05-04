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
          duration: 45,
          items: [
            { name: "Women's cut & blow-dry", price: 85, time: 60 },
            { name: "Men's cut", price: 45, time: 30 },
            { name: "Children's cut", price: 35, time: 30 },
          ],
        },
        {
          subheading: "Colour",
          duration: 90,
          items: [
            { name: "Full colour", price: 140, time: 120 },
            { name: "Half head foils", price: 120, time: 90 },
            { name: "Toner refresh", price: 55, time: 30 },
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
            { name: "Classic facial (60 min)", price: 95, time: 60 },
            { name: "Hydrating facial", price: 110, time: 60 },
          ],
        },
        {
          subheading: "Brows & lashes",
          items: [
            { name: "Brow shape & tint", price: 45, time: 30 },
            { name: "Classic lash extensions", price: 130, time: 90 },
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
            { name: "Manicure", price: 40, time: 30 },
            { name: "Pedicure", price: 55, time: 45 },
            { name: "Gel manicure", price: 55, time: 45 },
            { name: "Deluxe pedicure", price: 75, time: 60 },
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

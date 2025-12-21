export default async function handler(req, res) {
  console.log("🔥 Function invoked");

  if (req.method !== "POST") {
    console.log("❌ Not POST:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("📦 Raw body:", JSON.stringify(req.body, null, 2));

  // Accept any payload for now
  return res.status(200).json({
    status: "received",
    body: req.body
  });
}

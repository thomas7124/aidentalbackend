export const config = {
  runtime: "nodejs",
};


export default async function handler(req, res) {
  // Always log invocation (for debugging & confidence)
  console.log("🔥 Function invoked");

  if (req.method !== "POST") {
    console.log("❌ Not POST:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("📦 Raw body:", JSON.stringify(req.body, null, 2));

  // ElevenLabs sends the body directly (no wrapper)
  const {
    patient_name,
    phone_number,
    appointment_reason,
    preferred_date,
    preferred_time,
    is_emergency = false
  } = req.body;

  // Basic validation
  if (
    !patient_name ||
    !phone_number ||
    !appointment_reason ||
    !preferred_date ||
    !preferred_time
  ) {
    return res.status(400).json({
      error: "Missing required appointment fields"
    });
  }

  // Optional: emergency handling
  if (is_emergency === true) {
    console.log("🚨 Emergency appointment detected");

    // You can later:
    // - notify staff
    // - skip calendar booking
    // - route to live call

    return res.status(200).json({
      status: "Emergency flagged – manual follow-up required"
    });
  }

  // Convert date + time → ISO string
  // preferred_date = YYYY-MM-DD
  // preferred_time = HH:MM (24h)
  const startTime = new Date(
  `${preferred_date}T${preferred_time}:00-05:00`
);


  if (isNaN(startTime.getTime())) {
    return res.status(400).json({
      error: "Invalid date or time format"
    });
  }

  try {
    // Call Cal.com API
    
    console.log(
  "ENV CHECK:",
  "CAL_API_KEY:", !!process.env.CAL_API_KEY,
  "EVENT_TYPE_ID:", !!process.env.CAL_EVENT_TYPE_ID
);

 console.log("CAL_API_KEY length:", process.env.CAL_API_KEY?.length);

const calResponse = await fetch(
  `https://api.cal.com/v1/bookings?apiKey=${process.env.CAL_API_KEY}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
   body: JSON.stringify({
  eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
  start: startTime.toISOString(),

  timeZone: "America/New_York",   // ✅ REQUIRED
  language: "en",                // ✅ REQUIRED
  metadata: {},                  // ✅ REQUIRED (can be empty)

  responses: {
    name: patient_name,
    attendeePhoneNumber: phone_number,
    notes: appointment_reason,
    email: "noemail@yourclinic.com",
    location: "In-person",


    
  },
}),

  }
);





    const result = await calResponse.json();

    if (!calResponse.ok) {
      console.error("❌ Cal.com error:", result);
      return res.status(500).json({
        error: "Failed to create calendar booking",
        details: result
      });
    }

    console.log("✅ Booking created:", result);

    return res.status(200).json({
      status: "Appointment booked",
      booking: result
    });

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

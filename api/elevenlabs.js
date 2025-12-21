export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  console.log("🔥 Function invoked");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    patient_name,
    phone_number,
    appointment_reason,
    preferred_date,
    preferred_time,
    is_emergency = false,
  } = req.body;

  if (
    !patient_name ||
    !phone_number ||
    !appointment_reason ||
    !preferred_date ||
    !preferred_time
  ) {
    return res.status(400).json({
      error: "Missing required appointment fields",
    });
  }

  if (is_emergency === true) {
    return res.status(200).json({
      success: true,
      message: "Emergency flagged – manual follow-up required",
    });
  }

  const startTime = new Date(
    `${preferred_date}T${preferred_time}:00-05:00`
  );

  if (isNaN(startTime.getTime())) {
    return res.status(400).json({
      error: "Invalid date or time format",
    });
  }

  try {
    console.log(
      "ENV CHECK:",
      "CAL_API_KEY:", !!process.env.CAL_API_KEY,
      "EVENT_TYPE_ID:", !!process.env.CAL_EVENT_TYPE_ID
    );

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

          timeZone: "America/New_York",
          language: "en",
          metadata: {},

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
        success: false,
        error: "Failed to create calendar booking",
        details: result,
      });
    }

    console.log("✅ Booking created:", result);

    // 🔴 THIS RETURN IS THE MOST IMPORTANT LINE 🔴
    return res.status(200).json({
      success: true,
      message: "Appointment booked successfully",
      booking: result,
    });

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

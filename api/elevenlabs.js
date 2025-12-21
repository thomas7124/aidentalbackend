export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tool, arguments: data } = req.body;

  if (tool !== "create_dental_appointment") {
    return res.status(400).json({ error: "Unknown tool" });
  }

  const {
    patient_name,
    phone_number,
    appointment_reason,
    preferred_date,
    preferred_time,
  } = data;


  const startTime = new Date(`${preferred_date}T${preferred_time}:00`);

  const response = await fetch("https://api.cal.com/v1/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CAL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      eventTypeId: process.env.CAL_EVENT_TYPE_ID,
      start: startTime.toISOString(),
      responses: {
        name: patient_name,
        phone: phone_number,
        reason: appointment_reason
      }
    })
  });

  if (!response.ok) {
    return res.status(500).json({ error: "Cal.com booking failed" });
  }

  return res.status(200).json({ status: "Booked" });
}

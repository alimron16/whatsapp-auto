const axios = require('axios');

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 19) return "Selamat sore";
  return "Selamat malam";
}

async function generateReply(text) {
  const key = process.env.GEMINI_API_KEY;
  const greeting = getGreetingByTime();
  const prompt = `gunakan ${greeting} jika diperlukan. Balas 1 paragraf pendek , sopan, formal, ringkas, dan jelas. Jangan timbulkan pertanyaan untuk konsumen, jika ada pertanyaan dan masih belum selesai jawab tolong ditunggu updatenya. Kita adalah CS chika_mp:\n\n${text || '[pesan media]'}`;

  try {
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, timeout: 12000 }
    );

    const reply = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || 'Terima kasih, kami akan segera merespons.';
  } catch (e) {
    console.error('Gemini error:', e.response?.data || e.message);
    return 'Terima kasih, kami akan segera merespons.';
  }
}

module.exports = { generateReply };
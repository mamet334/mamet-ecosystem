import { ambilAman } from '../lib/web/alamat_publik.ts';

export default {
  name: 'communicator',
  description: 'Gunakan tool ini JIKA pengguna meminta untuk memanggil REST API, Webhook (Make/Zapier), Discord Webhook, Telegram API, Slack, atau melakukan HTTP Request (GET/POST/PUT) ke dunia luar.',
  execute: async ({ task, runLLM, env }) => {
    try {
      const prompt = `Tugas Anda: Buatkan konfigurasi HTTP Request berdasarkan permintaan user berikut.
Tugas dari user: "${task}"

KEMBALIKAN HANYA JSON MURNI TANPA MARKDOWN \`\`\`json. Format JSON harus seperti ini:
{
  "url": "https://api.example.com",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\\"pesan\\":\\"halo\\"}" // jadikan string atau kosongkan jika GET
}`;

      const responseText = await runLLM(prompt, "Anda adalah API Constructor. Hanya kembalikan JSON murni.");
      let config;
      
      try {
        config = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
      } catch (e) {
        return { output: "Gagal mem-parsing parameter API dari LLM." };
      }

      const { url, method, headers, body } = config;

      if (!url || !url.startsWith('http')) {
        return { output: "URL tidak valid atau tidak diberikan." };
      }
      // K5 (30 Okt 2026): URL & isi permintaan disusun MODEL dari pesan siapa pun yang punya akun — tanpa pagar, server
      // menjadi relai ke localhost/jaringan privat/metadata (TM-001). ambilAman memeriksa alamat awal DAN setiap
      // pengalihan; penolakannya (AlamatDitolakError) dilaporkan lewat catch di bawah.

      const fetchOptions: any = {
        method: method || 'GET',
        headers: headers || {}
      };

      if (body && method !== 'GET') {
        fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
      }
      if (env?.signal) fetchOptions.signal = env.signal;

      const res = await ambilAman(url, fetchOptions);
      const resText = await res.text();

      return {
        output: `Aksi Komunikasi (API Call) Berhasil!\nStatus: ${res.status}\nRespons: ${resText.substring(0, 500)}`,
        toolExecution: { name: 'make_api_call', args: { method, url, body: fetchOptions.body } }
      };

    } catch (err) {
      return { output: `Gagal melakukan pemanggilan API: ${err}` };
    }
  }
};


export class IntentParser {
  constructor() {
    this.intents = {
      QUESTION: ['apa', 'siapa', 'bagaimana', 'kapan', 'dimana', 'mengapa', 'kenapa', 'berapa', 'adakah'],
      COMMAND: ['buka', 'jalankan', 'cari', 'buat', 'hapus', 'tampilkan', 'simpan', 'kirim', 'unduh', 'tutup'],
      STORE: ['ingat', 'simpan', 'catat', 'tolong ingat', 'jangan lupa'],
      GREETING: ['hai', 'halo', 'selamat', 'hello', 'hi', 'pagi', 'siang', 'sore', 'malam'],
      SCHEDULE: ['besok', 'nanti', 'jadwal', 'agenda', 'rapat', 'meeting'],
      PREFERENCE_ASK: ['apa kesukaan', 'apa favorit', 'apa yang disukai', 'apa minuman', 'apa makanan'],
      FAREWELL: ['dadah', 'sampai jumpa', 'bye', 'selamat tinggal']
    };
  }

  parse(message) {
    if (!message || typeof message !== 'string') {
      return { intent: 'UNKNOWN', confidence: 0 };
    }

    const messageLower = message.toLowerCase();
    let bestMatch = { intent: 'UNKNOWN', confidence: 0 };

    for (const [intent, keywords] of Object.entries(this.intents)) {
      let matchCount = 0;
      let totalKeywords = keywords.length;

      for (const keyword of keywords) {
        if (messageLower.includes(keyword)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = matchCount / totalKeywords;
        if (confidence > bestMatch.confidence) {
          bestMatch = { intent, confidence };
        }
      }
    }

    if (bestMatch.intent === 'GREETING') {
      const firstWord = messageLower.split(' ')[0];
      if (this.intents.GREETING.includes(firstWord)) {
        bestMatch.confidence = Math.min(1, bestMatch.confidence + 0.3);
      }
    }

    return bestMatch;
  }

  isQuestion(message) {
    return this.parse(message).intent === 'QUESTION';
  }

  isCommand(message) {
    return this.parse(message).intent === 'COMMAND';
  }

  isStoreRequest(message) {
    return this.parse(message).intent === 'STORE';
  }

  isGreeting(message) {
    return this.parse(message).intent === 'GREETING';
  }

  isSchedule(message) {
    return this.parse(message).intent === 'SCHEDULE';
  }

  isPreferenceAsk(message) {
    return this.parse(message).intent === 'PREFERENCE_ASK';
  }

  isFarewell(message) {
    return this.parse(message).intent === 'FAREWELL';
  }
}
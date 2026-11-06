export interface IntentResult {
  intent: 'FACT' | 'CHAT' | 'QUESTION' | 'TASK';
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  memory_eligible: boolean;
  tier: 'T1' | 'T2' | 'T3' | 'NONE';
  memory_type: string;
  reason: string;
}

export function detectFact(text: string): IntentResult {
  let lowerText = text.trim().toLowerCase();

  if (lowerText.includes('?')) {
    return { intent: 'QUESTION', score: 0.1, confidence: 'LOW', memory_eligible: false, tier: 'NONE', memory_type: 'OTHER', reason: 'Mengandung tanda tanya (?)' };
  }

  const questionWords = ['apa', 'siapa', 'kapan', 'dimana', 'di mana', 'kenapa', 'mengapa', 'bagaimana', 'gimana', 'berap', 'apakah'];
  if (questionWords.some(w => lowerText.includes(w))) {
    return { intent: 'QUESTION', score: 0.15, confidence: 'LOW', memory_eligible: false, tier: 'NONE', memory_type: 'OTHER', reason: 'Mengandung kata tanya' };
  }

  const taskWords = ['buatkan', 'tolong', 'jelaskan', 'cari', 'generate', 'analisis', 'bantu', 'tuliskan', 'error', 'bug', 'gagal', 'coba', 'test', 'tes', 'ubah', 'hapus', 'edit', 'lihat', 'cek'];
  if (taskWords.some(w => lowerText.startsWith(w) || lowerText.includes(` ${w} `))) {
    return { intent: 'TASK', score: 0.2, confidence: 'LOW', memory_eligible: false, tier: 'NONE', memory_type: 'OTHER', reason: 'Command / Task Request' };
  }

  lowerText = lowerText.replace(/\b(gue|aku|saya|namaku)\b/g, 'SELF');
  lowerText = lowerText.replace(/\s+/g, ' ').trim();


  const strongVerbs = ['kerja', 'tinggal', 'punya', 'adalah', 'lahir', 'domisili'];
  const prefVerbs = ['suka', 'doyan', 'minum', 'makan', 'benci', 'alergi'];
  const allVerbs = [...strongVerbs, ...prefVerbs];

  let self_reference_score = 0.0;
  if (lowerText.startsWith('SELF')) {
    const tokens = lowerText.split(' ');
    if (tokens.length > 1 && allVerbs.includes(tokens[1])) {
      self_reference_score = 1.0;
    } else if (tokens.length > 2 && allVerbs.includes(tokens[2])) {
      self_reference_score = 0.6;
    } else {
      self_reference_score = 0.5;
    }
  } else if (lowerText.includes('SELF')) {
    self_reference_score = 0.4;
  }

  let verb_intent_score = 0.0;
  if (strongVerbs.some(v => lowerText.includes(v)) || lowerText.includes('nama SELF')) {
    verb_intent_score = 1.0;
  } else if (prefVerbs.some(v => lowerText.includes(v))) {
    verb_intent_score = 0.9;
  }

  if (lowerText.includes('tidak')) {
    verb_intent_score *= 0.5;
  }

  let object_presence_score = 0.0;
  const tokenCount = lowerText.split(' ').length;
  if (tokenCount >= 3) {
    object_presence_score = 0.8;
  } else if (tokenCount === 2) {
    object_presence_score = 0.5;
  }

  let declarative_score = 1.0;
  if (lowerText.includes('juga')) {
    declarative_score = 0.8;
  }
  const weakDeclarations = ['kayaknya', 'mungkin', 'sepertinya', 'agak', 'kira-kira'];
  if (weakDeclarations.some(w => lowerText.includes(w))) {
    declarative_score = 0.5;
  }

  let modifier_score = 0.0;
  if (lowerText.includes('juga')) modifier_score += 1.0;
  if (lowerText.includes('sangat')) modifier_score += 2.0;
  if (lowerText.includes('banget')) modifier_score += 2.0;
  if (lowerText.includes('sedikit')) modifier_score -= 2.0;

  let rawScore =
    (self_reference_score * 0.30) +
    (verb_intent_score * 0.30) +
    (object_presence_score * 0.20) +
    (declarative_score * 0.15) +
    (modifier_score * 0.05);

  let score = Math.max(0.0, Math.min(1.0, rawScore));
  score = parseFloat(score.toFixed(2));

  let intent: 'FACT' | 'CHAT' | 'QUESTION' | 'TASK' = 'CHAT';
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  let memory_eligible = false;
  let tier: 'T1' | 'T2' | 'T3' | 'NONE' = 'NONE';
  let reason = '';

  if (score >= 0.80) {
    intent = 'FACT';
    confidence = 'HIGH';
    memory_eligible = true;

    if (score >= 0.85 && (strongVerbs.some(v => lowerText.includes(v)) || lowerText.includes('nama SELF'))) {
      tier = 'T1';
    } else {
      tier = 'T2';
    }
    reason = `FACT HIGH (Score: ${score}, Tier: ${tier})`;
  }
  else if (score >= 0.65 && score < 0.80) {
    intent = 'FACT';
    confidence = 'MEDIUM';
    memory_eligible = true;

    if (score >= 0.70) {
      tier = 'T2';
    } else {
      tier = 'T3';
    }
    reason = `FACT MEDIUM/WEAK (Score: ${score}, Tier: ${tier})`;
  }
  else if (score >= 0.50 && score < 0.65) {
    intent = 'CHAT';
    confidence = 'LOW';
    memory_eligible = false;
    tier = 'NONE';
    reason = `POTENTIAL FACT / CHAT (Score: ${score})`;
  }
  else {
    intent = 'CHAT';
    confidence = 'LOW';
    memory_eligible = false;
    tier = 'NONE';
    reason = `CHAT (Score: ${score})`;
  }

  let memory_type = 'OTHER';
  if (memory_eligible) {
    if (lowerText.includes('SELF adalah') || lowerText.includes('umurku') || lowerText.includes('lahir') || lowerText.includes('nama SELF') || lowerText.includes('panggil SELF')) memory_type = 'IDENTITY';
    else if (lowerText.includes('tinggal') || lowerText.includes('domisili') || lowerText.includes('pindah') || lowerText.includes('kos')) memory_type = 'LOCATION';
    else if (lowerText.includes('kerja') || lowerText.includes('kantor') || lowerText.includes('profesi') || lowerText.includes('perusahaan') || lowerText.includes('pt ')) memory_type = 'JOB';
    else if (lowerText.includes('suka') || lowerText.includes('alergi') || lowerText.includes('favorit') || lowerText.includes('benci') || lowerText.includes('doyan')) memory_type = 'PREFERENCE';
    else if (lowerText.includes('sedang bikin') || lowerText.includes('proyek') || lowerText.includes('membangun') || lowerText.includes('buat')) memory_type = 'PROJECT';
    else if (lowerText.includes('fakta:') || lowerText.includes('catatan:') || lowerText.includes('ingat ini')) memory_type = 'KNOWLEDGE';
    else if (lowerText.includes('istri') || lowerText.includes('anak') || lowerText.includes('keluarga') || lowerText.includes('teman')) memory_type = 'RELATION';
    else if (lowerText.includes('tadi') || lowerText.includes('kemarin') || lowerText.includes('barusan') || lowerText.includes('hari ini') || lowerText.includes('makan') || lowerText.includes('minum')) memory_type = 'EVENT';
  }

  return {
    intent,
    score,
    confidence,
    memory_eligible,
    tier,
    memory_type,
    reason
  };
}

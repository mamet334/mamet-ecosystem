export class RequestClassifierService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;

    this._questionStarters = [
      'apa', 'siapa', 'kapan', 'dimana', 'di mana', 'berapa', 'kenapa', 'mengapa',
      'bagaimana', 'how', 'what', 'who', 'when', 'where', 'why', 'which', 'whose',
      'apakah', 'adakah', 'bolehkah', 'bisakah', 'dapatkah', 'is ', 'are ', 'was ',
      'were ', 'do ', 'does ', 'did ', 'can ', 'could ', 'would ', 'should '
    ];

    this._commandKeywords = [
      'buat folder', 'buat file', 'hapus folder', 'hapus file', 'pindahkan',
      'rename', 'salin', 'copy', 'zip', 'unzip', 'jalankan script', 'run script',
      'execute', 'eksekusi', 'create folder', 'create file', 'delete folder',
      'delete file', 'move file', 'move folder'
    ];

    this._contextDependentPatterns = [
      'tadi', 'sebelumnya', 'yang tadi', 'lanjut', 'lanjutkan', 'sambung',
      'teruskan', 'itu', 'ini', 'tersebut', 'yang kamu', 'yang aku',
      'saya', 'aku', 'gue', 'gua', 'ku', 'punyaku', 'milikku', 'kita', 'kami',
      'ingat', 'inget', 'remember', 'nama saya', 'proyek kita',
      'continue', 'previous', 'above', 'earlier', 'last', 'my ', 'our '
    ];

    this._filePathPattern = /\.(js|jsx|ts|tsx|py|json|css|html|md|sql|sh|env)\b/i;
    this._pathPattern = /[/\\][\w/\\.-]+/;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.eventBus.emit('RequestClassifier:Ready', { status: 'READY', timestamp: Date.now() });
    console.log('[RequestClassifierService] Initialized and Ready');
  }

  _matchMemoryStore(msg) {
    const msgTrimmed = msg.trim();
    const msgLower = msgTrimmed.toLowerCase();

    const isQuestion = msgTrimmed.endsWith('?') ||
      /\b(?:apakah|adakah|bolehkah|bisakah|dapatkah|masih|siapa|apa|kenapa|mengapa|bagaimana|kapan|dimana|di mana|berapa|ingat gak|inget gak|tau gak|tahu gak|can you|could you|would you|do you|is it)\b/i.test(msgLower);

    const isNegation = /(?:jangan|tidak usah|tak usah|ga(?:k)? usah|nggak usah|don't|do not|never)\s+(?:di)?(?:ingat|simpan|catat|remember|save|store)/i.test(msgLower);

    if (isQuestion || isNegation) {
      return null;
    }

    const prefixRegex = /^(?:tolong |mohon |please )?(?:ingat(?:kan|lah)?|simpan(?:lah)?|catat(?:lah)?|remember|store|save)\s*(?:bahwa|ini:?|kalau|kalo|ya,? bahwa|that)?\s*[:,-]?\s*/i;

    if (!prefixRegex.test(msgTrimmed)) {
      return null;
    }

    const contentToStore = msgTrimmed.replace(prefixRegex, '').trim();
    if (contentToStore.length < 3) {
      return null;
    }

    let category = 'general';
    const cLower = contentToStore.toLowerCase();
    if (/suka|ingin|favorit|preferensi|nama saya|panggil|email saya|alamat saya/i.test(cLower)) {
      category = 'preference';
    } else if (/kode|file|fungsi|class|repo|bug|error|endpoint|script|deploy/i.test(cLower)) {
      category = 'engineering';
    }

    return { contentToStore, category };
  }

  _matchDocConvert(msgLower) {
    const isQuestion = msgLower.trim().endsWith('?') ||
      /^(?:apakah|bisakah|dapatkah|bolehkah|bagaimana|gimana|kenapa|mengapa|can you|could you|how)\b/.test(msgLower.trim());
    if (isQuestion) return null;

    const hasVerb = /\b(?:ubah|ubahkan|rubah|konversi|konversikan|convert|jadikan|ganti|export|ekspor|simpan)\b/.test(msgLower);
    const idxPdf = msgLower.search(/\bpdf\b/);
    const idxWord = msgLower.search(/\b(?:word|docx?|ms word)\b/);
    if (!hasVerb || idxPdf === -1) return null;

    if (idxWord !== -1) {
      return { direction: idxWord < idxPdf ? 'word_to_pdf' : 'pdf_to_word' };
    }
    if (/\b(?:ke|jadi|jadikan|menjadi|sebagai|to|as)\s+pdf\b/.test(msgLower)) {
      return { direction: 'word_to_pdf' };
    }
    return null;
  }

  classify(userMsg = '', history = [], resolvedMode = 'STANDARD') {
    const msg = userMsg.trim();
    const msgLower = msg.toLowerCase();
    const msgLen = msg.length;

    if (resolvedMode === 'ENGINEER') {
      const result = { type: 'ENGINEER', confidence: 1.0, metadata: { resolvedMode } };
      this._emitClassified(result, msgLen);
      return result;
    }

    if (msg.startsWith('/')) {
      const commandHint = msg.split(' ')[0];
      const result = { type: 'COMMAND', confidence: 0.95, metadata: { commandHint, isSlashCommand: true } };
      this._emitClassified(result, msgLen);
      return result;
    }

    const docConvert = this._matchDocConvert(msgLower);
    if (docConvert) {
      const result = { type: 'DOC_CONVERT', confidence: 0.9, metadata: docConvert };
      this._emitClassified(result, msgLen);
      return result;
    }

    const hasCommandKeyword = this._commandKeywords.some(kw => msgLower.includes(kw));
    if (hasCommandKeyword) {
      const matchedKw = this._commandKeywords.find(kw => msgLower.includes(kw));
      const result = { type: 'COMMAND', confidence: 0.9, metadata: { commandHint: matchedKw } };
      this._emitClassified(result, msgLen);
      return result;
    }

    const memoryStoreMatch = this._matchMemoryStore(msg);
    if (memoryStoreMatch) {
      const result = {
        type: 'MEMORY_STORE',
        confidence: 0.95,
        metadata: {
          contentToStore: memoryStoreMatch.contentToStore,
          category: memoryStoreMatch.category
        }
      };
      this._emitClassified(result, msgLen);
      return result;
    }

    const skillRegistry = this.serviceManager.has('SkillRegistry')
      ? this.serviceManager.get('SkillRegistry')
      : null;
    const skillMatch = skillRegistry?.matchTrigger(msgLower);
    if (skillMatch) {
      const result = {
        type: 'SKILL',
        confidence: skillMatch.confidence,
        metadata: {
          skillId: skillMatch.skill.id,
          skillName: skillMatch.skill.name,
          matchedTrigger: skillMatch.matchedTrigger
        }
      };
      this._emitClassified(result, msgLen);
      return result;
    }

    if (msgLen <= 80) {
      const startsWithQuestion = this._questionStarters.some(starter =>
        msgLower.startsWith(starter)
      );

      const hasFilePath = this._filePathPattern.test(msg) || this._pathPattern.test(msg);

      const hasContextDependency = this._contextDependentPatterns.some(pattern =>
        msgLower.includes(pattern)
      );

      const historyIsShallow = history.length <= 4;

      if (startsWithQuestion && !hasFilePath && !hasContextDependency && historyIsShallow) {
        const result = {
          type: 'LOOKUP',
          confidence: 0.8,
          metadata: { isFactual: true, msgLen, historyDepth: history.length }
        };
        this._emitClassified(result, msgLen);
        return result;
      }
    }

    const result = {
      type: 'CONVERSATION',
      confidence: 1.0,
      metadata: { msgLen, historyDepth: history.length }
    };
    this._emitClassified(result, msgLen);
    return result;
  }

  _emitClassified({ type, confidence }, msgLen) {
    const preview = '';
    console.log(`[RequestClassifier] → ${type} (confidence: ${confidence}, len: ${msgLen})`);
    this.eventBus.emit('RequestClassifier:Classified', {
      type,
      confidence,
      msgLen,
      timestamp: Date.now()
    });
  }
}

export default RequestClassifierService;

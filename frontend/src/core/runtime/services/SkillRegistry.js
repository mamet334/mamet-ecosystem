
const REQUIRED_FIELDS = ['id', 'name', 'triggers', 'type', 'steps', 'active'];

const KNOWN_TYPES = ['conversation', 'generation', 'lookup'];

const KNOWN_ACTIONS = ['ask', 'generate', 'read', 'write'];

export class SkillRegistry {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;

    this._skills = new Map();

    this._triggerIndex = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    let skillModules = {};
    try {
      skillModules = import.meta.glob('/src/skills/*.json', { eager: true });
    } catch (e) {
      console.warn('[SkillRegistry] Gagal scan folder /skills/:', e.message);
    }

    let loaded = 0;
    let skipped = 0;

    for (const [path, module] of Object.entries(skillModules)) {
      if (path.endsWith('.gitkeep')) continue;

      const skill = module?.default || module;

      const validation = this._validateManifest(skill, path);
      if (!validation.valid) {
        console.warn(`[SkillRegistry] Skill di ${path} ditolak: ${validation.reason}`);
        skipped++;
        continue;
      }

      if (!skill.active) {
        console.log(`[SkillRegistry] Skill "${skill.id}" inactive — tidak diindeks`);
        skipped++;
        continue;
      }

      if (this._skills.has(skill.id)) {
        console.warn(`[SkillRegistry] Konflik ID: "${skill.id}" sudah terdaftar — ${path} diabaikan`);
        skipped++;
        continue;
      }

      this._skills.set(skill.id, skill);

      for (const trigger of skill.triggers) {
        const normalized = trigger.toLowerCase().trim();
        this._triggerIndex.set(normalized, skill.id);
      }

      loaded++;
    }

    this.isInitialized = true;
    console.log(`[SkillRegistry] Initialized — ${loaded} skill aktif, ${skipped} dilewati`);

    this.eventBus.emit('SkillRegistry:Ready', {
      skillCount: loaded,
      skippedCount: skipped,
      skillIds: Array.from(this._skills.keys())
    });
  }

  matchTrigger(userMsg = '') {
    if (!this.isInitialized || this._skills.size === 0) return null;

    const normalized = userMsg.toLowerCase().trim();

    const exactSkillId = this._triggerIndex.get(normalized);
    if (exactSkillId) {
      const skill = this._skills.get(exactSkillId);
      return { skill, confidence: 1.0, matchedTrigger: normalized };
    }

    for (const [trigger, skillId] of this._triggerIndex.entries()) {
      if (normalized.includes(trigger)) {
        const skill = this._skills.get(skillId);
        return { skill, confidence: 0.75, matchedTrigger: trigger };
      }
    }

    return null;
  }

  getSkill(skillId) {
    return this._skills.get(skillId) || null;
  }

  list() {
    return Array.from(this._skills.values());
  }

  deactivate(skillId) {
    const skill = this._skills.get(skillId);
    if (!skill) return false;

    this._skills.delete(skillId);
    for (const trigger of skill.triggers) {
      this._triggerIndex.delete(trigger.toLowerCase().trim());
    }

    this.eventBus.emit('SkillRegistry:Deactivated', { skillId });
    console.log(`[SkillRegistry] Skill "${skillId}" dinonaktifkan (in-memory)`);
    return true;
  }

  _validateManifest(skill, path = '') {
    if (!skill || typeof skill !== 'object') {
      return { valid: false, reason: 'Bukan object JSON yang valid' };
    }

    for (const field of REQUIRED_FIELDS) {
      if (skill[field] === undefined || skill[field] === null) {
        return { valid: false, reason: `Field wajib "${field}" tidak ada` };
      }
    }

    if (!KNOWN_TYPES.includes(skill.type)) {
      return { valid: false, reason: `Tipe skill tidak dikenal: "${skill.type}". Dikenal: ${KNOWN_TYPES.join(', ')}` };
    }

    if (!Array.isArray(skill.triggers) || skill.triggers.length === 0) {
      return { valid: false, reason: '"triggers" harus berupa array tidak kosong' };
    }

    if (!Array.isArray(skill.steps) || skill.steps.length === 0) {
      return { valid: false, reason: '"steps" harus berupa array tidak kosong' };
    }

    if (skill.steps.length > 10) {
      return { valid: false, reason: `Jumlah steps melebihi batas (${skill.steps.length} > 10)` };
    }

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      if (!step.action) {
        return { valid: false, reason: `Step ${i + 1} tidak punya field "action"` };
      }
      if (!KNOWN_ACTIONS.includes(step.action)) {
        return { valid: false, reason: `Step ${i + 1} punya action tidak dikenal: "${step.action}". Dikenal: ${KNOWN_ACTIONS.join(', ')}` };
      }
      if (step.action === 'ask' && !step.prompt) {
        return { valid: false, reason: `Step ${i + 1} action "ask" harus punya field "prompt"` };
      }
      if (step.action === 'generate' && !step.prompt) {
        return { valid: false, reason: `Step ${i + 1} action "generate" harus punya field "prompt"` };
      }
    }

    return { valid: true, reason: '' };
  }
}

export default SkillRegistry;

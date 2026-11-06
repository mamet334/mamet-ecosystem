
const ACTION_POLICY = {
  ask:      'ALLOW',
  generate: 'ALLOW',
  read:     'ALLOW',
  write:    'REQUIRE_CONFIRMATION',
};

export class SkillGuardService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.eventBus = serviceManager.get('EventBus');
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[SkillGuardService] Initialized');
    this.eventBus.emit('SkillGuard:Ready', { status: 'READY' });
  }

  validate(skill) {
    if (!skill) {
      return { allowed: false, reason: 'Skill tidak ditemukan', stepPolicies: [] };
    }

    if (!skill.active) {
      return { allowed: false, reason: `Skill "${skill.id}" tidak aktif`, stepPolicies: [] };
    }

    const stepPolicies = [];
    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      const policy = ACTION_POLICY[step.action];

      if (!policy) {
        return {
          allowed: false,
          reason: `Step ${i + 1} punya action tidak dikenal: "${step.action}"`,
          stepPolicies
        };
      }

      stepPolicies.push({
        step: i + 1,
        action: step.action,
        policy
      });
    }

    const hasConfirmationStep = stepPolicies.some(s => s.policy === 'REQUIRE_CONFIRMATION');

    return {
      allowed: true,
      reason: '',
      stepPolicies,
      hasConfirmationStep
    };
  }

  getActionPolicy(action) {
    return ACTION_POLICY[action] || 'DENY';
  }
}

export default SkillGuardService;

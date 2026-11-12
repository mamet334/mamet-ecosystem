import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { RuntimeContext } from '../runtime_context.ts';

export interface EngineerContextResult {
  engineerContextPrompt: string;
  brain1Ids: string[];
  brain2Tasks: string[];
  brain2Gaps: string[];
  brain2Verifications: string[];
  brain1Entries: any[];
}

export const loadEngineerContext = async (
  mode: string,
  finalMessage: string,
  rctx: RuntimeContext
): Promise<EngineerContextResult> => {
  let engineerContextPrompt = '';
  let brain1Ids: string[] = [];
  let brain2Tasks: string[] = [];
  let brain2Gaps: string[] = [];
  let brain2Verifications: string[] = [];
  let brain1Entries: any[] = [];

  if (mode === 'ENGINEER') {
    try {
      const supClient = createClient(rctx.env.supabaseUrl, rctx.env.supabaseServiceKey);
      
      const lowerMsgForEngineer = (finalMessage || '').toLowerCase();
      
      const needsDeprecatedADR = /deprecated|konflik|conflict|history|lama|diganti|obsolete|pola lama/.test(lowerMsgForEngineer);

      const staticRes = await supClient
        .from('project_memory_entries')
        .select('id, entry_type, title, content, governance_status, version_major, version_minor, version_patch, is_current')
        .in('governance_status', ['ACTIVE', 'APPROVED', 'VERIFIED'])
        .eq('is_current', true)
        .in('entry_type', ['ADRLink', 'Solution', 'Lesson', 'RootCause'])
        .order('created_at', { ascending: false })
        .limit(8);

      const skippedEntries = (staticRes.data || []).filter((e: any) =>
        e.governance_status === 'SUPERSEDED' || e.governance_status === 'DEPRECATED'
      );
      if (skippedEntries.length > 0) {
        console.log(`[GOVERNANCE] Skipped ${skippedEntries.length} entries: ${skippedEntries.map((e: any) => `${e.title}(${e.governance_status})`).join(', ')}`);
      }

      brain1Entries = staticRes.data || [];
      brain1Ids = brain1Entries.map((e: any) =>
        `${e.title} [v${e.version_major || 1}.${e.version_minor || 0}.${e.version_patch || 0}]`
      );

      const [tasksRes, gapsRes, verRes] = await Promise.all([
        supClient.from('engineering_tasks').select('task_number, title, status, goal').in('status', ['Proposed', 'InProgress']).order('created_at', { ascending: false }).limit(5),
        supClient.from('architecture_gaps').select('gap_number, title, status, description').in('status', ['Open', 'InProgress']).order('created_at', { ascending: false }).limit(5),
        supClient.from('verification_runs').select('related_task, result, verification_type, evidence').order('created_at', { ascending: false }).limit(3)
      ]);

      brain2Tasks = tasksRes.data?.map((t: any) => t.task_number) || [];
      brain2Gaps = gapsRes.data?.map((g: any) => g.gap_number) || [];
      brain2Verifications = verRes.data?.map((v: any) => v.related_task) || [];

      let deprecatedContext = '';
      if (needsDeprecatedADR) {
        const depRes = await supClient.from('project_memory_entries').select('entry_type, title, content').eq('status', 'Deprecated').order('updated_at', { ascending: false }).limit(5);
        if (depRes.data && depRes.data.length > 0) {
          deprecatedContext = `\n[HISTORICAL CONTEXT — Deprecated ADRs]\n`;
          deprecatedContext += `NOTE: These are history, not current rules. They explain WHY a decision was once made.\n`;
          deprecatedContext += depRes.data.map((e: any) => `- [DEPRECATED] ${e.title}`).join('\n') + '\n';
        }
      }

      engineerContextPrompt = `\n\n[MAMET ENGINEER CONTEXT — Two-Brain Model (ADR-0006)]\n`;

      engineerContextPrompt += `\n--- BRAIN 1: STATIC ENGINEERING KNOWLEDGE (Foundation — rarely changes) ---\n`;
      engineerContextPrompt += staticRes.data?.map((e: any) => `[${e.entry_type}] ${e.title}: ${e.content}`).join('\n') || 'No static knowledge loaded.';
      engineerContextPrompt += '\n';

      engineerContextPrompt += `\n--- BRAIN 2: DYNAMIC ENGINEERING CONTEXT (Current state — changes per session) ---\n`;
      engineerContextPrompt += `Active Tasks:\n${tasksRes.data?.map((t: any) => `- ${t.task_number} (${t.status}): ${t.title} | Goal: ${t.goal}`).join('\n') || 'None'}\n`;
      engineerContextPrompt += `Architecture Gaps:\n${gapsRes.data?.map((g: any) => `- ${g.gap_number} (${g.status}): ${g.title}`).join('\n') || 'None'}\n`;
      engineerContextPrompt += `Recent Verifications:\n${verRes.data?.map((v: any) => `- [${v.result}] ${v.related_task} (${v.verification_type}): ${v.evidence}`).join('\n') || 'None'}\n`;
      if (deprecatedContext) engineerContextPrompt += deprecatedContext;

      engineerContextPrompt += `
[ENGINEER IDENTITY & CONVERSATION MODE]
You are Mamet Engineer — an AI coding assistant embedded in the Mamet OS Ecosystem. Converse naturally and match the
Owner's tone; for analysis read the evidence first; for code changes analyse, propose, then signal the patch.
BRAIN 1 above is long-term project knowledge (ADRs, lessons); BRAIN 2 is current state (tasks, gaps, verifications).

RULE 0 - WORK PROCEDURE (constitution/28_PROSEDUR_KERJA_ENGINEER.md — read it when unsure):
[0.1] ANNOUNCE THE TASK FIRST. When the user names a task (e.g. "TUGAS-02"), the FIRST line of your answer must be
      exactly this form — the system checks for it:
        TUGAS YANG DIKERJAKAN: <task id> — "<quoted sentence copied verbatim from the source document>"
      <task id> is the id THE USER TYPED, never a BRAIN 2 id (TASK-0014 …). The quote (at least 15 characters, in
      double quotes) comes from THAT task's section. If the requested task is not in your sources, STOP and ask —
      never work on the nearest task that happens to be retrieved.
[0.2] SEPARATE PROVEN FROM GUESSED. A claim with no source is a guess — label it, or prove it first.
[0.2b] MAKE BEHAVIOUR CLAIMS TESTABLE. Whenever you state that some input produces some result from a function, emit a
      claim block with EVERY such claim; the app runs it against the real code and appends the result. Format:
        <uji_klaim berkas="frontend/src/…/File.js" fungsi="exportedName">
        {"title":"x"} => RESULT
        [{"title":"x"},{"description":"y"}] => RESULT
        </uji_klaim>
      Rules: repo-relative path inside frontend/src, .js/.mjs only, exported function, at most 30 cases. A JSON array is
      passed as several arguments; anything else as one argument.
[0.2c] RECORD A FINDING IN AN EXPLICIT BLOCK — prose is NOT captured. For something wrong that is NOT what the user
      asked (stale doc, orphan code, unrun test, swallowed error):
        <temuan berkas="frontend/src/…/Thing.js" tingkat="rendah|sedang|tinggi">
        RINGKASAN: one sentence, what is wrong
        BUKTI: the command you ran and what its output showed
        </temuan>
      BUKTI is mandatory — without it the app drops the finding. One block per finding. Do not re-report an open
      finding; with new evidence, name its TMN-#### id. Do NOT invent findings: finding nothing is a good session.
[0.2d] RECORD LASTING KNOWLEDGE IN AN EXPLICIT BLOCK — this is how you get smarter between sessions. The Owner approves
      it with a button and it appears in BRAIN 1 next time. For a proven root cause, a decision and its reason, or a rule
      about this codebase you had to discover:
        <pengetahuan jenis="Lesson|RootCause|Solution|ADRLink" judul="short, searchable, unique">
        What it is and WHY it matters, with the evidence that establishes it.
        </pengetahuan>
      The judul attribute is mandatory and must be unique — duplicates are dropped. Name files and line numbers. One
      block per idea. Do NOT record what git already answers ("what changed, when") — record what git CANNOT: why.
      Do NOT record session or patch numbers.
[0.2e] THE OWNER CAN ATTACH SCREENSHOTS AND DOCUMENTS. A screenshot is the ONLY evidence of what the app actually LOOKS
      like. You cannot derive that from source code, and you must not pretend you can. With a screenshot:
      describe what you SEE before explaining it, and say plainly if it is too small or cropped. A document is the Owner's
      instruction: quote the part you act on. If a block says ISINYA TIDAK DIBACA, the content never reached you — say
      so and ask for it as text; do NOT guess from the filename.
[0.3] EVIDENCE FROM PRIMARY SOURCES. Code question → read the file with git show HEAD:path (see COMMANDS) — WITH "HEAD:";
      without it git prints NOTHING and exits 0 (wrong form, not a missing file). Search first for big files.
[0.4] ONE WAY FAILS → CHANGE THE WAY. Never repeat an identical command; change the form or the source, or say plainly
      you could not get the evidence.
[0.5] REPRODUCE BEFORE FIXING; chase the ROOT CAUSE, not the symptom.
[0.6] SMALLEST CHANGE THAT FIXES THE ROOT. Mamet code is written WITHOUT explanatory comments (Owner rule): the why
      lives in names, tests and dated docs (changelog, roadmap, ADR). Only tool directives stay.
[0.7] TESTS MUST BE ABLE TO FAIL, AND NEED A CONTROL: the symptom exists BEFORE the fix and is gone AFTER.
[0.8] REPORT HONESTLY: what you did, the evidence, what is NOT yet proven, what failed — including your own mistakes.
[0.9] CORE IMMUTABLE files are never patched: explain the change and let the Owner decide.

PATCHES: follow "[ENGINEER MODE — INSTRUKSI WAJIB]" earlier in this prompt — the single source for the JSON patch
format and the [MAMET_PATCH_READY] marker (it makes the app show an "Apply Patch" button).

COMMANDS: write the marker inline with SQUARE brackets — it is not an alat tag and takes no JSON:
  [MAMET_CMD: git status]
  [MAMET_CMD: git ls-files -- "*AssistantService.js"]
  [MAMET_CMD: git show HEAD:frontend/src/core/runtime/services/AssistantService.js]
  [MAMET_CMD: git grep -n -B2 -A4 "processMessage" -- frontend/src]
One command per marker, the marker itself (not a code block). Say WHY before it and what output you expect after. The output comes back to you as the next message; if it says DITOLAK OWNER or TIDAK
DIJALANKAN, report that honestly and never pretend it ran. Which programs and git commands are allowed, which run
without a dialog, and the output limit are listed in the "[PERINTAH YANG BISA DIJALANKAN]" note in the conversation.
Commands outside that list are rejected — do not propose them as markers; write them as plain text for the Owner.

CRITICAL: for something that needs the Owner's decision before you continue (risk to core files, security,
unexpected breaking error), write [MAMET_CRITICAL: what and why], give 2-3 options, and stop — no [MAMET_CMD:] or
[MAMET_PATCH_READY] in the same message.
`;
    } catch (err) {
      console.error("Failed to fetch engineer context:", err);
    }
  }

  return {
    engineerContextPrompt,
    brain1Ids,
    brain2Tasks,
    brain2Gaps,
    brain2Verifications,
    brain1Entries
  };
};

/**
 * Rule catalog: the ordered list of all rules, plus a lookup by id.
 */
import type { Rule } from '../types.js';
import { agentRules } from './agent.js';
import { commandRules } from './command.js';
import { skillRules } from './skill.js';
import { settingsRules } from './settings.js';
import { mcpRules } from './mcp.js';
import { securityRules } from './security.js';
import { claudemdRules } from './claudemd.js';
import { coreRules } from './core.js';

/** The complete, ordered rule catalog. */
export const allRules: Rule[] = [
  ...coreRules,
  ...agentRules,
  ...commandRules,
  ...skillRules,
  ...settingsRules,
  ...mcpRules,
  ...claudemdRules,
  ...securityRules,
];

/** Map of ruleId → Rule for fast lookup. */
export const rulesById: ReadonlyMap<string, Rule> = new Map(allRules.map((r) => [r.id, r]));

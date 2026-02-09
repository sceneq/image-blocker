import type { FilterRule } from '@/shared/types';

/** 現在の URL にマッチするすべての有効なルールを priority 昇順で返す */
export function matchAllRules(url: string, rules: FilterRule[]): FilterRule[] {
  const matched: FilterRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      if (new RegExp(rule.sitePattern).test(url)) matched.push(rule);
    } catch (e) {
      console.error(e);
    }
  }
  matched.sort((a, b) => a.priority - b.priority);
  return matched;
}

/** 現在の URL に最初にマッチするルールを返す */
export function matchRule(url: string, rules: FilterRule[]): FilterRule | null {
  return matchAllRules(url, rules)[0] ?? null;
}

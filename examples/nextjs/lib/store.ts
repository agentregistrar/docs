// Local demo only. Replace these in-memory Maps with a database that has
// unique constraints on (iss, human.id), agent_id, and jti before taking live traffic.
export interface DemoAccount {
  accountId: string;
  apiKey: string;
  agentIds: Set<string>;
  sessions: Set<string>;
}

export const accounts = new Map<string, DemoAccount>();
export const seenSignupJti = new Map<string, string>();
export const seenLoginJti = new Set<string>();

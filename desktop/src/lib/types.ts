export type Profile = {
  name: string;
  email: string;
  issuer_id: string;
  key_id: string;
  p8_path: string;
};

export type ScriptSettings = {
  repo: string;
  branch: string;
};

export type ScriptState = {
  settings: ScriptSettings;
  profiles: Profile[];
};

export type RecentRun = {
  profile?: string | null;
  releaseTag?: string | null;
  workflowUrl?: string | null;
  status?: string | null;
  conclusion?: string | null;
  createdAt?: string | null;
};

export type AppConfig = {
  githubToken: string;
  lastProfile: string;
  lastIpaPath: string;
  lastRun?: RecentRun | null;
};

export type RepoCheckResult = {
  ok: boolean;
  private: boolean;
  hasWorkflow: boolean;
  actionsUrl?: string | null;
  message: string;
};

export type WorkflowRunSummary = {
  status?: string | null;
  conclusion?: string | null;
  htmlUrl?: string | null;
  createdAt?: string | null;
};

export type ScriptOutputEvent = {
  kind: string;
  line: string;
};

export type ParsedDeployOutput = {
  releaseTag?: string;
  workflowUrl?: string;
  profile?: string;
  email?: string;
};

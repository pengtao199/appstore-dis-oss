import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppConfig,
  Profile,
  RepoCheckResult,
  ScriptOutputEvent,
  ScriptState,
  WorkflowRunSummary,
} from "./types";

const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const mockState: ScriptState = {
  settings: { repo: "", branch: "main" },
  profiles: [],
};

const mockConfig: AppConfig = {
  githubToken: "",
  lastProfile: "",
  lastIpaPath: "",
  lastRun: null,
};

async function maybeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  fallback?: T,
): Promise<T> {
  if (!isTauriRuntime) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Tauri runtime required for ${command}`);
  }
  return invoke<T>(command, args);
}

export async function loadScriptState(): Promise<ScriptState> {
  return maybeInvoke("load_script_state", undefined, mockState);
}

export async function saveSettings(repo: string, branch: string): Promise<void> {
  return maybeInvoke("save_settings", { repo, branch }, undefined);
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  return maybeInvoke("save_profiles", { profiles }, undefined);
}

export async function loadAppConfig(): Promise<AppConfig> {
  return maybeInvoke("load_app_config", undefined, mockConfig);
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  return maybeInvoke("save_app_config", { config }, undefined);
}

export async function pickFile(kind: "ipa" | "p8"): Promise<string | null> {
  return maybeInvoke("pick_file", { kind }, null);
}

export async function runBootstrap(
  repo: string,
  branch: string,
  githubToken: string,
): Promise<void> {
  return maybeInvoke("run_bootstrap", { repo, branch, githubToken }, undefined);
}

export async function runDeploy(args: {
  profile: string;
  ipaPath: string;
  repo: string;
  branch: string;
  githubToken: string;
}): Promise<void> {
  return maybeInvoke("run_deploy", args, undefined);
}

export async function checkRepoAccess(
  repo: string,
  token: string,
): Promise<RepoCheckResult> {
  return maybeInvoke(
    "check_repo_access",
    { repo, token },
    {
      ok: false,
      private: false,
      hasWorkflow: true,
      actionsUrl: null,
      message: "Tauri runtime required to test GitHub access",
    },
  );
}

export async function fetchRecentRun(
  repo: string,
  token: string,
): Promise<WorkflowRunSummary | null> {
  return maybeInvoke("fetch_recent_run", { repo, token }, null);
}

export async function openExternal(url: string): Promise<void> {
  if (!isTauriRuntime) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return maybeInvoke("open_external", { url }, undefined);
}

export async function subscribeToScriptOutput(
  onMessage: (event: ScriptOutputEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime) {
    return () => undefined;
  }

  const unlisten = await listen<ScriptOutputEvent>("script-output", (event) => {
    onMessage(event.payload);
  });

  return () => {
    unlisten();
  };
}

import type { ParsedDeployOutput } from "./types";

export function parseDeployOutput(lines: string[]): ParsedDeployOutput {
  const result: ParsedDeployOutput = {};

  for (const line of lines) {
    if (line.startsWith("release tag: ")) {
      result.releaseTag = line.replace("release tag: ", "").trim();
    } else if (line.startsWith("workflow dispatched. check: ")) {
      result.workflowUrl = line.replace("workflow dispatched. check: ", "").trim();
    } else if (line.startsWith("profile: ")) {
      result.profile = line.replace("profile: ", "").trim();
    } else if (line.startsWith("email: ")) {
      result.email = line.replace("email: ", "").trim();
    }
  }

  return result;
}

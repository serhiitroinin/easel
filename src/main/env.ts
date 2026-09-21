import { execFileSync } from "node:child_process";

function hasCommand(command: string): boolean {
  try {
    execFileSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function loginShellPath(): string | null {
  const shell = process.env.SHELL ?? "/bin/zsh";
  try {
    const output = execFileSync(shell, ["-ilc", "printf %s \"$PATH\""], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    return output.trim() === "" ? null : output.trim();
  } catch {
    return null;
  }
}

/**
 * A GUI launch inherits a short PATH, and Easel resolves `codex` with
 * `which`. One login shell gives the same PATH a terminal launch would have.
 */
export function adoptLoginShellPath(): void {
  if (hasCommand("codex") && hasCommand("claude")) return;
  const path = loginShellPath();
  if (!path) return;
  const known = new Set((process.env.PATH ?? "").split(":").filter(Boolean));
  const merged = [...known, ...path.split(":").filter((entry) => entry !== "" && !known.has(entry))];
  process.env.PATH = merged.join(":");
}

# Reins integration reference

This page records how Easel uses [Reins](https://github.com/serhiitroinin/reins)
and which provider behaviors affected the design. Use it as a reference when you
build your own application on Reins. The facts were verified with Reins 0.1,
Claude Code 2.1, and Codex 0.154.

The Reins package contains its own documentation in `node_modules/reins/docs/`.
Read `getting-started/native-providers.md` first.

## The closed tool surface

Easel gives the agent only application tools. Each engine needs different
settings for this.

Claude Code, in `createClaudeAgentSdkConnector`:

- `tools: []`, `skills: []`, and `settingSources: []` remove the built-in
  tools, the skills, and the settings files of the user.
- `strictMcpConfig: true` ignores MCP servers from other configuration.
- `authorizeTool` permits a tool only when its name starts with `mcp__reins__`.
  Reins gives the application tools this prefix on Claude Code.

Codex, in `createCodexAppServerProcessConnector` and the `thread` policy:

- The arguments `--disable shell_tool`, `--disable unified_exec`, and
  `--disable shell_snapshot` remove the shell tools.
- The thread uses `sandbox: "read-only"` and `approvalPolicy: "never"`.
- `--strict-config` refuses configuration that Codex does not know.
- Application tools arrive in Codex as dynamic tools, with no prefix.

Both engines:

- Pass an exact environment. Easel passes `PATH`, locale, proxy, and
  certificate variables, and no other variable.
- Use an empty private directory as the working directory.

## Provider behaviors to know

1. **Discovery takes the adapter id as a string.** `runtime.profile(id)`,
   `runtime.models(id)`, and `runtime.limits(id)` each return a result with the
   status `available`, `unavailable`, or `unsupported`. Show all three states.
   Do not make the model menu wait for the limits.
2. **Codex has no system prompt field.** Put the application instructions in a
   context source. `instructions` is trusted text and `content` is untrusted
   data. This works the same on both engines. Keep the Claude `systemPrompt`
   short.
3. **Codex replaces `auth.json` when it refreshes a token.** Easel runs Codex
   with a private `CODEX_HOME`, because Codex loads the full `config.toml`,
   which can contain MCP servers. If you copy `auth.json` into the private
   home, the copy and the original become different after a refresh, and the
   Codex command-line tool loses its login. Easel makes a symbolic link to the
   original file. When Easel finds a regular file in place of the link, a
   refresh replaced the link. Easel then copies the newer file to the original
   location and makes the link again. See `linkCodexAuth` in `engines.ts`.
4. **Codex needs `cli_auth_credentials_store="file"`** to read the linked
   credential file and not the system keychain.
5. **Both adapters remove tool output by default.** A refused tool call then
   shows no reason in the interface. Easel passes `events.redactToolOutput` and
   keeps the output of its own tools only, up to 4000 characters.
6. **Images work in both directions on both engines.** An input part can be
   `{ type: "image", mediaType, data: Uint8Array }`. A tool result can contain
   `{ type: "image", mediaType, data: <base64 string> }`. The `view_canvas`
   tool uses this.
7. **Tool input arrives as `unknown`.** Give each tool a closed `inputSchema`
   with `additionalProperties: false`. Write each error message for the model:
   say what is wrong and what is valid.
8. **The `validate` hook of `createToolHost` hides the thrown message.** The
   model receives a generic message. Easel validates in `execute` and returns
   the detailed message as an error result.
9. **A change of engine starts a new provider session.** The new engine does
   not see the earlier chat. Easel puts the necessary state (the board, the
   selection, the changes) in a context source, so each engine receives it in
   each turn.
10. **Events are stored for each session and each adapter.** A board that used
    two engines needs a merge of two event lists by `timestamp`. The messages
    of the person are not events. Store them in your application.
11. **Same-turn steering works on both engines.** Call
    `run.followUp({ expectedTurnId: run.turnId, input })`. The call can return a
    different run object. Read the events of that run.
12. **A desktop launch has a short `PATH`.** The Codex connector needs the
    exact command path. Easel reads `PATH` from one login shell when `claude` or
    `codex` is not found. See `src/main/env.ts`.
13. **Limits change after a turn.** Each adapter records the limits that the
    provider sends during a turn. Easel reads `limits()` again after each turn,
    when the engine menu opens, and when the window gets the focus. It sets
    `limitsTtlMs` to 20 seconds.
14. **Ignore unknown event kinds.** The reducer in `src/renderer/chat/turns.ts`
    handles the kinds that Easel shows and ignores the others.

## The run lifecycle

```ts
const run = runtime.start({ session, adapterId, input, model, effort, settings });
for await (const event of run.events) show(event);
const status = await run.done; // "completed", "error", or "interrupted"
```

- `run.cancel()` interrupts the turn and keeps the events that arrived.
- The session key is `{ tenantId, actorId, threadId }`. Easel uses the board id
  as `threadId`. The same key continues the same provider session, also after
  a restart, because the persistence is durable.
- `createFilePersistence({ directory })` from `reins/persistence/file` needs an
  absolute private directory and one writer process.
- `persistence.events.list(session, adapterId)` returns the events for replay.

## The offline engine

`createScriptedAdapter` from `reins/testing` makes an engine that runs a
script. Easel uses it for development, for the verification scripts, and for
the screenshots. The scripted adapter calls the same tool host and receives the
same context as a live adapter. It is a testing API. Easel adds it only when
`EASEL_OFFLINE=1` is set.

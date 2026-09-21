import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoardStore } from "../src/main/boards";

test("concurrent changes to one board are all kept", async () => {
  const directory = mkdtempSync(join(tmpdir(), "easel-boards-"));
  const store = new BoardStore(directory);
  const board = await store.create();

  await Promise.all(Array.from({ length: 20 }, (_, index) =>
    store.update(board.id, (current) => ({
      ...current,
      messages: [...current.messages, { id: `m${index}`, at: new Date().toISOString(), text: String(index) }],
    }))));

  const saved = await store.read(board.id);
  expect(saved.messages.map((message) => message.id).sort()).toEqual(
    Array.from({ length: 20 }, (_, index) => `m${index}`).sort(),
  );
  expect(readdirSync(directory).filter((name) => name.endsWith(".tmp"))).toEqual([]);
});

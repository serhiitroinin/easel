import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Board, BoardSummary } from "../shared/app";

const UNTITLED = "Untitled board";

export class BoardStore {
  /** One queue for each board, so two changes never read the same old file. */
  private readonly queues = new Map<string, Promise<unknown>>();
  private staged = 0;

  constructor(private readonly directory: string) {}

  private file(id: string): string {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(`Not a board identifier: ${id}`);
    return join(this.directory, `${id}.json`);
  }

  async ready(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }

  async list(): Promise<BoardSummary[]> {
    await this.ready();
    const names = await readdir(this.directory);
    const boards = await Promise.all(
      names.filter((name) => name.endsWith(".json")).map((name) => this.read(name.slice(0, -5))),
    );
    return boards
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async read(id: string): Promise<Board> {
    const board = JSON.parse(await readFile(this.file(id), "utf8")) as Board;
    if (board.id !== id) throw new Error(`The board file for ${id} holds a different identifier.`);
    return board;
  }

  async create(): Promise<Board> {
    await this.ready();
    const now = new Date().toISOString();
    const board: Board = {
      id: randomUUID(),
      title: UNTITLED,
      createdAt: now,
      updatedAt: now,
      engine: null,
      scene: null,
      messages: [],
    };
    await this.write(board);
    return board;
  }

  async write(board: Board): Promise<void> {
    await this.ready();
    const target = this.file(board.id);
    this.staged += 1;
    const staged = `${target}.${process.pid}.${this.staged}.tmp`;
    await writeFile(staged, JSON.stringify(board, null, 2), { mode: 0o600 });
    await rename(staged, target);
  }

  update(id: string, change: (board: Board) => Board): Promise<Board> {
    const run = async (): Promise<Board> => {
      const next = change(await this.read(id));
      next.updatedAt = new Date().toISOString();
      await this.write(next);
      return next;
    };
    const result = (this.queues.get(id) ?? Promise.resolve()).then(run, run);
    const settled = result.catch(() => undefined).then(() => {
      if (this.queues.get(id) === settled) this.queues.delete(id);
    });
    this.queues.set(id, settled);
    return result;
  }

  async remove(id: string): Promise<void> {
    await rm(this.file(id), { force: true });
  }

  async firstOrCreate(): Promise<Board> {
    const boards = await this.list();
    const first = boards[0];
    return first ? await this.read(first.id) : await this.create();
  }
}

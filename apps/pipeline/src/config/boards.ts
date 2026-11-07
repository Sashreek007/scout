// Reads sources/boards.yaml: the job boards every run polls, whatever the lists say (#6). Each run
// adds the boards its listings and stored jobs point at, but nothing is ever written back here.
import { readFile } from 'node:fs/promises';
import { BOARD_ATS, canonicalToken, describeIssues, type BoardAts } from '@scout/core';
import { parse } from 'yaml';
import { z } from 'zod';

const tokens = (ats: BoardAts) =>
  z
    .array(
      z.string().transform((token, ctx) => {
        const canonical = canonicalToken(ats, token);
        if (canonical === null) {
          ctx.addIssue({
            code: 'custom',
            message: `"${token}" is not a board token: letters, digits, ".", "_", "-" and spaces`,
          });
          return z.NEVER;
        }
        return canonical;
      }),
    )
    .nullable()
    .default([])
    .transform((list) => [...new Set(list)]);

const BoardsFileSchema = z.strictObject({
  greenhouse: tokens('greenhouse'),
  lever: tokens('lever'),
  ashby: tokens('ashby'),
});

export type ConfiguredBoards = Record<BoardAts, string[]>;

/** Reads and checks the file, naming every problem at once. */
export async function loadBoards(path: string): Promise<ConfiguredBoards> {
  const parsed = BoardsFileSchema.safeParse(parse(await readFile(path, 'utf8')) ?? {});
  if (!parsed.success) {
    throw new Error(`${path} has problems:\n${describeIssues(parsed.error).join('\n')}`);
  }
  const boards = {} as ConfiguredBoards;
  for (const ats of BOARD_ATS) boards[ats] = parsed.data[ats];
  return boards;
}

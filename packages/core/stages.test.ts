import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validApplication } from './schemas/examples.fixture';
import { ApplicationSchema, type Application } from './schemas';
import {
  ACTORS,
  CREATORS,
  DASHBOARD_MOVES,
  FINAL_STAGES,
  IllegalMoveError,
  MOVES,
  STAGES,
  canMove,
  eventId,
  firstEvent,
  movesFrom,
  moveStage,
  type Actor,
  type Stage,
} from './stages';

const AT = new Date('2026-11-05T20:00:00Z');

function inStage(stage: Stage): Application {
  return ApplicationSchema.parse({ ...validApplication, stage });
}

/** The edges of docs/images/stages.png, written out by hand so the table is checked against it. */
const DIAGRAM: [Stage, Stage, Actor[]][] = [
  ['queued', 'planning', ['pipeline']],
  ['planning', 'needs_answers', ['pipeline']],
  ['planning', 'review', ['pipeline']],
  ['needs_answers', 'review', ['you']],
  ['review', 'approved', ['you']],
  ['review', 'skipped', ['you']],
  ['planning', 'failed', ['pipeline']],
  ['approved', 'filling', ['agent']],
  ['filling', 'approved', ['agent']],
  ['filling', 'applied', ['agent', 'you']],
  ['filling', 'needs_answers', ['agent']],
  ['filling', 'needs_hand', ['agent']],
  ['filling', 'failed', ['agent']],
  ['failed', 'approved', ['you']],
  ['failed', 'queued', ['you']],
  ['needs_hand', 'filling', ['you']],
  ['needs_hand', 'approved', ['you']],
  ['needs_hand', 'applied', ['you', 'agent']],
  // "posting taken down, any stage before applied"
  ['queued', 'closed', ['pipeline']],
  ['planning', 'closed', ['pipeline']],
  ['needs_answers', 'closed', ['pipeline']],
  ['review', 'closed', ['pipeline']],
  ['approved', 'closed', ['pipeline']],
  ['filling', 'closed', ['agent']],
  // after applying
  ['applied', 'assessment', ['you', 'mail']],
  ['applied', 'interview', ['you', 'mail']],
  ['assessment', 'interview', ['you', 'mail']],
  ['interview', 'offer', ['you']],
  // "Rejected and withdrawn can follow any stage from applied on."
  ['applied', 'rejected', ['you', 'mail']],
  ['assessment', 'rejected', ['you', 'mail']],
  ['interview', 'rejected', ['you', 'mail']],
  ['offer', 'rejected', ['you', 'mail']],
  ['applied', 'withdrawn', ['you']],
  ['assessment', 'withdrawn', ['you']],
  ['interview', 'withdrawn', ['you']],
  ['offer', 'withdrawn', ['you']],
];

const allowed = DIAGRAM.flatMap(([from, to, actors]) => actors.map((by) => ({ from, to, by })));
const isAllowed = (from: Stage, to: Stage, by: Actor) =>
  allowed.some((m) => m.from === from && m.to === to && m.by === by);

describe('the move table', () => {
  it('lists the sixteen stages', () => {
    expect(STAGES).toEqual([
      'queued',
      'planning',
      'needs_answers',
      'review',
      'approved',
      'filling',
      'needs_hand',
      'applied',
      'assessment',
      'interview',
      'offer',
      'rejected',
      'withdrawn',
      'skipped',
      'closed',
      'failed',
    ]);
    expect(ACTORS).toEqual(['pipeline', 'agent', 'you', 'mail']);
  });

  it('matches the stage diagram exactly, one row per from and to', () => {
    const rows = MOVES.map((m) => [m.from, m.to, [...m.by].sort()]);
    const expected = DIAGRAM.map(([from, to, by]) => [from, to, [...by].sort()]);
    expect(rows).toEqual(expect.arrayContaining(expected));
    expect(rows).toHaveLength(expected.length);
  });

  it('has no move out of a final stage, and every stage can be reached from queued', () => {
    for (const stage of FINAL_STAGES) expect(movesFrom(stage)).toEqual([]);
    const reached = new Set<Stage>(['queued']);
    for (let grew = true; grew;) {
      grew = false;
      for (const m of MOVES) {
        if (reached.has(m.from) && !reached.has(m.to)) {
          reached.add(m.to);
          grew = true;
        }
      }
    }
    expect([...reached].sort()).toEqual([...STAGES].sort());
  });
});

describe('moveStage', () => {
  it.each(allowed)('allows $from to $to by $by', ({ from, to, by }) => {
    const before = inStage(from);
    const { app, event } = moveStage(before, to, by, 'because', AT);
    expect(app).toEqual({ ...before, stage: to, stageAt: AT });
    expect(event).toEqual({ from, to, by, at: AT, detail: 'because' });
  });

  it('throws IllegalMoveError for every other from, to and actor', () => {
    let refused = 0;
    for (const from of STAGES) {
      for (const to of STAGES) {
        for (const by of ACTORS) {
          if (isAllowed(from, to, by)) continue;
          expect(() => moveStage(inStage(from), to, by, null, AT)).toThrow(IllegalMoveError);
          refused += 1;
        }
      }
    }
    expect(refused).toBe(STAGES.length * STAGES.length * ACTORS.length - allowed.length);
  });

  it('says what was refused', () => {
    expect(() => moveStage(inStage('review'), 'filling', 'agent')).toThrow(
      'agent may not move an application from review to filling',
    );
    try {
      moveStage(inStage('review'), 'filling', 'agent');
    } catch (error) {
      expect(error).toMatchObject({ from: 'review', to: 'filling', by: 'agent' });
    }
  });

  it('leaves the application it was given unchanged', () => {
    const before = inStage('review');
    const copy = structuredClone(before);
    moveStage(before, 'approved', 'you', null, AT);
    expect(before).toEqual(copy);
  });
});

describe('the stage machine, for any sequence of attempts', () => {
  const stage = fc.constantFrom(...STAGES);
  const actor = fc.constantFrom(...ACTORS);

  it('allows a move exactly when the table has it', () => {
    fc.assert(
      fc.property(stage, stage, actor, (from, to, by) => {
        const attempt = () => moveStage(inStage(from), to, by, null, AT);
        if (canMove(from, to, by)) expect(attempt).not.toThrow();
        else expect(attempt).toThrow(IllegalMoveError);
      }),
    );
  });

  it('never leaves the table: the history is an unbroken path of allowed moves', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(stage, actor), { maxLength: 40 }), (attempts) => {
        let app = inStage('queued');
        const history = [firstEvent('queued', 'pipeline', null, AT)];
        for (const [to, by] of attempts) {
          try {
            const moved = moveStage(app, to, by, null, AT);
            app = moved.app;
            history.push(moved.event);
          } catch (error) {
            expect(error).toBeInstanceOf(IllegalMoveError);
          }
        }
        for (let i = 1; i < history.length; i++) {
          const event = history[i]!;
          expect(event.from).toBe(history[i - 1]!.to);
          expect(canMove(event.from!, event.to, event.by)).toBe(true);
        }
        expect(history.at(-1)!.to).toBe(app.stage);
      }),
    );
  });
});

describe('creating an application', () => {
  it('starts in queued, by you or the pipeline', () => {
    expect(CREATORS).toEqual(['you', 'pipeline']);
    expect(firstEvent('queued', 'you', 'pasted a link', AT)).toEqual({
      from: null,
      to: 'queued',
      by: 'you',
      at: AT,
      detail: 'pasted a link',
    });
  });

  it('refuses any other first stage or creator', () => {
    expect(() => firstEvent('approved', 'you', null, AT)).toThrow(IllegalMoveError);
    expect(() => firstEvent('queued', 'agent', null, AT)).toThrow(
      'agent may not create an application',
    );
  });
});

describe('eventId', () => {
  it('sorts by time and names the move', () => {
    const created = eventId(firstEvent('queued', 'pipeline', null, AT));
    const later = eventId({
      from: 'queued',
      to: 'planning',
      by: 'pipeline',
      at: new Date(AT.getTime() + 1),
      detail: null,
    });
    expect(created).toBe(`${AT.getTime()}_new_queued`);
    expect(later > created).toBe(true);
    expect(later).toBe(`${AT.getTime() + 1}_queued_planning`);
  });
});

describe('DASHBOARD_MOVES', () => {
  it('is every move a person makes, except the two the server records for him', () => {
    expect(DASHBOARD_MOVES.map(({ from, to }) => `${from}>${to}`).sort()).toEqual(
      [
        'needs_answers>review',
        'review>approved',
        'review>skipped',
        'failed>approved',
        'failed>queued',
        'needs_hand>approved',
        'needs_hand>applied',
        'applied>assessment',
        'applied>interview',
        'assessment>interview',
        'interview>offer',
        ...['applied', 'assessment', 'interview', 'offer'].flatMap((from) => [
          `${from}>rejected`,
          `${from}>withdrawn`,
        ]),
      ].sort(),
    );
  });

  it('only holds moves the table lets you make', () => {
    for (const { from, to } of DASHBOARD_MOVES) expect(canMove(from, to, 'you')).toBe(true);
  });
});

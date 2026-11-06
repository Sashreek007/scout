/** A document that should exist doesn't. */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
  constructor(
    readonly collection: string,
    readonly id: string,
  ) {
    super(`${collection}/${id} does not exist`);
  }
}

/** A document that must be unique already exists, like a second application for one posting. */
export class AlreadyExistsError extends Error {
  override readonly name = 'AlreadyExistsError';
  constructor(
    readonly collection: string,
    readonly id: string,
  ) {
    super(`${collection}/${id} already exists`);
  }
}

/**
 * A stage move expected the application in one stage and found it in another: someone else moved
 * it first. The move is not written.
 */
export class StaleStageError extends Error {
  override readonly name = 'StaleStageError';
  constructor(
    readonly jobKey: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`applications/${jobKey} is in ${actual}, not ${expected}; it was moved by someone else`);
  }
}

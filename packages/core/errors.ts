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

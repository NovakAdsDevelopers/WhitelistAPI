export class BadRequestError extends Error {
  public errors: any[];

  constructor(message: string, errors: any[]) {
    super(message);
    this.errors = errors;
    this.name = "BadRequestError";
  }
}

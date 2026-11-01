/** Error with a German message about a broken exercise package. */
export class ExerciseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExerciseError";
  }
}

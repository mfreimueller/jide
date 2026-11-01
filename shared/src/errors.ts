/** Error with a German message about a broken exercise package. */
export class ExerciseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExerciseError";
  }
}

/** Error with a German message about a broken exam.json. */
export class ExamConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamConfigError";
  }
}

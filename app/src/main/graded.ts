import type { Exercise, StudentGradeResponse } from "@jide/shared";
import type { OpenedExercise } from "../shared-types/api";

/**
 * A graded exercise opens with the files of the graded hand-in (not the local draft, the workspace is not touched).
 * Files that are not editable in the package, or that the hand-in does not contain, keep the package's content.
 */
export function gradedExercise(ex: Exercise, grade: StudentGradeResponse, deadline: string | null): OpenedExercise {
  const handedIn = new Map(grade.files.map((f) => [f.path, f.content]));
  return {
    id: ex.id,
    title: ex.title,
    assignment: ex.assignment,
    mainFile: ex.mainFile,
    files: ex.files.map((f) => ({
      path: f.path,
      content: (f.editable ? handedIn.get(f.path) : undefined) ?? ex.originals[f.path] ?? "",
      editable: f.editable
    })),
    images: ex.images.map((i) => ({ path: i.path, title: i.title, svg: ex.imageContents[i.path] ?? "" })),
    deadline,
    submittedAt: grade.submittedAt,
    late: deadline !== null && new Date(grade.submittedAt).getTime() > new Date(deadline).getTime(),
    hasTests: false,
    graded: {
      symbol: grade.symbol,
      comment: grade.comment ?? "",
      gradedAt: grade.gradedAt,
      submittedAt: grade.submittedAt,
      lineComments: grade.lineComments
    }
  };
}

/**
 * Curated catalogue for code completion (SPEC 3.1, Option A: no real code analysis).
 * The data lives in app/catalogue.yaml (edited by the teacher); Vite bundles it at build time (`?raw`)
 * and it is parsed once when this module loads. No file access at runtime.
 * Content follows the course slides POS 1xHIF; all user-visible texts are German.
 */
import catalogueYaml from "../../../../../catalogue.yaml?raw";
import { parseCatalogue } from "./load";
import type { ClassInfo } from "./model";

export type { ClassInfo, Member, MemberKind, Param } from "./model";

const catalogue = parseCatalogue(catalogueYaml);

export const CLASSES: readonly ClassInfo[] = catalogue.classes;

/** Receivers like `System.out` that are static "paths" but not classes of their own. */
export const STATIC_RECEIVERS: readonly ClassInfo[] = [...CLASSES, ...catalogue.receivers];

/** Class names offered as plain identifiers (everything with a name that is a real class). */
export const CLASS_NAMES: readonly ClassInfo[] = CLASSES;

/** Pseudo class for variables of an array type: `int[] zahlen; zahlen.` */
export const ARRAY_TYPE: ClassInfo = catalogue.array;

export function findClass(name: string): ClassInfo | undefined {
  return CLASSES.find((c) => c.name === name);
}

export function findStaticReceiver(path: string): ClassInfo | undefined {
  return STATIC_RECEIVERS.find((c) => c.name === path);
}

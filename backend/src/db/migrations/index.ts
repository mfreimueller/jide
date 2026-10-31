import { MIGRATION_0001_TEACHERS_AND_AUTH } from './0001_teachers_and_auth.js';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [MIGRATION_0001_TEACHERS_AND_AUTH];

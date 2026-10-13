// Paths the graders read: the catalog layer they check screens against, and
// the canned screens their tests grade.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GRADERS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(GRADERS_DIR, '..', '..', '..', '..');
export const FIXTURES_DIR = join(GRADERS_DIR, 'fixtures');

export const CATALOG_DIR = join(REPO_ROOT, 'packages', 'catalog');
/** The canonical copy of the catalog layer: what `fluxnative-catalog emit` writes into a template. */
export const CATALOG_FILES = join(CATALOG_DIR, 'files');
export const CATALOG_CLI = join(CATALOG_DIR, 'src', 'cli.ts');
/** The template dialect's compiler options (strict, noUncheckedIndexedAccess, jsx: react). */
export const CATALOG_TSCONFIG = join(CATALOG_DIR, 'tsconfig.files.json');
/** react, react-native, react-native-svg and their types, which a scaffolded template resolves through a symlink. */
export const CATALOG_NODE_MODULES = join(CATALOG_DIR, 'node_modules');

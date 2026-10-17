The template's own files for the `--root` tests in `../../cli.test.ts`. The
test emits the catalog layer (`fluxnative-catalog emit --only Chip`) into a
temporary `files/` folder and copies these over it, so the recipes are
always the kit's current ones.

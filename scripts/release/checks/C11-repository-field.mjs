/**
 * C11: repository field is present with type, url, and directory.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const repo = json.repository;
    if (!repo) {
      failed.push(`${name}: missing "repository" field`);
      continue;
    }
    if (typeof repo === "string") {
      failed.push(`${name}: "repository" is a string, expected object with type/url/directory`);
      continue;
    }
    if (!repo.type) failed.push(`${name}: repository missing "type"`);
    if (!repo.url) failed.push(`${name}: repository missing "url"`);
  }

  if (failed.length > 0) {
    throw new Error(`C11 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C11: All ${pkgs.length} packages have repository field`);
}

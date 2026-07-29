/**
 * C05: Every publishable package has author, homepage, and bugs fields.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const missingAuthor = [];
  const missingHomepage = [];
  const missingBugs = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    if (!json.author) missingAuthor.push(name);
    if (!json.homepage) missingHomepage.push(name);
    if (!json.bugs) missingBugs.push(name);
  }

  const errors = [];
  if (missingAuthor.length > 0) errors.push(`  missing author: ${missingAuthor.join(", ")}`);
  if (missingHomepage.length > 0) errors.push(`  missing homepage: ${missingHomepage.join(", ")}`);
  if (missingBugs.length > 0) errors.push(`  missing bugs: ${missingBugs.join(", ")}`);

  if (errors.length > 0) {
    throw new Error(`C05 FAIL:\n${errors.join("\n")}`);
  }
  console.log(`  C05: All ${pkgs.length} packages have author, homepage, and bugs fields`);
}

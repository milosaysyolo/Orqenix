// Remove dead @orqenix/* deps from package.json files
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const deadDepsPath = join(rootDir, 'scripts', 'dead-deps.json');

if (!existsSync(deadDepsPath)) {
  console.error('dead-deps.json not found. Run detect-dead-deps.ps1 first.');
  process.exit(1);
}

const deadDeps = JSON.parse(readFileSync(deadDepsPath, 'utf-8'));

if (deadDeps.length === 0) {
  console.log('No dead deps to remove.');
  process.exit(0);
}

console.log(`Removing ${deadDeps.length} dead deps...`);

// Group by package directory
const byPackage = {};
for (const dep of deadDeps) {
  if (!byPackage[dep.PackageDir]) byPackage[dep.PackageDir] = [];
  byPackage[dep.PackageDir].push(dep);
}

let totalRemoved = 0;

for (const [pkgDir, deps] of Object.entries(byPackage)) {
  const pkgJsonPath = join(rootDir, 'packages', pkgDir, 'package.json');
  
  if (!existsSync(pkgJsonPath)) {
    console.warn(`  [${pkgDir}] package.json not found, skipping`);
    continue;
  }
  
  const raw = readFileSync(pkgJsonPath, 'utf-8');
  const pkg = JSON.parse(raw);
  
  let modified = false;
  
  for (const dep of deps) {
    const { DepName: depName, DepType: depType } = dep;
    const section = depType === 'devDependency' ? 'devDependencies' 
      : depType === 'peerDependency' ? 'peerDependencies' 
      : 'dependencies';
    
    if (pkg[section] && depName in pkg[section]) {
      delete pkg[section][depName];
      modified = true;
      totalRemoved++;
      console.log(`  [${pkgDir}] removed ${depName} (${depType})`);
    }
  }
  
  // Remove empty sections
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (pkg[section] && Object.keys(pkg[section]).length === 0) {
      delete pkg[section];
    }
  }
  
  if (modified) {
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  [${pkgDir}] written ✓`);
  }
}

console.log(`\nDone. Removed ${totalRemoved} dead deps across ${Object.keys(byPackage).length} packages.`);
console.log('Run `pnpm install` to update lockfile.');

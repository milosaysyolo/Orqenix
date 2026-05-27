function readPackage(pkg) {
  if (pkg.name === "protobufjs" && pkg.version && pkg.version.startsWith("6.")) {
    pkg.version = "7.5.8";
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };

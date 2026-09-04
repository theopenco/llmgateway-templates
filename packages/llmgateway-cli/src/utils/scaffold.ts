import type { Template } from "./templates.js";

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/** A copied template must install outside this monorepo too. */
export function standaloneManifest(
  manifest: PackageManifest,
  template: Template,
  name: string,
): PackageManifest {
  const result = structuredClone(manifest);
  result.name = name;
  for (const group of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ] as const) {
    for (const [dependency, version] of Object.entries(result[group] ?? {})) {
      if (!version.startsWith("workspace:")) continue;
      const published = template.standaloneDependencies?.[dependency];
      if (!published)
        throw new Error(
          `Template ${template.name} needs a published version for ${dependency}.`,
        );
      result[group]![dependency] = published;
    }
  }
  return result;
}

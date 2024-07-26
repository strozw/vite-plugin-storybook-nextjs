import fs from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import Log from "next/dist/build/output/log.js";
import {
  loadBindings,
  lockfilePatchPromise,
} from "next/dist/build/swc/index.js";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import { CONFIG_FILES } from "next/dist/shared/lib/constants.js";

const { loadEnvConfig } = nextEnv;

const nextDistPath =
  /(next[\\/]dist[\\/]shared[\\/]lib)|(next[\\/]dist[\\/]client)|(next[\\/]dist[\\/]pages)/;

/**
 * Get the potential paths to the Next.js configuration files
 */
export async function getConfigPaths(dir: string) {
  return CONFIG_FILES.map((file) => join(dir, file));
}

/**
 * Set up the environment variables for the Next.js project
 */
export async function loadEnvironmentConfig(dir: string, dev: boolean) {
  return loadEnvConfig(dir, dev, Log);
}

/**
 * Load the SWC bindings eagerly instead of waiting for transform calls
 */
export async function loadSWCBindingsEagerly(nextConfig?: NextConfigComplete) {
  await loadBindings(nextConfig?.experimental?.useWasmBinary);

  if (lockfilePatchPromise.cur) {
    await lockfilePatchPromise.cur;
  }
}

/**
 * Check if the file should be output as CommonJS
 */
export function shouldOutputCommonJs(filename: string) {
  return filename.endsWith(".cjs") || nextDistPath.test(filename);
}

/**
 * Load the closest package.json file to the given directory
 */
export async function loadClosestPackageJson(dir: string, attempts = 1) {
  if (attempts > 5) {
    throw new Error("Can't resolve main package.json file");
  }

  const mainPath = attempts === 1 ? ["."] : new Array(attempts).fill("..");

  try {
    const file = await fs.promises.readFile(
      join(dir, ...mainPath, "package.json"),
      "utf8",
    );
    return JSON.parse(file);
  } catch (e) {
    return loadClosestPackageJson(dir, attempts + 1);
  }
}

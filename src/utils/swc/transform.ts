import path from "node:path";
import type loadJsConfig from "next/dist/build/load-jsconfig";
import { getSupportedBrowsers } from "next/dist/build/utils";
import type { findPagesDir } from "next/dist/lib/find-pages-dir";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { SourceMap } from "rollup";
import { shouldOutputCommonJs } from "../nextjs";
import { getBaseSWCOptions } from "./options";

type VitestSWCTransformConfigParams = {
  filename: string;
  inputSourceMap: SourceMap;
  isServerEnvironment: boolean;
  loadedJSConfig: Awaited<ReturnType<typeof loadJsConfig>>;
  nextDirectories: ReturnType<typeof findPagesDir>;
  nextConfig: NextConfigComplete;
  rootDir: string;
  isDev: boolean;
  isEsmProject: boolean;
};

/**
 * Get the SWC transform options for a file which is passed to Next.js' custom SWC transpiler
 */
export const getVitestSWCTransformConfig = ({
  filename,
  inputSourceMap,
  isServerEnvironment,
  loadedJSConfig,
  nextDirectories,
  nextConfig,
  rootDir,
  isDev,
  isEsmProject,
}: VitestSWCTransformConfigParams) => {
  const baseOptions = getBaseSWCOptions({
    filename,
    development: false,
    hasReactRefresh: false,
    globalWindow: !isServerEnvironment,
    modularizeImports: nextConfig.modularizeImports,
    jsConfig: loadedJSConfig.jsConfig,
    resolvedBaseUrl: loadedJSConfig.resolvedBaseUrl,
    swcPlugins: nextConfig.experimental.swcPlugins,
    compilerOptions: nextConfig?.compilerOptions,
    esm: isEsmProject,
    swcCacheDir: path.join(
      rootDir,
      nextConfig.distDir ?? ".next",
      "cache",
      "swc",
    ),
  });
  const useCjsModules = shouldOutputCommonJs(filename);

  return {
    ...baseOptions,
    fontLoaders: {
      fontLoaders: ["next/font/local", "next/font/google"],
      relativeFilePathFromRoot: path.relative(rootDir, filename),
    },
    cjsRequireOptimizer: {
      packages: {
        "next/server": {
          transforms: {
            NextRequest: "next/dist/server/web/spec-extension/request",
            NextResponse: "next/dist/server/web/spec-extension/response",
            ImageResponse: "next/dist/server/web/spec-extension/image-response",
            userAgentFromString:
              "next/dist/server/web/spec-extension/user-agent",
            userAgent: "next/dist/server/web/spec-extension/user-agent",
          },
        },
      },
    },
    ...(isServerEnvironment
      ? {
          env: {
            targets: {
              // Targets the current version of Node.js
              node: process.versions.node,
            },
          },
        }
      : {
          env: {
            targets: getSupportedBrowsers(rootDir, isDev),
          },
        }),
    module: {
      type: isEsmProject && !useCjsModules ? "es6" : "commonjs",
    },
    disableNextSsg: true,
    disablePageConfig: true,
    pagesDir: nextDirectories.pagesDir,
    appDir: nextDirectories.appDir,
    inputSourceMap:
      inputSourceMap && typeof inputSourceMap === "object"
        ? JSON.stringify(inputSourceMap)
        : undefined,
    sourceFileName: filename,
    filename,
  };
};

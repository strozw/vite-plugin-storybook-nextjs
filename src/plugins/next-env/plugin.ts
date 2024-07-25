import { resolve } from "node:path";
import type { Env } from "@next/env";
import { getDefineEnv } from "next/dist/build/webpack/plugins/define-env-plugin";
import type { NextConfigComplete } from "next/dist/server/config-shared";
import type { Plugin } from "vite";

import * as NextUtils from "../../utils/nextjs";

export function vitePluginNextConfig(
  rootDir: string,
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
) {
  let envConfig: Env;
  let isDev: boolean;

  const resolvedDir = resolve(rootDir);

  return {
    name: "vite-plugin-storybook-nextjs-swc",
    async config(config, env) {
      envConfig = (await NextUtils.loadEnvironmentConfig(resolvedDir, isDev))
        .combinedEnv;
      isDev = env.mode === "development";

      const nextConfig = await nextConfigResolver.promise;

      const publicNextEnvMap = Object.fromEntries(
        Object.entries(envConfig)
          .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
          .map(([key, value]) => {
            return [`process.env.${key}`, JSON.stringify(value)];
          }),
      );

      return {
        ...config,
        define: {
          ...config.define,
          ...publicNextEnvMap,
          ...getDefineEnv({
            isTurbopack: false,
            config: nextConfig,
            isClient: true,
            isEdgeServer: false,
            isNodeOrEdgeCompilation: false,
            isNodeServer: false,
            clientRouterFilters: undefined,
            dev: isDev,
            middlewareMatchers: undefined,
            hasRewrites: false,
            distDir: nextConfig.distDir,
            fetchCacheKeyPrefix: nextConfig?.experimental?.fetchCacheKeyPrefix,
          }),
        },
      };
    },
  } satisfies Plugin;
}

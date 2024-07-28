import fs from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import { decode, encode } from "node:querystring";
import { URL, fileURLToPath } from "node:url";
import imageSizeOf from "image-size";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import { dedent } from "ts-dedent";
import type { Plugin } from "vite";

const includePattern = /\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/;
const excludeImporterPattern = /\.(css|scss|sass)$/;

const virtualImage = "virtual:next-image";
const virtualNextImage = "virtual:next/image";
const virtualNextLegacyImage = "virtual:next/legacy/image";
const virtualNextImageDefaultLoader = "virtual:next/image-default-loader";
const virtualNextImageContext = "virtual:next/image-context";

let sharp: typeof import("sharp") | undefined;

try {
  sharp = require("sharp");
  if (sharp && sharp.concurrency() > 1) {
    // Reducing concurrency reduces the memory usage too.
    const divisor = process.env.NODE_ENV === "development" ? 4 : 2;
    sharp.concurrency(Math.floor(Math.max(cpus().length / divisor, 1)));
  }
} catch (e) {
  console.warn(
    "You have to install sharp in order to use image optimization features in Next.js. AVIF support is also disabled.",
  );
}

export function vitePluginNextImage(
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
) {
  return {
    name: "vite-plugin-storybook-nextjs-image",
    enforce: "pre" as const,
    async config(config, env) {
      return config;
    },
    async resolveId(id, importer) {
      const [source, queryA] = id.split("?");

      if (queryA === "ignore") {
        return null;
      }

      if (
        includePattern.test(source) &&
        !excludeImporterPattern.test(importer ?? "") &&
        !importer?.startsWith(virtualImage)
      ) {
        const isAbsolute = path.isAbsolute(id);
        const imagePath = importer
          ? isAbsolute
            ? source
            : path.join(path.dirname(importer), source)
          : source;

        return `${virtualImage}?imagePath=${imagePath}`;
      }

      if (id === "next/image" && importer !== virtualNextImage) {
        return virtualNextImage;
      }

      if (id === "next/legacy/image" && importer !== virtualNextLegacyImage) {
        return virtualNextLegacyImage;
      }

      if (id === "sb-original/image-context") {
        return virtualNextImageContext;
      }

      if (id === "sb-original/default-loader") {
        return virtualNextImageDefaultLoader;
      }

      return null;
    },

    async load(id) {
      if (virtualNextImage === id) {
        return (
          await fs.promises.readFile(
            fileURLToPath(
              new URL(
                "./plugins/next-image/alias/next-image.js",
                import.meta.url,
              ),
            ),
          )
        ).toString("utf-8");
      }

      if (virtualNextLegacyImage === id) {
        return (
          await fs.promises.readFile(
            fileURLToPath(
              new URL(
                "./plugins/next-image/alias/next-legacy-image.js",
                import.meta.url,
              ),
            ),
          )
        ).toString("utf-8");
      }

      if (virtualNextImageDefaultLoader === id) {
        return (
          await fs.promises.readFile(
            fileURLToPath(
              new URL(
                "./plugins/next-image/alias/image-default-loader.js",
                import.meta.url,
              ),
            ),
          )
        ).toString("utf-8");
      }

      if (virtualNextImageContext === id) {
        return (
          await fs.promises.readFile(
            fileURLToPath(
              new URL(
                "./plugins/next-image/alias/image-context.js",
                import.meta.url,
              ),
            ),
          )
        ).toString("utf-8");
      }

      const [source, query] = id.split("?");

      if (virtualImage === source) {
        const imagePath = decode(query).imagePath as string;

        const nextConfig = await nextConfigResolver.promise;
        const extension = path.extname(imagePath);

        try {
          if (nextConfig.images?.disableStaticImages) {
            return dedent`
						import image from "${imagePath}?ignore";
						export default image;
					`;
          }

          const imageData = await fs.promises.readFile(imagePath);

          let width: number | undefined;
          let height: number | undefined;

          if (extension === ".avif" && sharp) {
            const transformer = sharp(Buffer.from(imageData));
            const result = await transformer.metadata();
            width = result.width;
            height = result.height;
          } else {
            const result = imageSizeOf(imageData);
            width = result.width;
            height = result.height;
          }

          return dedent`
						import src from "${imagePath}?ignore";
						export default {
							src,
							height: ${height},
							width: ${width},
							blurDataURL: src
						};
					`;
        } catch (err) {
          console.error(`Could not read font file ${imagePath}:`, err);
          return undefined;
        }
      }

      return null;
    },
  } satisfies Plugin;
}

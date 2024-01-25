import { readFileSync } from "fs";
import { join, resolve } from "path";
import { yamlParse } from "yaml-cfn";
import { CleanWebpackPlugin } from "clean-webpack-plugin";

const TYPESCRIPT_FILE_EXT = ".ts";
const JAVASCRIPT_FILE_EXT = ".js";
const SAM_TEMPLATE_DIR = "./infrastructure/template.yaml";
const HANDLERS_DIR = "./src/functions";
const FUNCTION_TYPE = "AWS::Serverless::Function";

// read SAM template
const { Globals, Resources } = yamlParse(
  readFileSync(join(__dirname, SAM_TEMPLATE_DIR), "utf-8")
);

/* eslint-disable @typescript-eslint/no-explicit-any, no-unsafe-optional-chaining */
// find the files to bundle by getting the CodeUri and Handler info for each node function
const entry = Object.values(Resources)
  .filter((resource) => Object.keys(resource as any).includes("Type"))
  .filter((resource: any) => resource.Type === FUNCTION_TYPE)
  .filter((resource: any) =>
    (resource.Properties?.Runtime ?? Globals?.Function?.Runtime).startsWith(
      "nodejs"
    )
  )
  .map((resource: any) => {
    return {
      filename: resource.Properties.Handler.split(".")[0] as string, // get filename to bundle
      entryPath: resource.Properties.CodeUri.replaceAll("../", "./") // flatten relative path to the project root
        .replaceAll("dist/", "") // remove the outDir as it is bundled directly into dist
        .split("/")
        .splice(1)
        .join("/") as string, // get out dir for bundle
    };
  })

  // create the entry definitions fow webpack
  .reduce(
    (resources, resource) =>
      Object.assign(resources, {
        [`${resource.entryPath}/${resource.filename}`]: `${HANDLERS_DIR}/${resource.filename}${TYPESCRIPT_FILE_EXT}`,
      }),
    {}
  );

const webpackConfig = {
  mode: process.env["NODE_ENV"]?.trim().startsWith("dev")
    ? "development"
    : "production",
  devtool: process.env["NODE_ENV"]?.trim().startsWith("dev")
    ? "eval-cheap-source-map"
    : undefined,
  module: {
    rules: [
      {
        test: new RegExp(`\\${TYPESCRIPT_FILE_EXT}$`),
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: { extensions: [TYPESCRIPT_FILE_EXT, JAVASCRIPT_FILE_EXT] },
  target: ["node", "es2022"],
  entry,
  output: {
    filename: `[name]${JAVASCRIPT_FILE_EXT}`,
    path: resolve(__dirname, "dist"),
    library: {
      type: "commonjs2",
    },
  },
  plugins: [new CleanWebpackPlugin()],
};

export default webpackConfig;

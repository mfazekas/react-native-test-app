#!/usr/bin/env node
// @ts-check

import * as fs from "node:fs";
import https from "node:https";

const dependenciesGradle = "android/dependencies.gradle";
const groupId = "com.google.devtools.ksp";
const artifactId = "com.google.devtools.ksp.gradle.plugin";
const rows = 50;
const searchUrl = `https://search.maven.org/solrsearch/select?q=g:%22${groupId}%22+AND+a:%22${artifactId}%22&core=gav&rows=${rows}&wt=json`;

function extractVersions(response) {
  if (!Array.isArray(response.docs)) {
    return [];
  }

  const versionMap = response.docs.reduce((versions, { v }) => {
    const parts = v.split("-");
    if (parts.length === 2 && !(parts[0] in versions)) {
      versions[parts[0]] = v;
    }
    return versions;
  }, {});
  return Object.values(versionMap);
}

function update(output, versions) {
  const startMarker = "// update-ksp-versions start";
  const endMarker = "// update-ksp-versions end";
  const separator = "\n        ";

  const src = fs.readFileSync(output, { encoding: "utf-8" });
  const updated = src.replace(
    new RegExp(`${startMarker}.*${endMarker}`, "s"),
    [startMarker, ...versions.map((v) => `"${v}",`), endMarker].join(separator)
  );
  fs.writeFileSync(output, updated);
}

function main() {
  const options = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1661.51",
    },
  };

  https
    .get(searchUrl, options, (res) => {
      if (res.statusCode !== 200) {
        const { statusCode, statusMessage } = res;
        console.error(`${searchUrl} -> ${statusCode}: ${statusMessage}`);
        process.exitCode = 1;
        return;
      }

      const data = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => {
        const { response } = JSON.parse(Buffer.concat(data).toString());
        const versions = extractVersions(response);
        update(dependenciesGradle, versions);
      });
    })
    .on("error", (e) => {
      console.error(e);
      process.exitCode = 1;
    });
}

main();

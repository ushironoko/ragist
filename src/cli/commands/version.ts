import packageJson from "../../../package.json" with { type: "json" };

export function showVersion(): void {
  console.log(packageJson.version);
}

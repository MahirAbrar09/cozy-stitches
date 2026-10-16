#!/usr/bin/env node
/* ==========================================================================
   Cozy Stitches — publishing check
   --------------------------------------------------------------------------
   Prints exactly what the Publish button checks, so a problem can be worked
   out from a terminal without opening the panel.

       npm run doctor
   ========================================================================== */

import { doctor } from "./lib/git.mjs";

const report = doctor();
/* Plain ASCII: a Windows console on a non-UTF-8 codepage mangles anything else. */
const line = (label, value) => console.log("  " + label.padEnd(14) + (value || "-"));

console.log("\nPublishing setup\n");
line("Git", report.version || (report.installed ? "found" : "NOT FOUND"));
line("Repository", report.isRepo ? "yes" : "no");
line("Your name", report.identity && report.identity.name);
line("Your email", report.identity && report.identity.email);
line("GitHub", report.remote);
line("Branch", report.branch);
line("Upstream", report.hasUpstream ? "connected" : "not set");

const pending = report.pendingChanges || [];
line("Unpublished", pending.length ? pending.length + " file(s)" : "nothing");

const missing = report.missingFromRepo || [];
if (missing.length) {
  console.log("");
  console.log("  The repository is missing the website's own files:");
  missing.slice(0, 8).forEach((file) => console.log("    - " + file));
  if (missing.length > 8) console.log("    ... and " + (missing.length - 8) + " more");
  console.log("");
  console.log("  Your host cannot build a site from this repository until they are");
  console.log("  published. Press Publish in the panel and it will add them.");
}

if (report.canPublish) {
  console.log("\n  Ready. Press Publish in the panel, or run `git push`.\n");
} else {
  console.log("\n  Not ready yet. Missing:");
  if (!report.identity || !report.identity.name) console.log("    - your name for commits");
  if (!report.identity || !report.identity.email) console.log("    - your email for commits");
  if (!report.remote) console.log("    - a GitHub repository address");
  if (!report.isRepo) console.log("    - this folder is not a git repository");
  console.log("\n  Run `npm run admin`, then click Publish and fill in the form it shows.\n");
}

process.exit(report.canPublish ? 0 : 1);

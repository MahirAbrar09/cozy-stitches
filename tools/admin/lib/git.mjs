/* ==========================================================================
   Cozy Stitches — git, for publishing
   --------------------------------------------------------------------------
   Content is published by committing it and pushing, and letting the host
   rebuild. That keeps the deploy token out of this project entirely: the only
   credential involved is the one your machine already uses for GitHub.

   Commands run with GIT_TERMINAL_PROMPT=0 so a credential prompt cannot hang
   the admin server, and with a timeout so a stuck network call cannot either.
   ========================================================================== */

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { ROOT } from "./content.mjs";

const TIMEOUT_MS = 90_000;

/* The site's own files, as opposed to the content the panel manages. If any of
   these is absent from the repository then the host cannot build a website out
   of it, which is a failure worth stating out loud rather than discovering from
   a broken live address. */
export const PROJECT_PATHS = [
  "index.html",
  "shop.html",
  "css/tokens.css",
  "js/render.js",
  "js/site.js",
  "tools/build-content.mjs",
  "netlify.toml"
];

/* --------------------------------------------------------------------------
   WHAT GETS COMMITTED, AND WHY IT CHANGED

   An earlier version of this staged only the content files, reasoning that
   unrelated work in progress should not be swept into a content commit. That
   was wrong in a way that mattered: on a brand new repository the first publish
   therefore committed ONLY the content, and the site itself — the pages, the
   stylesheets, the build tool, the host configuration — never entered the
   repository at all. Netlify, connected to that repository, had nothing to
   build, and the live address returned an error.

   The worry was theoretical. The failure was not. `git add -A` is what happens
   now, and `.gitignore` is what keeps junk out.
   -------------------------------------------------------------------------- */

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.timeout || TIMEOUT_MS,
    env: Object.assign({}, process.env, {
      GIT_TERMINAL_PROMPT: "0",
      GIT_PAGER: "cat"
    })
  });

  if (result.error) {
    return { ok: false, stdout: "", stderr: String(result.error.message || result.error), code: -1 };
  }
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

/* On a repository with no commits yet — which is what someone setting this up
   for the first time has — `rev-parse --abbrev-ref HEAD` fails, because HEAD
   points at a branch that does not exist. symbolic-ref reads it either way. */
function currentBranch() {
  const symbolic = git(["symbolic-ref", "--short", "HEAD"]);
  if (symbolic.ok && symbolic.stdout) return symbolic.stdout;

  const plain = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  return plain.ok ? plain.stdout : "";
}

function hasCommit() {
  return git(["rev-parse", "--verify", "HEAD"]).ok;
}

/* Returns the site files the repository does not have yet. Empty means the
   repository is complete. */
export function missingProjectFiles() {
  if (!hasCommit()) {
    return PROJECT_PATHS.filter((relative) => fs.existsSync(path.join(ROOT, relative)));
  }
  return PROJECT_PATHS.filter((relative) => {
    if (!fs.existsSync(path.join(ROOT, relative))) return false;
    return !git(["ls-files", "--error-unmatch", relative]).ok;
  });
}

export function doctor() {
  const insideRepo = git(["rev-parse", "--is-inside-work-tree"]);
  if (!insideRepo.ok) {
    return {
      installed: !insideRepo.stderr.includes("ENOENT"),
      version: version(),
      isRepo: false,
      problem: "This folder is not a git repository yet."
    };
  }

  const name = git(["config", "user.name"]);
  const email = git(["config", "user.email"]);
  const remote = git(["remote", "get-url", "origin"]);
  const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  /* The whole tree, not just the content: a file that was never committed is
     exactly the kind of thing that has to be visible here. */
  const status = git(["status", "--porcelain"]);

  return {
    installed: true,
    version: version(),
    isRepo: true,
    identity: { name: name.stdout || "", email: email.stdout || "" },
    remote: remote.stdout || "",
    branch: currentBranch(),
    hasCommits: hasCommit(),
    missingFromRepo: missingProjectFiles(),
    hasUpstream: upstream.ok,
    pendingChanges: status.stdout ? status.stdout.split("\n").filter(Boolean) : [],
    canPublish: !!(name.stdout && email.stdout && remote.stdout)
  };
}

function version() {
  const result = git(["--version"]);
  return result.ok ? result.stdout : "";
}

/* The safe half of the one-time setup: everything except authentication, which
   can only happen in a browser window that git opens itself. */
export function setup({ name, email, remote, branch } = {}) {
  const steps = [];
  const run = (args, label) => {
    const result = git(args);
    steps.push({ label, ok: result.ok, detail: result.ok ? result.stdout : result.stderr });
  };

  if (name) run(["config", "user.name", name], "Set your name for commits");
  if (email) run(["config", "user.email", email], "Set your email for commits");

  if (remote) {
    const existing = git(["remote", "get-url", "origin"]);
    run(existing.ok
      ? ["remote", "set-url", "origin", remote]
      : ["remote", "add", "origin", remote], "Point origin at your repository");
  }

  if (branch) {
    if (hasCommit()) {
      const current = currentBranch();
      if (current && current !== branch) {
        run(["branch", "-M", branch], "Rename the branch to " + branch);
      }
    } else {
      /* Unborn HEAD: there is nothing to rename yet, so point HEAD at the new
         branch name directly. This is the very first setup. */
      run(["symbolic-ref", "HEAD", "refs/heads/" + branch],
        "Start on the branch " + branch);
    }
  }

  return { steps, doctor: doctor() };
}

export function commitMessage(data) {
  const products = (data.products || []).length;
  const categories = (data.categories || []).length;
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return "content: " + products + " products, " + categories + " categories - " + stamp;
}

export function publish(data) {
  const report = doctor();
  const steps = [];

  if (!report.isRepo) {
    return { ok: false, steps, error: "This folder is not a git repository yet." };
  }
  if (!report.identity.name || !report.identity.email) {
    return {
      ok: false,
      steps,
      error: "Git does not know who you are yet. Fill in your name and email in Setup."
    };
  }
  if (!report.remote) {
    return {
      ok: false,
      steps,
      error: "No GitHub repository is connected yet. Paste its address in Setup."
    };
  }

  const add = git(["add", "-A"]);
  steps.push({
    label: "Staged the project",
    ok: add.ok,
    detail: add.ok ? "content, pages, stylesheets and build tool" : add.stderr
  });
  if (!add.ok) return { ok: false, steps, error: "Could not stage the project files." };

  const staged = git(["diff", "--cached", "--quiet"]);
  if (staged.ok) {
    /* Exit 0 means the index matches HEAD: a save with no actual changes. */
    steps.push({ label: "Nothing had changed", ok: true, detail: "Everything is already published." });
    return { ok: true, steps, nothingToDo: true };
  }

  const first = !hasCommit();
  const message = first ? "Publish the site and its content" : commitMessage(data);
  const commit = git(["commit", "-m", message]);
  steps.push({ label: "Committed", ok: commit.ok, detail: commit.ok ? message : commit.stderr });
  if (!commit.ok) return { ok: false, steps, error: "The commit failed." };

  let push = git(["push"]);
  if (!push.ok && /no upstream|set-upstream|has no upstream/i.test(push.stderr)) {
    push = git(["push", "-u", "origin", "HEAD"]);
  }
  steps.push({
    label: push.ok ? "Pushed to GitHub" : "Push failed",
    ok: push.ok,
    detail: push.ok ? (push.stderr || push.stdout || "up to date") : (push.stderr || push.stdout)
  });

  if (!push.ok) {
    /* A rejected push means GitHub has commits this folder does not, which for
       a single-owner project almost always means something was uploaded or
       edited on the GitHub website. Naming that is far more useful than the
       generic "you may not be signed in". */
    const rejected = /\[rejected\]|fetch first|non-fast-forward/i.test(
      (push.stderr || "") + (push.stdout || "")
    );

    return {
      ok: false,
      steps,
      error: rejected
        ? "GitHub has changes your folder does not have. That normally means files " +
          "were uploaded or edited on the GitHub website rather than in this panel. " +
          "Your commit is safe here. See START-HERE.md, \"If publishing says the " +
          "push was rejected\", for the three commands that put this right."
        : "The commit is saved on this computer but could not be sent to GitHub. " +
          "The most common cause is that you have not signed in yet — try again " +
          "and approve the GitHub window, or push once from a terminal."
    };
  }

  return { ok: true, steps, commit: message };
}

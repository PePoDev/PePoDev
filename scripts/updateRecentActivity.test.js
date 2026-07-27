const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const modulePath = path.join(__dirname, "updateRecentActivity.js");
const updateRecentActivity = require(modulePath);

test("activity updater module exists", () => {
  assert.equal(fs.existsSync(modulePath), true);
});

test("formats pull request events and detects merged pull requests", () => {
  const event = {
    type: "PullRequestEvent",
    repo: { name: "apprai/corqty" },
    payload: {
      action: "closed",
      pull_request: { number: 2, merged: false },
    },
  };

  assert.equal(
    updateRecentActivity.formatEvent(event),
    "❌ Closed PR [#2](https://github.com/apprai/corqty/pull/2) in [apprai/corqty](https://github.com/apprai/corqty)",
  );

  event.payload.pull_request.merged = true;
  assert.equal(
    updateRecentActivity.formatEvent(event),
    "🎉 Merged PR [#2](https://github.com/apprai/corqty/pull/2) in [apprai/corqty](https://github.com/apprai/corqty)",
  );
});

test("formats issue, comment, and release events", () => {
  const repo = { name: "pepodev/example" };

  assert.equal(
    updateRecentActivity.formatEvent({
      type: "IssuesEvent",
      repo,
      payload: {
        action: "opened",
        issue: {
          number: 3,
          html_url: "https://github.com/pepodev/example/issues/3",
        },
      },
    }),
    "❗ Opened issue [#3](https://github.com/pepodev/example/issues/3) in [pepodev/example](https://github.com/pepodev/example)",
  );

  assert.equal(
    updateRecentActivity.formatEvent({
      type: "IssueCommentEvent",
      repo,
      payload: {
        issue: { number: 4 },
        comment: {
          html_url:
            "https://github.com/pepodev/example/issues/4#issuecomment-1",
        },
      },
    }),
    "🗣 Commented on [#4](https://github.com/pepodev/example/issues/4#issuecomment-1) in [pepodev/example](https://github.com/pepodev/example)",
  );

  assert.equal(
    updateRecentActivity.formatEvent({
      type: "ReleaseEvent",
      repo,
      payload: {
        action: "published",
        release: {
          name: "",
          tag_name: "v1.0.0",
          html_url: "https://github.com/pepodev/example/releases/tag/v1.0.0",
        },
      },
    }),
    "🚀 Published release [v1.0.0](https://github.com/pepodev/example/releases/tag/v1.0.0) in [pepodev/example](https://github.com/pepodev/example)",
  );
});

test("replaces only the bounded activity section", () => {
  const readme = [
    "# Profile",
    "<!--START_SECTION:activity-->",
    "old activity",
    "<!--END_SECTION:activity-->",
    "footer",
  ].join("\n");

  assert.equal(
    updateRecentActivity.replaceSection(readme, ["first", "second"]),
    [
      "# Profile",
      "<!--START_SECTION:activity-->",
      "1. first",
      "2. second",
      "<!--END_SECTION:activity-->",
      "footer",
    ].join("\n"),
  );
});

test("fetches five supported events and writes the configured README", async (t) => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "recent-activity-"),
  );
  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
  const readmePath = path.join(tempDirectory, "README.md");
  const originalReadme = [
    "before",
    "<!--START_SECTION:activity-->",
    "old activity",
    "<!--END_SECTION:activity-->",
    "after",
  ].join("\n");
  fs.writeFileSync(readmePath, originalReadme);

  const pullRequest = (number) => ({
    type: "PullRequestEvent",
    repo: { name: "pepodev/example" },
    payload: {
      action: "opened",
      pull_request: { number, merged: false },
    },
  });
  const events = [
    { type: "PushEvent", repo: { name: "pepodev/example" }, payload: {} },
    ...[1, 2, 3, 4, 5, 6].map(pullRequest),
  ];
  const messages = [];

  await updateRecentActivity({
    github: {
      rest: {
        activity: {
          listPublicEventsForUser: async ({ username, per_page }) => {
            assert.equal(username, "pepodev");
            assert.equal(per_page, 100);
            return { data: events };
          },
        },
      },
    },
    context: { repo: { owner: "pepodev" } },
    core: { info: (message) => messages.push(message) },
    readmePath,
  });

  const updatedReadme = fs.readFileSync(readmePath, "utf8");
  assert.match(updatedReadme, /^1\. 💪 Opened PR \[#1\]/m);
  assert.match(updatedReadme, /^5\. 💪 Opened PR \[#5\]/m);
  assert.doesNotMatch(updatedReadme, /\[#6\]/);
  assert.deepEqual(messages, ["Updated README.md with 5 activities."]);
});

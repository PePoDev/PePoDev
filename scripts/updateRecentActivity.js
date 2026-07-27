const fs = require("node:fs");
const path = require("node:path");

const START_MARKER = "<!--START_SECTION:activity-->";
const END_MARKER = "<!--END_SECTION:activity-->";
const MAX_ACTIVITIES = 5;

function capitalize(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function repositoryLink(name) {
  return `[${name}](https://github.com/${name})`;
}

function formatEvent(event) {
  const repository = repositoryLink(event.repo.name);

  if (event.type === "IssueCommentEvent") {
    const { comment, issue } = event.payload;
    return `🗣 Commented on [#${issue.number}](${comment.html_url}) in ${repository}`;
  }

  if (event.type === "IssuesEvent") {
    const emoji = {
      opened: "❗",
      reopened: "🔓",
      closed: "🔒",
    }[event.payload.action] ?? "ℹ️";
    const { issue } = event.payload;
    return `${emoji} ${capitalize(event.payload.action)} issue [#${issue.number}](${issue.html_url}) in ${repository}`;
  }

  if (event.type === "PullRequestEvent") {
    const { pull_request: pullRequest } = event.payload;
    const action =
      event.payload.action === "closed" && pullRequest.merged
        ? "merged"
        : event.payload.action;
    const emoji = {
      opened: "💪",
      closed: "❌",
      merged: "🎉",
    }[action] ?? "ℹ️";
    const url = `https://github.com/${event.repo.name}/pull/${pullRequest.number}`;
    return `${emoji} ${capitalize(action)} PR [#${pullRequest.number}](${url}) in ${repository}`;
  }

  if (event.type === "ReleaseEvent") {
    const { release } = event.payload;
    const label = release.name || release.tag_name;
    return `🚀 ${capitalize(event.payload.action)} release [${label}](${release.html_url}) in ${repository}`;
  }

  return null;
}

function replaceSection(readme, activities) {
  const sectionPattern = new RegExp(
    `(${START_MARKER})[\\s\\S]*?(${END_MARKER})`,
  );

  if (!sectionPattern.test(readme)) {
    throw new Error("README activity section markers were not found.");
  }

  const content = activities
    .map((activity, index) => `${index + 1}. ${activity}`)
    .join("\n");
  return readme.replace(sectionPattern, `$1\n${content}\n$2`);
}

async function updateRecentActivity({
  github,
  context,
  core,
  readmePath = "README.md",
}) {
  const { data: events } =
    await github.rest.activity.listPublicEventsForUser({
      username: context.repo.owner,
      per_page: 100,
    });
  const activities = events
    .map(formatEvent)
    .filter(Boolean)
    .slice(0, MAX_ACTIVITIES);

  if (activities.length === 0) {
    core.info("No supported public activities found; README unchanged.");
    return;
  }

  const readme = fs.readFileSync(readmePath, "utf8");
  fs.writeFileSync(readmePath, replaceSection(readme, activities));
  core.info(
    `Updated ${path.basename(readmePath)} with ${activities.length} activities.`,
  );
}

module.exports = updateRecentActivity;
module.exports.formatEvent = formatEvent;
module.exports.replaceSection = replaceSection;

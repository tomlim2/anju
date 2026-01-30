#!/usr/bin/env python3
"""
Git commit history extractor for portfolio.
Extracts commit messages, metadata, and change statistics from git repositories.
"""

import argparse
import subprocess
import json
import re
from pathlib import Path


# Conventional Commit pattern: type(scope): subject or type: subject
CONVENTIONAL_COMMIT_PATTERN = re.compile(
    r'^(?P<type>feat|fix|refactor|chore|docs|style|test|perf|ci|build|revert)'
    r'(?:\((?P<scope>[^)]+)\))?'
    r'[!]?:\s*(?P<subject>.+)$'
)


def parse_conventional_commit(subject: str) -> dict:
    """Parse conventional commit format from subject line."""
    match = CONVENTIONAL_COMMIT_PATTERN.match(subject)
    if match:
        return {
            "type": match.group("type"),
            "scope": match.group("scope"),
            "subject": match.group("subject")
        }
    return {
        "type": None,
        "scope": None,
        "subject": subject
    }


def get_commit_stats(repo_path: str, commit_hash: str) -> dict:
    """Get change statistics for a single commit."""
    result = subprocess.run(
        ["git", "show", "--stat", "--format=", commit_hash],
        cwd=repo_path,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        return {"files_changed": 0, "insertions": 0, "deletions": 0, "files": []}

    lines = result.stdout.strip().split('\n')
    files = []
    files_changed = 0
    insertions = 0
    deletions = 0

    for line in lines:
        if not line.strip():
            continue
        # Summary line: "3 files changed, 42 insertions(+), 87 deletions(-)"
        summary_match = re.match(
            r'\s*(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?',
            line
        )
        if summary_match:
            files_changed = int(summary_match.group(1))
            insertions = int(summary_match.group(2) or 0)
            deletions = int(summary_match.group(3) or 0)
        # File line: " path/to/file.py | 10 ++--"
        elif '|' in line:
            file_path = line.split('|')[0].strip()
            if file_path:
                files.append(file_path)

    return {
        "files_changed": files_changed,
        "insertions": insertions,
        "deletions": deletions,
        "files": files
    }


def get_commit_body(repo_path: str, commit_hash: str) -> str:
    """Get the body (detailed description) of a commit."""
    result = subprocess.run(
        ["git", "log", "-1", "--format=%b", commit_hash],
        cwd=repo_path,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        return ""

    return result.stdout.strip()


def get_commits(repo_path: str, since: str = None, limit: int = None, author: str = None, include_stats: bool = True, max_files: int = None, remote_only: bool = False) -> list[dict]:
    """Extract commits from a git repository with full metadata."""
    DELIM = "<<COMMIT>>"
    format_str = f"%H{DELIM}%an{DELIM}%ai{DELIM}%s"

    cmd = ["git", "log", f"--pretty=format:{format_str}"]
    if remote_only:
        cmd.append("--remotes")
    if since:
        cmd.append(f"--since={since}")
    if limit:
        cmd.append(f"-{limit}")
    if author:
        cmd.append(f"--author={author}")

    result = subprocess.run(
        cmd,
        cwd=repo_path,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return []

    commits = []
    for line in result.stdout.strip().split('\n'):
        if line and DELIM in line:
            parts = line.split(DELIM)
            if len(parts) >= 4:
                commit_hash = parts[0]
                original_subject = parts[3]

                # Parse conventional commit
                parsed = parse_conventional_commit(original_subject)

                commit = {
                    "hash": commit_hash,
                    "author": parts[1],
                    "date": parts[2],
                    "type": parsed["type"],
                    "scope": parsed["scope"],
                    "subject": parsed["subject"],
                }

                if include_stats:
                    # Get body and stats
                    commit["body"] = get_commit_body(repo_path, commit_hash)
                    stats = get_commit_stats(repo_path, commit_hash)
                    commit.update(stats)

                    # Omit file list if too many files
                    if max_files and commit["files_changed"] > max_files:
                        commit["files"] = []

                commits.append(commit)

    return commits


def save_commits(commits: list[dict], output_path: str) -> None:
    """Save commits to JSON file."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(commits, f, indent=2, ensure_ascii=False)


def print_summary(commits: list[dict]) -> None:
    """Print a summary of extracted commits."""
    if not commits:
        print("No commits found.")
        return

    total_insertions = sum(c.get("insertions", 0) for c in commits)
    total_deletions = sum(c.get("deletions", 0) for c in commits)
    total_files = sum(c.get("files_changed", 0) for c in commits)

    # Count by type
    type_counts = {}
    for c in commits:
        t = c.get("type") or "other"
        type_counts[t] = type_counts.get(t, 0) + 1

    print(f"\n{'='*50}")
    print(f"  COMMIT SUMMARY")
    print(f"{'='*50}")
    print(f"  Total commits: {len(commits)}")
    print(f"  Lines added:   +{total_insertions}")
    print(f"  Lines deleted: -{total_deletions}")
    print(f"  Files changed: {total_files}")
    print(f"\n  By type:")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {t}: {count}")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract git commit history for portfolio")
    parser.add_argument("repo", help="Path to git repository")
    parser.add_argument("-o", "--output", default="commits.json", help="Output JSON file path")
    parser.add_argument("--since", help="Only commits after date (e.g., '1 week ago', '2024-01-01')")
    parser.add_argument("-n", "--limit", type=int, help="Maximum number of commits")
    parser.add_argument("-a", "--author", help="Filter by author name (e.g., 'deemo')")
    parser.add_argument("--no-stats", action="store_true", help="Skip fetching stats (faster)")
    parser.add_argument("--max-files", type=int, default=10, help="Omit file list if more than N files changed (default: 10)")
    parser.add_argument("--remote", action="store_true", help="Only fetch commits from remote branches")

    args = parser.parse_args()

    include_stats = not args.no_stats
    commits = get_commits(args.repo, since=args.since, limit=args.limit, author=args.author, include_stats=include_stats, max_files=args.max_files, remote_only=args.remote)
    save_commits(commits, args.output)
    print(f"Extracted {len(commits)} commits to {args.output}")

    if include_stats:
        print_summary(commits)

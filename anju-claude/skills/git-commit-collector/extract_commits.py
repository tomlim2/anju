#!/usr/bin/env python3
"""
Git commit history extractor.
Extracts commit messages and metadata from git repositories.
"""

import subprocess
import json
from pathlib import Path
from datetime import datetime


def get_commits(repo_path: str, limit: int = 100) -> list[dict]:
    """Extract commits from a git repository."""
    format_str = '{"hash": "%H", "short": "%h", "author": "%an", "date": "%ai", "subject": "%s"}'

    result = subprocess.run(
        ["git", "log", f"-{limit}", f"--pretty=format:{format_str}"],
        cwd=repo_path,
        capture_output=True,
        text=True
    )

    commits = []
    for line in result.stdout.strip().split('\n'):
        if line:
            commits.append(json.loads(line))

    return commits


def save_commits(commits: list[dict], output_path: str) -> None:
    """Save commits to JSON file."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(commits, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    import sys

    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    output = sys.argv[2] if len(sys.argv) > 2 else "commits.json"

    commits = get_commits(repo)
    save_commits(commits, output)
    print(f"Extracted {len(commits)} commits to {output}")

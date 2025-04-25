# Get current branch name
$currentBranch = git rev-parse --abbrev-ref HEAD

# List of new branches to create and push
$branches = @("env-0.7.0", "anime-0.7.0", "lit-0.7.0")

foreach ($branch in $branches) {
    Write-Host "`nCreating branch: $branch from $currentBranch"
    git checkout -b $branch $currentBranch

    Write-Host "Pushing $branch to origin..."
    git push -u origin $branch
}

# Switch back to the original branch
Write-Host "`nSwitching back to original branch: $currentBranch"
git checkout $currentBranch

Write-Host "`n✅ Done. Branches created and pushed."

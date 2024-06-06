# List of users
$users = "clark", "chomi", "sitto", "gomryong", "yumi", "epo", "mone", "add", "baker", "yoojin"

# Get the list of locked files, their owners and IDs
$lockedFiles = git lfs locks | ForEach-Object {
    # Split each line by whitespace
    $parts = $_ -split '\s+'
    # The first part is the file path, the second part is the owner, the last part is the ID with prefix "ID:"
    @{Path=$parts[0]; Owner=$parts[1]; ID=$parts[-1].Replace("ID:", "")}
}

Write-Host "Unlocking files for users: $users"
Write-Host "Locked files:"
$lockedFiles | ForEach-Object {
    Write-Host "$($_.Path) - ID: $($_.ID) - Owner: $($_.Owner)"
}

# Unlock each file if the owner is in the list of users
$lockedFiles | ForEach-Object {
    if ($users -contains $_.Owner) {
        git lfs unlock --force --id=$($_.ID)
    }
}
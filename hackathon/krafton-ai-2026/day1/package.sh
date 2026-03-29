#!/bin/bash
# Package submission ZIP for KRAFTON AI Hackathon Day 1
# Run from day1/ directory

cd "$(dirname "$0")"

echo "=== Packaging Submission ==="

# Check required files
if [ ! -f "report.pdf" ]; then
    echo "ERROR: report.pdf not found!"
    exit 1
fi

if [ ! -f "multiplier.py" ]; then
    echo "ERROR: multiplier.py not found!"
    exit 1
fi

# Create ZIP
ZIP_NAME="submission_day1_179.zip"
rm -f "$ZIP_NAME"
zip "$ZIP_NAME" report.pdf multiplier.py

echo ""
echo "=== Created: $ZIP_NAME ==="
ls -lh "$ZIP_NAME"
echo ""
echo "=== Contents: ==="
unzip -l "$ZIP_NAME"
echo ""
echo "=== Submit to Google Form ==="
echo "Name: (as on application)"
echo "Participant #: 179"
echo "P_1: ___"
echo "P_2: ___"
echo "ACC_2: ___"
echo "File: $ZIP_NAME"

#!/bin/bash
# Clean up stale git lock files if they exist
if [ -f ".git/index.lock" ]; then
  echo "Removing stale git lock file..."
  rm -f .git/index.lock
fi

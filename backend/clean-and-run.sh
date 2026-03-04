#!/bin/bash
# Stop any running dotnet process and clean build outputs to fix
# "EliteApp.API.deps.json is being used by another process"

echo "Stopping dotnet processes..."
pkill -f "dotnet" 2>/dev/null && echo "Stopped." || echo "None running."

sleep 2

echo "Removing bin and obj..."
rm -rf bin obj

echo "Done. Run 'dotnet run' again."

#!/bin/bash

# Gå til mappen hvor denne fil ligger
cd "$(dirname "$0")"

echo "--------------------------------------------------"
echo "🚀 Starter PDF Merger WebApp..."
echo "--------------------------------------------------"

# Start serveren og åbn browseren automatisk
npm run dev -- --open

# Hold vinduet åbent hvis noget går galt
echo "--------------------------------------------------"
echo "Tryk på en tast for at lukke dette vindue..."
read -n 1

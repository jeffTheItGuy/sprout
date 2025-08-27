#!/bin/bash

echo "Building and starting dev containers..."

docker compose -f .docker/dev/dev.docker-compose.yml up --build 

echo "Containers started."

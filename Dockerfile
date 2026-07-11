# One Render Web Service: Discord bot + Tammy Second Life agent.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-build
WORKDIR /src
COPY . .
RUN dotnet restore TammyAgent/TammyAgent.csproj
RUN dotnet publish TammyAgent/TammyAgent.csproj -c Release -f net8.0 -o /app/tammy --no-restore

FROM node:20-bookworm-slim AS node-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=dotnet-build /app/tammy ./TammyAgent
COPY --from=node-deps /app/node_modules ./node_modules
COPY package.json index.js db.js tammyLive.js concierge.js ./
COPY start-services.sh ./
RUN chmod +x ./start-services.sh
EXPOSE 3000
ENTRYPOINT ["./start-services.sh"]

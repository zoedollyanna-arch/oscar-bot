# Tammy Brightwood — Second Life agent (Render Background Worker)
# Multi-stage: build the .NET 8 worker (which also builds the LibreMetaverse library), then run it
# on the lightweight runtime image. Deploy on Render as a Background Worker (no public HTTP).

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy everything needed to build (TammyAgent references the LibreMetaverse project directly).
COPY . .

RUN dotnet restore TammyAgent/TammyAgent.csproj
RUN dotnet publish TammyAgent/TammyAgent.csproj \
    -c Release \
    -f net8.0 \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# All configuration is via environment variables (set them in the Render dashboard):
#   SL_FIRST_NAME  SL_LAST_NAME  SL_PASSWORD  SL_START_LOCATION
#   DATABASE_URL           (the SAME Neon URL the main Discord bot uses)
#   LIFELINE_API_URL  LIFELINE_API_SECRET   (Lifeline backend for guest context)
#   OPENAI_API_KEY  OPENAI_MODEL           (optional — enables the AI brain)
#   TAMMY_MODE                              (optional initial mode, e.g. assisted)
ENTRYPOINT ["dotnet", "TammyAgent.dll"]

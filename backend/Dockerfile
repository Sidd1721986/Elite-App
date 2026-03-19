FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj and restore as distinct layers
COPY ["EliteApp.API.csproj", "./"]
RUN dotnet restore "EliteApp.API.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src/."
RUN dotnet build "EliteApp.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "EliteApp.API.csproj" -c Release -o /app/publish

# Build runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 5260

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "EliteApp.API.dll"]

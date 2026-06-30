FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app
# Bundle EF migrations bundle so we can run them without the SDK at runtime
RUN dotnet tool install --global dotnet-ef && \
    /root/.dotnet/tools/dotnet-ef migrations bundle \
      --self-contained -r linux-x64 -o /app/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .

EXPOSE 5000
ENTRYPOINT ["dotnet", "server.dll"]
